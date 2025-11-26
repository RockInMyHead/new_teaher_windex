/**
 * useLearningProfile Hook
 * Хук для работы с профилем обучения в компонентах
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  learningProfileService, 
  LearningProfile, 
  LLMContext 
} from '@/services/learningProfileService';

interface UseLearningProfileOptions {
  userId: string;
  courseId: string;
  autoLoad?: boolean;
}

interface UseLearningProfileReturn {
  profile: LearningProfile | null;
  llmContext: LLMContext | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProfile: () => Promise<void>;
  loadLLMContext: () => Promise<void>;
  updateProfile: (updates: Partial<LearningProfile>) => Promise<void>;
  addWeakTopic: (topic: string, details?: string, severity?: 'low' | 'medium' | 'high') => Promise<void>;
  addStrongTopic: (topic: string, masteryLevel?: number) => Promise<void>;
  assignHomework: (homework: string, dueAt?: string) => Promise<void>;
  addTeacherNote: (note: string, category?: 'general' | 'progress' | 'concern' | 'recommendation') => Promise<void>;
  analyzeAndUpdateFromLLM: (llmResponse: string, userMessage: string) => Promise<void>;
  
  // Computed
  systemPrompt: string;
  welcomeMessage: string;
}

export function useLearningProfile({
  userId,
  courseId,
  autoLoad = true
}: UseLearningProfileOptions): UseLearningProfileReturn {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [llmContext, setLLMContext] = useState<LLMContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadedRef = useRef(false);

  // Helper function to validate courseId and userId
  const isValidId = (id: string | null | undefined): boolean => {
    return !!(id && 
      id !== 'NaN' && 
      id !== 'null' && 
      id !== 'undefined' &&
      typeof id === 'string' &&
      id.trim() !== '');
  };

  // Load profile
  const loadProfile = useCallback(async () => {
    // Validate userId and courseId - ensure they are valid strings and not empty/NaN
    if (!isValidId(userId) || !isValidId(courseId)) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const loadedProfile = await learningProfileService.getProfile(userId, courseId);
      setProfile(loadedProfile);
    } catch (err) {
      console.error('Error loading learning profile:', err);
      setError('Не удалось загрузить профиль обучения');
    } finally {
      setIsLoading(false);
    }
  }, [userId, courseId]);

  // Load LLM context
  const loadLLMContext = useCallback(async () => {
    console.log('🎯 loadLLMContext called with:', { userId, courseId, validUser: isValidId(userId), validCourse: isValidId(courseId) });

    // Validate userId and courseId - ensure they are valid strings and not empty/NaN
    if (!isValidId(userId) || !isValidId(courseId)) {
      console.warn('❌ loadLLMContext validation failed:', { userId, courseId });
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Calling learningProfileService.getLLMContext...');
      const context = await learningProfileService.getLLMContext(userId, courseId);
      console.log('✅ LLM context loaded:', !!context);
      setLLMContext(context);
    } catch (err) {
      console.error('❌ Error loading LLM context:', err);
      setError('Не удалось загрузить контекст для обучения');
    } finally {
      setIsLoading(false);
    }
  }, [userId, courseId]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<LearningProfile>) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    try {
      const updatedProfile = await learningProfileService.updateProfile(userId, courseId, updates);
      setProfile(updatedProfile);
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  }, [userId, courseId]);

  // Add weak topic
  const addWeakTopic = useCallback(async (
    topic: string, 
    details?: string, 
    severity: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    try {
      const weakTopics = await learningProfileService.addWeakTopic(userId, courseId, topic, details, severity);
      setProfile(prev => prev ? { ...prev, weakTopics } : null);
    } catch (err) {
      console.error('Error adding weak topic:', err);
    }
  }, [userId, courseId]);

  // Add strong topic
  const addStrongTopic = useCallback(async (topic: string, masteryLevel: number = 80) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    try {
      const strongTopics = await learningProfileService.addStrongTopic(userId, courseId, topic, masteryLevel);
      setProfile(prev => prev ? { ...prev, strongTopics } : null);
    } catch (err) {
      console.error('Error adding strong topic:', err);
    }
  }, [userId, courseId]);

  // Assign homework
  const assignHomework = useCallback(async (homework: string, dueAt?: string) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    try {
      const homeworkEntry = await learningProfileService.assignHomework(userId, courseId, homework, dueAt);
      setProfile(prev => prev ? { 
        ...prev, 
        currentHomework: homework,
        currentHomeworkStatus: 'pending',
        homeworkHistory: [...(prev.homeworkHistory || []), homeworkEntry]
      } : null);
    } catch (err) {
      console.error('Error assigning homework:', err);
    }
  }, [userId, courseId]);

  // Add teacher note
  const addTeacherNote = useCallback(async (
    note: string, 
    category: 'general' | 'progress' | 'concern' | 'recommendation' = 'general'
  ) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    try {
      const teacherNote = await learningProfileService.addTeacherNote(userId, courseId, note, category);
      setProfile(prev => prev ? { 
        ...prev, 
        teacherNotes: [...(prev.teacherNotes || []), teacherNote]
      } : null);
    } catch (err) {
      console.error('Error adding teacher note:', err);
    }
  }, [userId, courseId]);

  // Analyze LLM response and update profile
  const analyzeAndUpdateFromLLM = useCallback(async (llmResponse: string, userMessage: string) => {
    if (!isValidId(userId) || !isValidId(courseId)) return;
    
    await learningProfileService.analyzeAndUpdateProfile(userId, courseId, llmResponse, userMessage);
    // Reload profile to get updated data
    await loadProfile();
  }, [userId, courseId, loadProfile]);

  // Auto-load on mount
  useEffect(() => {
    console.log('🔄 useLearningProfile auto-load effect:', { autoLoad, userId, courseId, loaded: loadedRef.current });
    if (autoLoad && isValidId(userId) && isValidId(courseId) && !loadedRef.current) {
      loadedRef.current = true;
      console.log('🚀 useLearningProfile starting auto-load...');
      loadLLMContext();
    } else {
      console.log('⏸️ useLearningProfile auto-load skipped:', {
        autoLoad,
        validUser: isValidId(userId),
        validCourse: isValidId(courseId),
        alreadyLoaded: loadedRef.current
      });
    }
  }, [autoLoad, userId, courseId, loadLLMContext]);

  // Computed: system prompt
  const systemPrompt = llmContext?.systemInstructions || '';

  // Computed: welcome message
  const welcomeMessage = llmContext ? learningProfileService.formatWelcomeMessage(llmContext) : '';

  return {
    profile,
    llmContext,
    isLoading,
    error,
    loadProfile,
    loadLLMContext,
    updateProfile,
    addWeakTopic,
    addStrongTopic,
    assignHomework,
    addTeacherNote,
    analyzeAndUpdateFromLLM,
    systemPrompt,
    welcomeMessage
  };
}

export default useLearningProfile;

