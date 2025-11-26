declare global {
  interface Window {
    _assessmentResolver?: ((answer: string) => void) | null;
  }
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Brain, Send, User, MessageCircle, Volume2, VolumeX, CheckCircle, X, BookOpen, Target, ArrowLeft, Phone, PhoneOff } from 'lucide-react';
import { OpenAITTS, isTTSAvailable } from '@/lib/openaiTTS';

// Обновляем время взаимодействия при действиях пользователя
const updateUserInteraction = () => OpenAITTS.updateUserInteraction();
import { VoiceComm, VoiceUtils } from '@/lib/voiceComm';
import { getFullCourseTitle, parseCourseId, getCourseById } from '@/config/courses';
import { AssessmentResults } from '@/components/AssessmentResults';
import { ChatContainer } from '@/components/Chat';
import LessonDisplay from '@/components/LessonDisplay';
// Stub for lesson context manager
interface LessonBlock {
  id: number;
  title: string;
  content: string;
  type: string;
}

interface LessonContext {
  currentTopic?: string;
}

class LessonContextManager {
  getCurrentContext() {
    return null;
  }
  getSystemPrompt() {
    return '';
  }
  startLesson(data: any) {
    // stub
  }
  updateCurrentBlock(block: LessonBlock, blockIndex?: number, totalBlocks?: number) {
    // stub
  }
  endLesson() {
    // stub
  }
}
import { HeaderWithHero } from '@/components/Header';
import { useLearningProfile } from '@/hooks/useLearningProfile';
import { learningProfileService } from '@/services/learningProfileService';
import { sessionService } from '@/services/sessionService';





interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ttsPlayed?: boolean;
}


const Chat = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const chatContainerRef = useRef<any>(null);
  const isNavigatingRef = useRef(false);

  // Get course and user IDs from URL params for learning profile
  const courseIdFromParamsRaw = searchParams.get('course');
  // Ensure courseId is valid (not empty, not NaN, not null, not undefined)
  const courseIdFromParams = (courseIdFromParamsRaw && 
    courseIdFromParamsRaw !== 'NaN' && 
    courseIdFromParamsRaw !== 'null' && 
    courseIdFromParamsRaw !== 'undefined' &&
    courseIdFromParamsRaw.trim() !== '') ? courseIdFromParamsRaw : '';
  const userIdFromStorage = sessionService.getUserId();
  
  // Learning profile hook - loads student profile and LLM context
  const {
    profile: learningProfile,
    llmContext,
    isLoading: isLoadingProfile,
    systemPrompt: profileSystemPrompt,
    welcomeMessage: profileWelcomeMessage,
    analyzeAndUpdateFromLLM,
    addWeakTopic,
    addStrongTopic,
    assignHomework,
    addTeacherNote,
    loadLLMContext
  } = useLearningProfile({
    userId: userIdFromStorage,
    courseId: courseIdFromParams,
    autoLoad: !!courseIdFromParams
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'invalid' | 'error'>('checking');
  const [ttsInterrupted, setTtsInterrupted] = useState(false);
  const [currentSentence, setCurrentSentence] = useState<number>(0);
  const [totalSentences, setTotalSentences] = useState<number>(0);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [personalizedCourseData, setPersonalizedCourseData] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [isLessonMode, setIsLessonMode] = useState(false);
  const [autoGenerateLesson, setAutoGenerateLesson] = useState(false);
  const [lessonSessionData, setLessonSessionData] = useState<any>(null);

  // Lesson plan and interactive lesson states
  const [lessonPlan, setLessonPlan] = useState<any>(null);
  const [currentLessonStep, setCurrentLessonStep] = useState(0);
  const [lessonContent, setLessonContent] = useState<string>('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);

  // Lesson sections for interactive learning
  const [currentLessonSections, setCurrentLessonSections] = useState<any[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Generate content sections for a lesson step
  const generateStepContent = useCallback(async (stepIndex: number, step: any, lessonPlan: any) => {
    try {
      console.log('🎯 Generating content for step:', step.title);

      // Parse the description into sections
      const sections = parseLessonContent(step.description);

      // Set the sections for display
      setCurrentLessonSections(sections);
      setCurrentSectionIndex(0);
      setCurrentSectionTask(null);
      setWaitingForAnswer(false);

      console.log('✅ Generated', sections.length, 'sections for step:', step.title);
    } catch (error) {
      console.error('❌ Error generating step content:', error);
      // Fallback: create single section with the description
      setCurrentLessonSections([{
        title: step.title,
        content: step.description || 'Контент урока временно недоступен.'
      }]);
      setCurrentSectionIndex(0);
      setCurrentSectionTask(null);
      setWaitingForAnswer(false);
    }
  }, []);

  // Parse lesson content into sections
  const parseLessonContent = useCallback((content: string): any[] => {
    if (!content) return [{ title: 'Содержание', content: 'Контент не найден.' }];

    const sections: any[] = [];
    const lines = content.split('\n');

    let currentSection: any = null;
    let currentContent = '';

    for (const line of lines) {
      // Check for headers (### or ##)
      if (line.startsWith('### ')) {
        // Save previous section if exists
        if (currentSection) {
          currentSection.content = currentContent.trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: line.replace(/^###\s*/, '').trim(),
          content: ''
        };
        currentContent = '';
      } else if (line.startsWith('## ')) {
        // Save previous section if exists
        if (currentSection) {
          currentSection.content = currentContent.trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: line.replace(/^##\s*/, '').trim(),
          content: ''
        };
        currentContent = '';
      } else if (line.startsWith('# ')) {
        // Save previous section if exists
        if (currentSection) {
          currentSection.content = currentContent.trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: line.replace(/^#\s*/, '').trim(),
          content: ''
        };
        currentContent = '';
      } else if (currentSection) {
        // Add to current section content
        currentContent += line + '\n';
      } else {
        // No section started yet, create default
        currentSection = {
          title: 'Основной материал',
          content: line + '\n'
        };
      }
    }

    // Save the last section
    if (currentSection) {
      currentSection.content = currentContent.trim();
      sections.push(currentSection);
    }

    // If no sections were found, create one
    if (sections.length === 0) {
      sections.push({
        title: 'Содержание урока',
        content: content
      });
    }

    return sections;
  }, []);
  const [currentSectionTask, setCurrentSectionTask] = useState<any>(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [thinkingDots, setThinkingDots] = useState('');
  const [callTranscript, setCallTranscript] = useState('');
  const [lessonNotes, setLessonNotes] = useState<string[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [isLessonSpeaking, setIsLessonSpeaking] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [isProcessingQuestion, setIsProcessingQuestion] = useState(false);
  const [questionTimeout, setQuestionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lessonPausedAt, setLessonPausedAt] = useState<number | null>(null);
  const [isWaitingForStudentAnswer, setIsWaitingForStudentAnswer] = useState(false);
  const [currentTeacherQuestion, setCurrentTeacherQuestion] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'teacher' | 'student', text: string}>>([]);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [lessonStreamText, setLessonStreamText] = useState('');
  const [lessonGenerationComplete, setLessonGenerationComplete] = useState(false);
  const [textMessage, setTextMessage] = useState('');
  const [isProcessingTextMessage, setIsProcessingTextMessage] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);



  const ttsContinueRef = useRef<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const interruptionCheckIntervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Effect for thinking dots animation
  useEffect(() => {
    if (isGeneratingPlan) {
      const interval = setInterval(() => {
        setThinkingDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    } else {
      setThinkingDots('');
    }
  }, [isGeneratingPlan]);

  // Audio feedback functions
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playBeep = async (frequency: number = 800, duration: number = 200, type: OscillatorType = 'sine') => {
    try {
      const audioContext = initAudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play audio feedback:', error);
    }
  };

  const startContinuousSound = (frequency: number = 600, interval: number = 800) => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
    }

    soundIntervalRef.current = setInterval(() => {
      playBeep(frequency, 100, 'sine');
    }, interval);
  };


  const stopContinuousSound = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };

  // Clear all interruption check intervals
  const clearAllInterruptionChecks = () => {
    interruptionCheckIntervalsRef.current.forEach(interval => {
      clearInterval(interval);
    });
    interruptionCheckIntervalsRef.current.clear();
  };


  // Auto TTS for new messages when enabled
  useEffect(() => {
    if (isTtsEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only auto-speak assistant messages, not user messages, and only if not already speaking
      if (lastMessage.role === 'assistant' && !lastMessage.ttsPlayed && !OpenAITTS.isPlaying()) {
        // Mark as played to avoid re-playing
        lastMessage.ttsPlayed = true;
        OpenAITTS.speak(lastMessage.content, { voice: 'nova', speed: 1.0 }); // Use OpenAI TTS
      }
    }
  }, [messages, isTtsEnabled]);


  // Load course data from URL parameters
  const loadCourseDataFromParams = async (courseId: string, lessonId: string) => {
    // Validate courseId before making API request
    if (!courseId || 
        courseId === 'NaN' || 
        courseId === 'null' || 
        courseId === 'undefined' ||
        courseId.trim() === '') {
      console.warn('⚠️ Invalid courseId, skipping API request:', courseId);
      return;
    }

    try {
      console.log('🔍 Loading course data for:', { courseId, lessonId });

      // Try to get course data from API
      const response = await fetch(`${window.location.origin}/api/courses/${courseId}`);
      if (response.ok) {
        const apiResponse = await response.json();
        console.log('✅ Course data loaded from API:', apiResponse);
        
        // Handle both response formats: {course: {...}} or {...}
        const courseData = apiResponse.course || apiResponse;
        console.log('📦 Extracted course data:', courseData);

        // Parse lesson number from lessonId (format: lesson_courseId_number)
        let lessonNumber = 1;
        const lessonMatch = lessonId.match(/lesson_.*_(\d+)$/);
        if (lessonMatch) {
          lessonNumber = parseInt(lessonMatch[1]);
        }

        // Find the specific lesson
        const lesson = courseData.lessons?.find((l: any) => l.lesson_number === lessonNumber) || courseData.lessons?.[0];

        // Create lesson data structure
        const lessonData = {
          id: lesson?.id || lessonId,
          number: lesson?.lesson_number || lessonNumber,
          title: lesson?.title || 'Текущий урок',
          topic: lesson?.topic || 'Тема урока',
          content: lesson?.content || 'Контент урока',
          grade: courseData.grade
        };

        // Set course context
        setPersonalizedCourseData({
          courseInfo: {
            id: courseData.id,
            title: courseData.title,
            grade: courseData.grade,
            description: courseData.description
          },
          lessons: [lessonData]
        });

        setCurrentLesson(lessonData);

        // Try to get lesson session data from DB
        const loadSessionData = async () => {
          const sessionData = await sessionService.getLessonSession(courseId);
          if (sessionData) {
          setLessonSessionData(sessionData);
            console.log('✅ Lesson session data loaded from DB:', sessionData);
        } else {
          // Create default session data
          const defaultSession = {
            lessonNumber: 1,
            completedLessons: [],
            homeworks: [],
            lastLessonDate: new Date().toISOString()
          };
          setLessonSessionData(defaultSession);
            await sessionService.saveLessonSession(courseId, defaultSession);
            console.log('📝 Created default lesson session in DB');
        }
        };
        loadSessionData();

      } else if (response.status === 404) {
        console.warn('⚠️ Course not found, falling back to user state');
        // Course not found, use fallback
        loadFromUserStateFallback();
      } else {
        console.error('❌ Failed to load course data from API, status:', response.status);
        // Fallback to user state
        loadFromUserStateFallback();
      }
    } catch (error) {
      console.error('❌ Error loading course data from params:', error);
      // Fallback to user state
      loadFromUserStateFallback();
    }
  };

  // Fallback function to load from user state in DB
  const loadFromUserStateFallback = async () => {
    const userState = await sessionService.getUserState();

    if (userState?.currentLessonData) {
      try {
        setCurrentLesson(userState.currentLessonData);
        console.log('Loaded lesson data from user state:', userState.currentLessonData);
      } catch (error) {
        console.error('Failed to load lesson data:', error);
      }
    }

    if (userState?.courseInfo) {
      try {
        // Create minimal personalizedCourseData structure for lesson mode
        setPersonalizedCourseData({
          courseInfo: userState.courseInfo,
          lessons: userState.currentLessonData ? [userState.currentLessonData] : []
        });
      } catch (error) {
        console.error('Failed to load course info:', error);
      }
    }
  };

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      // Stop TTS
      OpenAITTS.stop();
    };
  }, []);

  // Initialize lesson mode and load data
  useEffect(() => {
    const mode = searchParams.get('mode');
    const auto = searchParams.get('auto');
    console.log('🎯 Chat useEffect triggered:', {
      mode: mode,
      auto: auto,
      searchParamsString: searchParams.toString(),
      currentURL: window.location.href
    });

    // Check if this is a lesson chat
    const isLessonModeParam = mode === 'lesson';
    setIsLessonMode(isLessonModeParam);

    // Load current lesson data from DB or URL parameters
    if (isLessonModeParam) {
      const courseParam = searchParams.get('course');
      const lessonParam = searchParams.get('lesson');

      console.log('📚 Lesson mode detected:', {
        courseParam,
        lessonParam
      });

      // If we have URL parameters, try to load course data
      // Validate that courseParam is not invalid values
      const isValidCourseParam = courseParam && 
        courseParam !== 'NaN' && 
        courseParam !== 'null' && 
        courseParam !== 'undefined' &&
        courseParam.trim() !== '';
      
      if (isValidCourseParam && lessonParam) {
        console.log('🔗 Loading course data from URL parameters...');
        loadCourseDataFromParams(courseParam, lessonParam);
      } else {
        if (courseParam && !isValidCourseParam) {
          console.warn('⚠️ Invalid courseParam in URL:', courseParam, '- falling back to user state');
        }
        // Fallback: try to load from user state in DB
        const loadFromUserState = async () => {
          const userState = await sessionService.getUserState();
          if (userState?.currentCourseId) {
            console.log('📦 Found course data in user state:', userState);
            
            // Set course context
            if (userState.courseInfo) {
            const personalizedData = {
                courseInfo: userState.courseInfo,
                lessons: userState.currentLessonData ? [userState.currentLessonData] : []
            };
            setPersonalizedCourseData(personalizedData);
            console.log('✅ Set personalizedCourseData:', personalizedData);
            }

            // Load lesson session data from DB
            const sessionData = await sessionService.getLessonSession(userState.currentCourseId);
            if (sessionData) {
              setLessonSessionData(sessionData);
              console.log('✅ Loaded lesson session data from DB:', sessionData);
              }

            if (userState.currentLessonData) {
              setCurrentLesson(userState.currentLessonData);
              console.log('Loaded lesson data for lesson mode:', userState.currentLessonData);
        }
      }
        };
        loadFromUserState();
      }

      // Auto-start lesson generation if requested
      if (auto === 'true' && currentLesson) {
        console.log('🚀 Auto-starting lesson generation...');
        console.log('Current lesson state:', currentLesson);

        // Set a flag to auto-generate when lesson is loaded
        setTimeout(() => {
          console.log('⏰ Timeout fired, setting auto-generate flag to true');
          setAutoGenerateLesson(true);
        }, 100); // Small delay to ensure state is set
      } else {
        console.log('ℹ️ Auto-start conditions not met:', {
          auto: auto,
          autoIsTrue: auto === 'true',
          currentLesson: !!currentLesson
        });
      }
    }

    // For regular chat mode (not lesson mode), load course context ONLY if there's lesson session data
    // This prevents loading course data for plain general chat at /chat
    if (!isLessonModeParam) {
      console.log('Regular chat mode - checking for lesson context');
      console.log('Current URL:', window.location.href);

      // Check if there's lesson session data in DB
      const loadCourseContextForChat = async () => {
        const userState = await sessionService.getUserState();
      
        if (userState?.currentCourseId) {
          console.log('📦 Found course data in user state:', userState);
          
          // Get lesson session data from DB
          const sessionData = await sessionService.getLessonSession(userState.currentCourseId);
          
          console.log('📦 Lesson session data exists:', !!sessionData);

          // Only load course data if we have lesson session data (meaning this is a lesson chat)
          if (sessionData) {
            console.log('✅ Valid lesson chat detected');
            console.log('📚 Course title:', userState.courseInfo?.title);
            console.log('📖 Lesson number:', sessionData.lessonNumber);

            // Clear any existing course data first to prevent old data from persisting
            setPersonalizedCourseData(null);
            setLessonSessionData(null);

          // Set course context for the chat (but DON'T set currentLesson to avoid triggering lesson generation)
            if (userState.courseInfo) {
          setPersonalizedCourseData({
                courseInfo: userState.courseInfo,
            lessons: []
          });
            }

            // Set lesson session data
            setLessonSessionData(sessionData);
            console.log('Loaded lesson session data:', sessionData);

          // DON'T set currentLesson in chat mode - we only need course context, not lesson mode
          // This prevents automatic lesson generation from triggering

          } else {
            console.log('⚠️ No lesson session data - treating as general chat');
            // No lesson session means general chat
          setCurrentLesson(null);
          setPersonalizedCourseData(null);
          setLessonSessionData(null);
        }
      } else {
          console.log('⚠️ No course data in user state - treating as general chat');
          // Clear any existing data
        setCurrentLesson(null);
        setPersonalizedCourseData(null);
        setLessonSessionData(null);
      }
      };
      loadCourseContextForChat();
    }
  }, [searchParams]);

  // Generate welcome message when course data is loaded (only for lesson chats)
  // OR for general chat without course (universal teacher)
  useEffect(() => {
    console.log('🔍 Welcome message useEffect check:', {
      hasPersonalizedCourseData: !!personalizedCourseData,
      hasLessonSessionData: !!lessonSessionData,
      messagesCount: messages.length,
      isLessonMode,
      courseTitle: personalizedCourseData?.courseInfo?.title,
      timestamp: new Date().toISOString()
    });

    // Check if we have a general welcome message that should be replaced
    const hasGeneralWelcome = messages.length === 1 && 
      messages[0]?.role === 'assistant' && 
      (messages[0]?.content?.includes('Я Юлия, твой универсальный ИИ-учитель') ||
       messages[0]?.content?.includes('Я универсальный учитель по любым предметам'));

    // For general chat at /chat without course - show universal teacher welcome
    // Only if we're definitively NOT in lesson mode (not just URL param, but also no course data loading)
    // Never show universal welcome if we're in lesson mode, even if data hasn't loaded yet
    if (!isLessonMode && !personalizedCourseData && !lessonSessionData && messages.length === 0) {
      console.log('👋 General chat mode - adding universal teacher welcome');
      const universalWelcome: Message = {
        id: `welcome-universal-${Date.now()}`,
        role: 'assistant',
        content: `Привет! 👋 Я Юлия, твой универсальный ИИ-учитель.

Я могу помочь тебе с любым школьным предметом: математика, русский язык, английский, физика, химия, биология, история и многое другое!

Что ты хочешь изучить сегодня? Просто напиши тему или вопрос, и мы начнём!`,
        timestamp: new Date()
      };
      setMessages([universalWelcome]);
      return;
    }

    // Only generate welcome message if we have lesson session data (meaning this is a lesson chat)
    // For regular chat at /chat, no welcome message should be generated
    // Also generate if we have general welcome that needs to be replaced
    // Check if there's an old cached welcome message that needs to be replaced
    const hasOldWelcome = messages.length > 0 && messages[0]?.role === 'assistant' && 
      (messages[0]?.content?.includes('Добрый день!') || 
       messages[0]?.content?.includes('Чем могу помочь?') ||
       messages[0]?.content?.includes('Чем я могу помочь') ||
       messages[0]?.content?.length < 400); // Old short messages
    
    // Wait for llmContext to load before generating welcome (for personalized experience)
    const isContextReady = !isLoadingProfile;
    
    if (personalizedCourseData && lessonSessionData && isLessonMode && isContextReady && (messages.length === 0 || hasGeneralWelcome || hasOldWelcome)) {
      console.log('✅ Conditions met for lesson welcome generation:', {
        hasPersonalizedCourseData: !!personalizedCourseData,
        hasLessonSessionData: !!lessonSessionData,
        isLessonMode,
        messagesLength: messages.length,
        hasGeneralWelcome,
        hasOldWelcome,
        hasLLMContext: !!llmContext,
        hasProfileSystemPrompt: !!profileSystemPrompt
      });
      // Remove general welcome or old cached welcome if it exists
      if (hasGeneralWelcome || hasOldWelcome) {
        console.log('🗑️ Removing old/general welcome message to replace with new lesson welcome');
        // Clear messages via ChatContainer ref if available
        if (chatContainerRef.current?.clearMessages) {
          chatContainerRef.current.clearMessages();
        }
        setMessages([]);
        return; // Will trigger useEffect again with empty messages
      }

      console.log('👋 Generating welcome message for lesson chat with course:', personalizedCourseData.courseInfo?.title || 'Unknown');
      console.log('📚 LLM Context available:', !!llmContext);
      console.log('📝 Profile System Prompt:', profileSystemPrompt?.substring(0, 100) || 'Not available');

      // Generate welcome message using AI
      const generateWelcomeMessage = async () => {
        try {
          setIsLoading(true);

          // Формируем контекст профиля ученика для персонализации
          const studentContext = llmContext ? `
КОНТЕКСТ УЧЕНИКА (используйте для персонализации):
${llmContext.student?.name ? `- Имя ученика: ${llmContext.student.name}` : ''}
${llmContext.learningProfile?.subjectMasteryPercentage ? `- Уровень освоения предмета: ${llmContext.learningProfile.subjectMasteryPercentage}%` : ''}
${llmContext.learningProfile?.weakTopics?.length > 0 ? `- Слабые темы (требуют внимания): ${llmContext.learningProfile.weakTopics.map((t: any) => t.topic || t).join(', ')}` : ''}
${llmContext.learningProfile?.strongTopics?.length > 0 ? `- Сильные темы: ${llmContext.learningProfile.strongTopics.map((t: any) => t.topic || t).join(', ')}` : ''}
${llmContext.learningProfile?.learningStyle ? `- Стиль обучения: ${llmContext.learningProfile.learningStyle}` : ''}
${llmContext.learningProfile?.currentHomework ? `- Текущее домашнее задание: ${llmContext.learningProfile.currentHomework}` : ''}
${llmContext.currentLesson?.title ? `- Текущий урок: ${llmContext.currentLesson.title}` : ''}
${llmContext.currentLesson?.topic ? `- Тема урока: ${llmContext.currentLesson.topic}` : ''}
` : '';

          // Используем profileSystemPrompt если он есть, иначе формируем свой
          const baseSystemPrompt = profileSystemPrompt || '';

          const welcomePrompt = `ВЫ - ЮЛИЯ, ПРОФЕССИОНАЛЬНЫЙ УЧИТЕЛЬ ПО ПРЕДМЕТУ "${personalizedCourseData.courseInfo.title}" ДЛЯ ${personalizedCourseData.courseInfo.grade} КЛАССА.

${baseSystemPrompt ? `СИСТЕМНЫЕ ИНСТРУКЦИИ ИЗ ПРОФИЛЯ:
${baseSystemPrompt}

` : ''}${studentContext}

Это индивидуальное занятие${lessonSessionData ? ` (урок ${lessonSessionData.lessonNumber})` : ''}.

ВАША ЗАДАЧА - НАПИСАТЬ РАЗВЁРНУТОЕ, ТЁПЛОЕ И МОТИВИРУЮЩЕЕ ПРИВЕТСТВИЕ ДЛЯ УЧЕНИКА.

ОБЯЗАТЕЛЬНО ВКЛЮЧИТЕ В ПРИВЕТСТВИЕ:

1. **Тёплое приветствие** - поприветствуйте ученика по-дружески${llmContext?.student?.name ? ` (по имени: ${llmContext.student.name})` : ''}, создайте атмосферу доверия

2. **Представьтесь** - скажите, что вы Юлия, учитель по ${personalizedCourseData.courseInfo.title}

3. **Персонализация** (если есть данные о профиле ученика):
   ${llmContext?.learningProfile?.weakTopics?.length > 0 ? `- Упомяните, что вы помните о сложных темах и готовы помочь с ними` : '- Спросите, какие темы даются сложнее всего'}
   ${llmContext?.learningProfile?.strongTopics?.length > 0 ? `- Похвалите за успехи в сильных темах` : ''}

4. **Мотивация к обучению** - расскажите, почему ${personalizedCourseData.courseInfo.title} - это интересно и полезно:
   - Приведите 2-3 интересных факта или примера из жизни
   - Объясните, где эти знания пригодятся
   - Создайте интерес к предмету

5. **Что вы будете изучать** - кратко опишите:
   - Основные разделы предмета
   - Что обычно сложно и как вы поможете разобраться
   ${llmContext?.currentLesson?.title ? `- Сегодняшняя тема: "${llmContext.currentLesson.title}"` : ''}

6. **Предложите варианты** - спросите у ученика, что он хочет изучить:
   - Помощь с домашним заданием
   - Объяснение сложной темы
   - Подготовка к контрольной или экзамену
   - Разбор конкретного правила или задачи
   - Повторение пройденного материала

7. **Поддержка и мотивация** - скажите, что:
   - Вы объясните любую тему простыми словами
   - Будете терпеливы и поможете разобраться
   - Ученик может задавать любые вопросы

${lessonSessionData && lessonSessionData.lessonNumber > 1 && lessonSessionData.homeworks && lessonSessionData.homeworks.length > 0 ? `
ВАЖНО! На прошлом уроке было задано домашнее задание: "${lessonSessionData.homeworks[lessonSessionData.homeworks.length - 1].task}"
Обязательно упомяните это и спросите, как ученик справился с заданием!` : ''}

${llmContext?.learningProfile?.currentHomework ? `
ВАЖНО! У ученика есть текущее домашнее задание: "${llmContext.learningProfile.currentHomework}"
Спросите, как идёт выполнение!` : ''}

СТИЛЬ НАПИСАНИЯ:
- Используйте эмодзи для оживления текста (📚, ✨, 🎯, 💡, 🌟 и т.д.)
- Пишите дружелюбно, но профессионально
- Используйте списки и структурированный текст
- Обращайтесь на "ты" к ученику
- Будьте энергичны и позитивны
- Если есть данные о профиле ученика - используйте их для персонализации!

Напишите приветствие длиной 400-600 слов. Сделайте его информативным, полезным, персонализированным и мотивирующим!`;

          const response = await fetch('/api/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: welcomePrompt },
                { role: 'user', content: 'Привет! Я готов начать урок.' }
              ],
              model: 'gpt-5.1',
              temperature: 0.7,
              max_completion_tokens: 2000
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log('📥 Welcome message API response:', data);
            let welcomeMessage = data.choices?.[0]?.message?.content;

            // Check for empty response and use fallback
            if (!welcomeMessage || welcomeMessage.trim() === '') {
              console.warn('⚠️ Empty welcome message from API, using fallback');
              // Определяем, является ли курс экзаменационным
              const isExamCourse = personalizedCourseData.courseInfo.title?.includes('ЕГЭ') || personalizedCourseData.courseInfo.title?.includes('ОГЭ');
              const gradeText = isExamCourse ? '' : ` для ${personalizedCourseData.courseInfo.grade} класса`;

              welcomeMessage = `Добро пожаловать на урок по ${personalizedCourseData.courseInfo.title}!

Я Юлия, ваш учитель по предмету "${personalizedCourseData.courseInfo.title}"${gradeText}.

Скажите, пожалуйста:
- Что конкретно вы хотите изучить на этом уроке?
- Есть ли у вас вопросы по предмету?
- Нужна ли помощь с домашним заданием?

Я помогу вам разобраться в сложных темах простыми словами!`;
            }

            console.log('✅ Welcome message content:', welcomeMessage.substring(0, 100) + '...');

            // Add welcome message to chat
            const welcomeMessageObj: Message = {
              id: `welcome-${Date.now()}`,
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
              ttsPlayed: false
            };

            // Add welcome message to chat using ChatContainer ref
            if (chatContainerRef.current?.addMessage) {
              chatContainerRef.current.addMessage(welcomeMessageObj);
              console.log('✅ Welcome message added to ChatContainer');
            } else {
              // Fallback to local messages state
              setMessages([welcomeMessageObj]);
              console.log('✅ Welcome message added to local state (fallback)');
            }
          } else {
            console.error('❌ Failed to generate welcome message, status:', response.status);
            // Use fallback on error
            const fallbackMessage = `Добро пожаловать на урок по ${personalizedCourseData.courseInfo.title}!

Я Юлия, ваш учитель. Что бы вы хотели изучить сегодня?`;

            const welcomeMessageObj: Message = {
              id: `welcome-fallback-${Date.now()}`,
              role: 'assistant',
              content: fallbackMessage,
              timestamp: new Date(),
              ttsPlayed: false
            };

            if (chatContainerRef.current?.addMessage) {
              chatContainerRef.current.addMessage(welcomeMessageObj);
            } else {
              setMessages([welcomeMessageObj]);
            }
          }
        } catch (error) {
          console.error('❌ Error generating welcome message:', error);
        } finally {
          setIsLoading(false);
        }
      };

      generateWelcomeMessage();
    }
  }, [personalizedCourseData, lessonSessionData, messages, isLessonMode, llmContext, profileSystemPrompt, isLoadingProfile]);

  // Generate general welcome message for plain chat (no course context)
  useEffect(() => {
    // Check mode from URL params directly (not from state, which updates asynchronously)
    const modeFromParams = searchParams.get('mode');
    const isLessonModeFromParams = modeFromParams === 'lesson';
    
    // If this is regular chat with no course data and no messages, show general welcome
    // IMPORTANT: Don't show general welcome if we're in lesson mode (even if data is still loading)
    if (!personalizedCourseData && !lessonSessionData && messages.length === 0 && !isLessonModeFromParams && !isLessonMode) {
      console.log('👋 Generating general welcome message for plain chat');

      const generalWelcomeMessage: Message = {
        id: `general-welcome-${Date.now()}`,
        role: 'assistant',
        content: `Привет! 👋 Я Юлия, твой персональный учитель по всем школьным предметам.

Я могу помочь тебе с:
• 📚 Объяснением сложных тем
• ✏️ Решением домашних заданий
• 🎯 Подготовкой к контрольным и экзаменам
• ❓ Ответами на любые вопросы по учебе

Расскажи, с каким предметом или темой тебе нужна помощь?`,
        timestamp: new Date(),
        ttsPlayed: false
      };

      setMessages([generalWelcomeMessage]);
      console.log('✅ General welcome message added to plain chat');
    }
  }, [personalizedCourseData, lessonSessionData, messages.length, isLessonMode, searchParams]);

  // Auto-generate lesson when both conditions are met
  useEffect(() => {
    if (isLessonMode && autoGenerateLesson && currentLesson && !lessonStarted) {
      console.log('🎯 Auto-generating lesson: conditions met');
      console.log('Current lesson:', currentLesson);
      generateLessonPlan();
      setAutoGenerateLesson(false); // Reset flag
    }
  }, [isLessonMode, autoGenerateLesson, currentLesson, lessonStarted]);

  // Generate lesson plan using AI
  const generateLessonPlan = async () => {
    console.log('🎯 generateLessonPlan called');
    console.log('Current lesson:', currentLesson);

    if (!currentLesson) {
      console.error('❌ No current lesson found!');
      return;
    }

    setIsGeneratingPlan(true);
    setGenerationStep('Анализирую тему урока...');

    // Simulate thinking steps with delays
    setTimeout(() => setGenerationStep('Изучаю тему и учебный материал...'), 600);
    setTimeout(() => setGenerationStep('Анализирую уровень сложности и возраст ученика...'), 1200);
    setTimeout(() => setGenerationStep('Определяю учебные цели и задачи...'), 1800);
    setTimeout(() => setGenerationStep('Структурирую содержание урока...'), 2400);
    setTimeout(() => setGenerationStep('Создаю практические задания и упражнения...'), 3000);
    setTimeout(() => setGenerationStep('Формирую итоговый план обучения...'), 3600);

    try {
      const prompt = `Создай подробный и качественный урок для ученика по теме: "${currentLesson.title}" (${currentLesson.topic}).

Тема урока: ${currentLesson.aspects || currentLesson.description}

ВАЖНЫЕ ТРЕБОВАНИЯ К КОНТЕНТУ:
- Пиши ПОЛНЫЕ и РАЗВЕРНУТЫЕ объяснения (минимум 800-1000 слов для content)
- Используй простой и понятный язык для учеников
- ВКЛЮЧАЙ множество конкретных примеров из жизни
- Делай текст увлекательным и мотивирующим
- Избегай сокращений и сленга
- Пиши грамотно, без ошибок

Создай урок в формате JSON со следующей структурой:
{
  "title": "Название урока",
  "objective": "Цель урока (3-4 полных предложения)",
  "duration": "Продолжительность урока в минутах (рекомендуемая 45-60)",
  "materials": ["список необходимых материалов с подробностями"],
  "content": "ОЧЕНЬ ПОДРОБНЫЙ конспект урока (минимум 800 слов) с полными объяснениями, множеством примеров, историческими фактами и практическими приложениями. Раздели на разделы с заголовками.",
  "practice": [
    {
      "type": "exercise|question|task",
      "description": "Подробное описание упражнения или задания (минимум 100 слов)",
      "example": "Полный пример выполнения с объяснениями"
    }
  ],
  "assessment": "Подробные вопросы для проверки понимания (минимум 5 вопросов) с правильными ответами"
}

Урок должен быть написан для ученика среднего уровня, мотивировать на изучение и содержать всю необходимую информацию для глубокого понимания темы.`;

      setGenerationStep('🚀 Отправляю запрос к ИИ...');
      console.log('📤 Sending API request for lesson plan...');
      console.log('Prompt length:', prompt.length);

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_completion_tokens: 4000
        })
      });

      setGenerationStep('📥 Обрабатываю ответ от ИИ...');

      console.log('📥 API response status:', response.status);

      if (!response.ok) {
        // Handle specific API key error
        if (response.status === 500) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.message && errorData.message.includes('OpenAI API key not properly configured')) {
            throw new Error('OpenAI API ключ не настроен. Пожалуйста, настройте правильный API ключ в файле .env');
          }
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API response data:', data);

      const planText = data.choices[0].message.content;
      console.log('📝 Plan text from AI:', planText);
      console.log('📏 Plan text length:', planText.length);

      // Parse JSON from response
      const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/) || planText.match(/\{[\s\S]*\}/);
      const planJson = jsonMatch ? jsonMatch[1] || jsonMatch[0] : planText;
      console.log('🔧 Extracted JSON:', planJson);
      console.log('🔍 JSON extraction method:', jsonMatch ? (jsonMatch[1] ? 'code block' : 'direct object') : 'raw text');

      try {
        const plan = JSON.parse(planJson);
        console.log('✅ Successfully parsed lesson plan:', plan);

        // Convert new format to steps-based format for compatibility
        const steps = [];

        // Main content step
        if (plan.content) {
          steps.push({
            step: 1,
            type: "content",
            title: "Основной материал",
            description: plan.content,
            duration: Math.floor(parseInt(plan.duration) * 0.6) || 30,
            content: plan.content
          });
        }

        // Practice steps
        if (plan.practice && plan.practice.length > 0) {
          plan.practice.forEach((practice: any, index: number) => {
            steps.push({
              step: steps.length + 1,
              type: "practice",
              title: `Практика ${index + 1}: ${practice.type}`,
              description: practice.description,
              duration: Math.floor(parseInt(plan.duration) * 0.2 / plan.practice.length) || 5,
              content: `${practice.description}\n\nПример: ${practice.example}`
            });
          });
        }

        // Assessment step
        if (plan.assessment) {
          steps.push({
            step: steps.length + 1,
            type: "assessment",
            title: "Проверка знаний",
            description: plan.assessment,
            duration: Math.floor(parseInt(plan.duration) * 0.2) || 10,
            content: plan.assessment
          });
        }

        // Validate we have at least one step
        if (steps.length === 0) {
          console.warn('⚠️ No steps generated, using fallback plan');
          throw new Error('No steps could be generated from lesson plan');
        }

        // Validate steps array
        console.log('✅ Steps array created:', {
          length: steps.length,
          steps: steps.map(s => ({ step: s.step, type: s.type, title: s.title }))
        });

        if (!Array.isArray(steps) || steps.length === 0) {
          throw new Error('Invalid steps array or no steps generated');
        }

        // Create compatible plan structure
        const compatiblePlan = {
          ...plan,
          steps: steps
        };

        console.log('🔄 Converted to compatible format with', steps.length, 'steps');
        
        // Verify steps are accessible
        if (!compatiblePlan.steps || !Array.isArray(compatiblePlan.steps)) {
          throw new Error('Steps array is missing or not an array in compatible plan');
        }

        console.log('📊 Total steps in plan:', compatiblePlan.steps.length);
        console.log('🔍 First step details:', {
          exists: !!compatiblePlan.steps[0],
          title: compatiblePlan.steps[0]?.title,
          type: compatiblePlan.steps[0]?.type
        });

        setGenerationStep('✨ Завершаю подготовку урока...');

        // Store plan in state
        console.log('💾 Setting lessonPlan in state...');
        setLessonPlan(compatiblePlan);

        // Auto-start lesson with first step
        console.log('🚀 Auto-starting lesson...');
        setLessonStarted(true);
        setCurrentLessonStep(0);

        // Generate content for first step
        const firstStep = compatiblePlan.steps[0];
        console.log('📝 First step object:', firstStep);
        
        if (!firstStep) {
          throw new Error('First step is not defined or is null');
        }

        console.log('📝 Generating content for first step:', firstStep.title);
        await generateStepContent(0, firstStep, compatiblePlan);
      } catch (parseError) {
        console.error('❌ Failed to parse lesson plan JSON:', parseError);
        console.error('Raw plan text:', planText);
        
        // Fallback: create basic plan
        const basicPlan = {
          title: currentLesson.title,
          objective: `Изучить тему: ${currentLesson.topic}`,
          duration: 45,
          materials: ["Текстовый материал", "Упражнения"],
          steps: [
            {
              step: 1,
              type: "introduction",
              title: "Введение в тему",
              description: "Знакомство с новой темой",
              duration: 10,
              content: currentLesson.aspects || currentLesson.description
            },
            {
              step: 2,
              type: "explanation",
              title: "Объяснение материала",
              description: "Подробное объяснение темы",
              duration: 20,
              content: "Основной учебный материал будет предоставлен интерактивно"
            },
            {
              step: 3,
              type: "practice",
              title: "Практика",
              description: "Закрепление изученного материала",
              duration: 10,
              content: "Практические задания"
            },
            {
              step: 4,
              type: "assessment",
              title: "Проверка понимания",
              description: "Тест на усвоение материала",
              duration: 5,
              content: "Вопросы для проверки"
            }
          ]
        };
        
        console.log('🔄 Using fallback plan with', basicPlan.steps.length, 'steps');
        setGenerationStep('✨ Завершаю подготовку урока...');
        setLessonPlan(basicPlan);
        setLessonStarted(true);
        setCurrentLessonStep(0);
        
        const firstStep = basicPlan.steps[0];
        if (firstStep) {
          console.log('📝 Generating content for fallback first step:', firstStep.title);
          await generateStepContent(0, firstStep, basicPlan);
        }
      }
      } catch (error) {
      console.error('Failed to generate lesson plan:', error);
      setGenerationError(error instanceof Error ? error.message : 'Неизвестная ошибка при генерации плана урока');
    } finally {
      setIsGeneratingPlan(false);
      setGenerationStep('');
    }
  };

  // Move to next lesson step
  const nextLessonStep = async () => {
    console.log('📚 Next lesson step called, current step:', currentLessonStep, 'total steps:', lessonPlan?.steps?.length);

    if (!lessonPlan || currentLessonStep >= lessonPlan.steps.length - 1) {
      // Lesson completed
      const completionMessage: Message = {
        id: `lesson-complete-${Date.now()}`,
        role: 'assistant',
        content: `🎉 **Урок завершен!**\n\nПоздравляю! Вы успешно прошли урок "${currentLesson?.title}".\n\n📊 **Результаты:**\n- Изучено: ${currentLesson?.topic}\n- Продолжительность: ${lessonPlan?.duration} минут\n- Шагов пройдено: ${lessonPlan?.steps?.length}\n\nХотите перейти к следующему уроку или повторить материал?`,
        timestamp: new Date(),
        ttsPlayed: false
      };
      setMessages(prev => [...prev, completionMessage]);
      return;
    }

    const nextStepIndex = currentLessonStep + 1;
    const nextStep = lessonPlan.steps[nextStepIndex];
    setCurrentLessonStep(nextStepIndex);

    // Reset section index for new lesson step
    setCurrentSectionIndex(0);

    await generateStepContent(nextStepIndex, nextStep, lessonPlan);
  };

  // Handle answer to lesson task
  const handleLessonTaskAnswer = async (answer: string) => {
    console.log('📝 Handling lesson task answer:', answer);

    // Add user answer to chat
    const userMessage: Message = {
      id: `user-answer-${Date.now()}`,
      role: 'user',
      content: answer,
      timestamp: new Date(),
      ttsPlayed: false
    };

    if (chatContainerRef.current?.addMessage) {
      chatContainerRef.current.addMessage(userMessage);
    } else {
      setMessages(prev => [...prev, userMessage]);
    }

    // Move to next section or complete lesson step
    const nextSectionIndex = currentSectionIndex + 1;
    if (nextSectionIndex < currentLessonSections.length) {
      // Show next section
      const nextSection = currentLessonSections[nextSectionIndex];
      let sectionContent = `🎓 **${nextSection.title}**\n\n${nextSection.content}`;

      // Add examples if they exist
      if (nextSection.examples && nextSection.examples.length > 0) {
        nextSection.examples.forEach((example, idx) => {
          sectionContent += `\n\n📝 Пример ${idx + 1}: ${example.example}\n`;
          if (example.explanation) {
            sectionContent += `💡 ${example.explanation}`;
          }
        });
      }

      // Add practice inside if it exists
      if (nextSection.practiceInside) {
        sectionContent += `\n\n💪 Практическое задание: ${nextSection.practiceInside.instruction}`;
        if (nextSection.practiceInside.hint) {
          sectionContent += `\n💡 Подсказка: ${nextSection.practiceInside.hint}`;
        }
      }

      // Add mistakes if they exist
      if (nextSection.mistakes && nextSection.mistakes.length > 0) {
        nextSection.mistakes.forEach((mistake) => {
          sectionContent += `\n\n⚠️ Ошибка: ${mistake.mistake}\n`;
          sectionContent += `💡 ${mistake.explanation}`;
        });
      }

      // Add tasks if they exist
      if (nextSection.tasks && nextSection.tasks.length > 0) {
        sectionContent += `\n\n📋 Практические упражнения:`;
        nextSection.tasks.forEach((task, idx) => {
          sectionContent += `\n\n${idx + 1}. ${task.task}`;
          if (task.hint) {
            sectionContent += `\n💡 Подсказка: ${task.hint}`;
          }
        });
      }

      // Add summary if it exists
      if (nextSection.summary) {
        sectionContent += `\n\n📌 Резюме: ${nextSection.summary}`;
      }

      const teacherMessage: Message = {
        id: `lesson-section-${nextSectionIndex}-${Date.now()}`,
        role: 'assistant',
        content: sectionContent,
        timestamp: new Date(),
        ttsPlayed: false
      };

      if (chatContainerRef.current?.addMessage) {
        chatContainerRef.current.addMessage(teacherMessage);
      } else {
        setMessages(prev => [...prev, teacherMessage]);
      }

      // TTS for next section
      if (isTTSAvailable() && isTtsEnabled) {
        try {
          await OpenAITTS.speak(sectionContent, {});
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
        }
      }

      setCurrentSectionIndex(nextSectionIndex);
      // For now, use the first task if available
      const nextTask = nextSection.tasks && nextSection.tasks.length > 0 ? nextSection.tasks[0] : null;
      setCurrentSectionTask(nextTask);
      setWaitingForAnswer(!!nextTask);
    } else {
      // All sections completed - move to next lesson step
      setWaitingForAnswer(false);
      setCurrentSectionTask(null);
      await nextLessonStep();
    }
  };

  // Handle user transcript with question detection
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef<number>(0);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserTranscript = useCallback(async (text: string, isFinal: boolean) => {
    console.log('🔍 handleUserTranscript called:', { text, isFinal });
    
    if (!isFinal || !text.trim()) {
      console.log('⏭️ Skipping: not final or empty');
      return;
    }
    
    // 1. Cancel any pending processing or speech
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    if (abortControllerRef.current) {
      console.log('🚫 Aborting previous request due to new input');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    OpenAITTS.stop(); // Ensure TTS is stopped
    
    // 2. Update Request ID to ignore stale responses
    const currentRequestId = ++latestRequestIdRef.current;
    
    console.log('📝 User said (final):', text);
    setCallTranscript(prev => prev + (prev ? ' ' : '') + text);
    
    // 3. Smart History Update: Combine with previous if it was pending
    setConversationHistory(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'student') {
         // Если предыдущее сообщение ученика, но мы уже получили ответ учителя на него, то это новое сообщение
         // Проверяем, было ли сообщение ученика последним в истории
         // Но здесь логика немного сложнее: мы хотим объединять, только если ответ еще не получен
         
         // В данной реализации мы просто добавляем новое сообщение, так как предыдущее уже могло быть обработано
         // или мы хотим разделить их логически
         return [...prev, { role: 'student', text: text }];
      } else {
         return [...prev, { role: 'student', text: text }];
      }
    });

        // Generate next step in conversation
    console.log('🎯 Generating next conversation step...');

    // Small debounce to allow rapid-fire sentences to merge before sending
    processingTimeoutRef.current = setTimeout(async () => {
        const startTime = Date.now();
        try {
          console.log('⏱️ [TIMING] T+0ms: Function started');

          // Skip processing if this is just the initial greeting response
          if (text.toLowerCase().includes('ничего') || text.toLowerCase().includes('nothing')) {
            console.log('🚫 Skipping greeting response for "ничего" - continuing with lesson content');
            setIsProcessingQuestion(false);
            return;
          }

          setIsProcessingQuestion(true);

          const controller = new AbortController();
          abortControllerRef.current = controller;
          
          // Use Ref to get latest history
          const context = historyRef.current.slice(-4).map(h =>
            `${h.role === 'teacher' ? 'Юля' : 'Ученик'}: ${h.text}`
          ).join('\n');
          
          console.log('⏱️ [TIMING] T+' + (Date.now() - startTime) + 'ms: Context prepared');
          
          const lastStudentMsg = historyRef.current[historyRef.current.length - 1];
          const textToSend = lastStudentMsg?.role === 'student' ? lastStudentMsg.text : text;

          // Build system prompt with learning profile context
          const buildSystemPrompt = () => {
            // Получаем название курса из конфига
            const courseTitle = getFullCourseTitle(courseIdFromParams || 'general', 0);
            const { subject } = parseCourseId(courseIdFromParams || 'general');
            const courseConfig = getCourseById(subject);

            // Для экзаменационных курсов используем специальный формат промпта
            let subjectName = courseConfig?.title || subject;
            if (courseIdFromParams?.startsWith('ЕГЭ-') || courseIdFromParams?.startsWith('ОГЭ-')) {
              const examType = courseIdFromParams.startsWith('ЕГЭ-') ? 'ЕГЭ' : 'ОГЭ';
              subjectName = `${courseConfig?.title || subject} ${examType}`;
            }

            // Формируем базовый промпт с названием курса
            const basePrompt = `Ты - Юля, профессиональный школьный учитель с 15-летним стажем.

📚 ТВОЙ ТЕКУЩИЙ КУРС: "${courseTitle}"

Твоя главная задача - помогать ученику по предмету "${subjectName}".
Ты должна:
- Отвечать на вопросы ученика по темам этого курса
- Объяснять материал простым и понятным языком
- Задавать домашние задания по теме курса
- Помогать с выполнением домашних заданий
- Выявлять проблемные темы и работать над ними

Если ученик спрашивает о теме, которая не входит в программу "${courseTitle}", 
объясни, что эта тема изучается на других уровнях, но ты можешь дать базовое объяснение.`;
            
            // Добавляем контекст профиля обучения
            let profileContext = '';
            if (llmContext?.learningProfile) {
              const lp = llmContext.learningProfile;
              
              profileContext += '\n\n👤 ПРОФИЛЬ УЧЕНИКА ПО ЭТОМУ КУРСУ:';
              
              if (lp.weakTopics && lp.weakTopics.length > 0) {
                const unresolvedWeakTopics = lp.weakTopics.filter(t => !t.resolved);
                if (unresolvedWeakTopics.length > 0) {
                  profileContext += `\n⚠️ ПРОБЛЕМНЫЕ ТЕМЫ (уделяй особое внимание):`;
                  unresolvedWeakTopics.forEach(t => {
                    profileContext += `\n  - ${t.topic}${t.details ? `: ${t.details}` : ''}`;
                  });
                }
              }
              
              if (lp.strongTopics && lp.strongTopics.length > 0) {
                profileContext += `\n✅ СИЛЬНЫЕ СТОРОНЫ:`;
                lp.strongTopics.forEach(t => {
                  profileContext += `\n  - ${t.topic} (${t.masteryLevel}%)`;
                });
              }
              
              if (lp.currentHomework && lp.currentHomeworkStatus === 'pending') {
                profileContext += `\n📝 ТЕКУЩЕЕ ДОМАШНЕЕ ЗАДАНИЕ: ${lp.currentHomework}`;
                profileContext += `\n   (Напомни ученику о ДЗ, если он не выполнил)`;
              }
              
              if (lp.learningPace) {
                const paceMap: Record<string, string> = {
                  slow: 'медленный - объясняй подробнее и давай больше примеров',
                  normal: 'нормальный',
                  fast: 'быстрый - можно давать больше материала'
                };
                profileContext += `\n📊 Темп обучения: ${paceMap[lp.learningPace] || lp.learningPace}`;
              }

              // Добавляем заметки учителя
              if (lp.recentTeacherNotes && lp.recentTeacherNotes.length > 0) {
                profileContext += `\n📋 ЗАМЕТКИ ИЗ ПРОШЛЫХ УРОКОВ:`;
                lp.recentTeacherNotes.slice(-3).forEach(note => {
                  profileContext += `\n  - ${note.note}`;
                });
              }
            }
            
            return `${basePrompt}
${profileContext}

🎯 ТВОЙ ПОДХОД К ОБУЧЕНИЮ:
- Объясняй "на пальцах" - используй простые аналогии из жизни
- Разбивай сложные темы на понятные шаги
- Задавай вопросы для проверки понимания
- Хвали за успехи и мягко указывай на ошибки
- Если видишь проблему - добавь её в список проблемных тем

${currentLesson ? `📖 ТЕКУЩИЙ УРОК: "${currentLesson.title}" - ${currentLesson.topic}
План: ${currentLesson.aspects || 'Изучаем тему урока'}` : ''}

КОНТЕКСТ РАЗГОВОРА:
${context}

УЧЕНИК СКАЗАЛ: "${textToSend}"

Ответь как учитель по курсу "${courseTitle}". Будь дружелюбной, но профессиональной.`;
          };
          
          const systemPrompt = buildSystemPrompt();

          console.log('⏱️ [TIMING] T+' + (Date.now() - startTime) + 'ms: Prompt prepared, starting API call');

          const response = await fetch('/api/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Ученик только что сказал: "${textToSend}". Продолжи урок.` }
              ],
              model: 'gpt-5.1',
              temperature: 0.7,
              max_completion_tokens: 300
            }),
            signal: controller.signal
          });

          console.log('⏱️ [TIMING] T+' + (Date.now() - startTime) + 'ms: API response received');

          if (response.ok) {
            const data = await response.json();
            console.log('⏱️ [TIMING] T+' + (Date.now() - startTime) + 'ms: Response parsed');
            const teacherResponse = data.choices[0].message.content;
            console.log('✅ Teacher response:', teacherResponse);
            console.log('⏱️ [TIMING] T+' + (Date.now() - startTime) + 'ms: TOTAL TIME');

            if (controller.signal.aborted) return;

            setConversationHistory(prev => [...prev, { role: 'teacher', text: teacherResponse }]);
            
            // 🎯 Analyze LLM response and update learning profile
            // Only analyze if we have valid courseId and userId
            const isValidCourseId = courseIdFromParams && 
              courseIdFromParams !== 'NaN' && 
              courseIdFromParams !== 'null' && 
              courseIdFromParams !== 'undefined' &&
              courseIdFromParams.trim() !== '';
            if (isValidCourseId && userIdFromStorage) {
              analyzeAndUpdateFromLLM(teacherResponse, textToSend).catch(err => {
                console.error('Failed to update learning profile:', err);
              });
            }
            
            await OpenAITTS.speak(teacherResponse, {
              voice: 'nova',
              speed: 1.0
            });
            // Start listening after TTS completes
                setTimeout(() => {
                  VoiceComm.startListening();
              }, 1000);
          }
        } catch (error) {
            const err = error as Error;
            if (err.name === 'AbortError') {
                 console.log('🛑 Request aborted');
            } else {
                 console.error('❌ Error generating teacher response:', err);
            }
        } finally {
          if (currentRequestId === latestRequestIdRef.current) {
          setIsProcessingQuestion(false);
             abortControllerRef.current = null;
          }
        }
      }, 500);
  }, [conversationHistory, currentLesson]);
  
  const historyRef = useRef(conversationHistory);
  useEffect(() => { historyRef.current = conversationHistory; }, [conversationHistory]);
  const generateLessonNotesStreaming = useCallback(async (): Promise<string[]> => {
    console.log('📝 Starting streaming lesson generation...');
    setIsGeneratingLesson(true);
    setLessonStreamText('');
    setLessonGenerationComplete(false);

    try {
      const systemPrompt = `Ты - Юля, профессиональный педагог и методист с 15-летним опытом преподавания английского языка. Ты - мастер создания увлекательных уроков, которые ученики действительно хотят проходить.

ТВОЯ СПЕЦИАЛИЗАЦИЯ:
Создание персонализированных уроков английского языка, адаптированных под конкретного ученика, его уровень и интересы.

ПЕДАГОГИЧЕСКАЯ ЭКСПЕРТИЗА:
🎯 Диагностика уровня: Определяешь уровень ученика по первым ответам
🧠 Когнитивная психология: Используешь принципы эффективного обучения
📚 Методология: Применяешь современные методики преподавания
🎭 Психология: Мотивируешь и поддерживаешь учеников
🌟 Индивидуализация: Адаптируешь материал под конкретного человека

СТРАТЕГИИ ПРИВЕТСТВИЯ:
1. 🔥 Эмоциональное вовлечение: Начинай с энтузиазма и интереса
2. 🎯 Персонализация: Используй имя темы для создания связи
3. 📋 Планирование: Кратко опиши что будем изучать
4. 💪 Мотивация: Создай ожидание пользы и удовольствия
5. 🤝 Установление контакта: Покажи, что ты здесь, чтобы помочь

ФОРМАТ ПРИВЕТСТВИЯ:
- Будь живой и дружелюбной (используй эмодзи, восклицательные знаки)
- Покажи энтузиазм по теме
- Кратко расскажи о пользе урока
- Задай вопрос, чтобы начать диалог
- Используй обращение "мы" для создания команды

ПРИМЕР ХОРОШЕГО ПРИВЕТСТВИЯ:
"Привет! Я Юля, и мы с тобой сегодня разберемся с артиклями в английском! Это как дорожные знаки в языке - без них легко запутаться, но с ними все становится ясно! 🎯 Готов начать наше путешествие в мир артиклей?"

Создай персонализированное приветствие для темы "\${currentLesson?.title || 'Урок'}" (\${currentLesson?.topic || 'Тема'}).

Верни ответ в формате JSON массива строк, где ПЕРВЫЙ элемент - приветствие от Юли.`;

      const initialMessage = `Давай начнем урок по теме "\${currentLesson?.title || 'Урок'}". Поздоровайся, представься (Юлия) и кратко скажи, чем мы будем заниматься.`;

      const prompt = initialMessage;

          const response = await fetch('/api/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
            { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              model: 'gpt-5.1',
              temperature: 0.7,
          max_completion_tokens: 300
            })
          });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
      const rawContent = data.choices[0].message.content;
      console.log('📥 Raw greeting response:', rawContent);

      // Parse JSON response - expect simple array with greeting
      let notes;
      try {
        // Remove markdown code blocks if present
        let cleanedText = rawContent.replace(/```json\\s*/g, '').replace(/```\\s*$/g, '').trim();

        const parsed = JSON.parse(cleanedText);

        if (!Array.isArray(parsed)) {
          throw new Error('Parsed result is not an array');
        }

        notes = parsed;

        if (!notes || notes.length === 0) {
          throw new Error('Empty greeting');
        }

        console.log('✅ Generated greeting:', notes);
        return notes;

      } catch (parseError) {
        console.warn('❌ Failed to parse greeting JSON:', parseError);
        // Simple fallback greeting
        const fallbackNotes = ['Привет! Я Юля. Давай начнем урок!'];
        console.log('💬 Using fallback greeting:', fallbackNotes);
        return fallbackNotes;
      }

        } catch (error) {
      console.error('❌ Failed to generate greeting:', error);
      // Fallback greeting from Юля
      const fallbackNotes = ['Привет! Я Юля. Давай начнем урок!'];
      return fallbackNotes;
    } finally {
      setIsGeneratingLesson(false);
    }
  }, [currentLesson]);

  // Generate lesson notes for call
  const generateLessonNotesForCall = useCallback(async () => {
    try {
      console.log('📝 Generating lesson notes for call...');

      const systemPrompt = `Ты - Юля, элитный педагог мирового уровня. Ты сочетаешь академическую глубину знаний с невероятной харизмой и чувством юмора.
      
ТВОЙ СТИЛЬ:
🌟 Профессионализм: Ты знаешь предмет лучше Википедии, но говоришь на языке ученика.
❤️ Чуткость: Ты чувствуешь, когда ученик устал или не понимает, и мгновенно меняешь подход.
🧠 Интеллект: Ты используешь свой ум, чтобы упрощать, а не усложнять. Ты можешь объяснить теорию относительности на примере пончиков.
😄 Юмор: Ты шутишь тонко и к месту. Смех - твое секретное оружие против скуки.
👌 Простота: Твой девиз - "Если это нельзя объяснить на пальцах, значит, я сама этого не понимаю".

ТВОЯ МИССИЯ:
Влюбить ученика в предмет. Превратить урок из обязаловки в самое интересное событие дня.

СТРАТЕГИИ ПРИВЕТСТВИЯ:
1. 🔥 Вау-эффект: Начни с факта, который взрывает мозг.
2. 🤝 Друг-наставник: Говори так, будто вы знакомы сто лет.
3. 🤣 Добрая ирония: Пошути над сложностью темы, чтобы она перестала пугать.

ПРИМЕР ХОРОШЕГО ПРИВЕТСТВИЯ:
"Привет! Я Юля! Говорят, эта тема пугает даже взрослых, но мы с тобой разберем ее на атомы и соберем обратно так, что все обзавидуются! Готов стать гением за 15 минут?"

Создай персонализированное приветствие для темы "${currentLesson?.title || 'Урок'}" (${currentLesson?.topic || 'Тема'}).

Верни ответ в формате JSON массива строк, где ПЕРВЫЙ элемент - приветствие от Юли.`;

      const initialMessage = `Давай начнем урок по теме "${currentLesson?.title || 'Урок'}". Поздоровайся, представься (Юлия) и кратко скажи, чем мы будем заниматься.`;

          const response = await fetch('/api/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: initialMessage
            }
              ],
              model: 'gpt-5.1',
          temperature: 0.7,
          max_completion_tokens: 300
            })
          });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

            const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // Parse JSON response or use fallback
      try {
        const notes = JSON.parse(content);
        if (Array.isArray(notes) && notes.length > 0) {
          console.log('✅ Приветствие от Юли:', notes[0].substring(0, 50));
          setLessonNotes(notes);
          console.log('📝 Lesson notes generated:', notes.length, 'items');
        } else {
          // Fallback greeting
          setLessonNotes(['Привет! Я Юля. Давай начнем урок!']);
          console.log('✅ Fallback greeting used');
        }
      } catch (parseError) {
        // Fallback greeting
        setLessonNotes(['Привет! Я Юля. Давай начнем урок!']);
        console.log('✅ Fallback greeting used (parse error)');
      }

        } catch (error) {
      console.error('Error generating lesson greeting:', error);
      // Fallback greeting
      setLessonNotes(['Привет! Я Юля. Давай начнем урок!']);
      console.log('✅ Fallback greeting used (error)');
    } finally {
      setIsProcessing(false);
      setIsGeneratingLesson(false);
    }
  }, [currentLesson]);

  // Speak greeting and start interactive chat
  const speakGreetingAndStartChat = useCallback(async (greeting: string) => {
    try {
      console.log('🎤 Speaking greeting:', greeting.substring(0, 50) + '...');
      setIsLessonSpeaking(true);

      // Speak the greeting
      console.log('🎤 Greeting TTS started');
      await OpenAITTS.speak(greeting, {
        voice: 'nova',
        speed: 1.0
      });
          console.log('✅ Greeting TTS ended, starting voice recognition');
        setIsLessonSpeaking(false);

          // After greeting, immediately start voice recognition for user response
          try {
            await VoiceComm.startListening();
          } catch (error) {
            console.error('❌ Failed to start voice recognition after greeting:', error);
          }
    } catch (error) {
      console.error('❌ Failed to speak greeting:', error);
      setIsLessonSpeaking(false);
    }
  }, []);

  // Save lesson session to database
  const saveLessonSession = async (notes: string[]) => {
    try {
      console.log('💾 Saving lesson session to database...');
      const response = await fetch('/api/lesson-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
          user_id: null, // можно добавить user_id если есть авторизация
          course_name: personalizedCourseData?.courseName || 'Unknown Course',
          lesson_title: currentLesson?.title || 'Unknown Lesson',
          lesson_topic: currentLesson?.topic || '',
          lesson_number: currentLesson?.number || null,
          lesson_notes: notes,
          current_note_index: currentNoteIndex,
          call_transcript: callTranscript
                })
              });

              if (response.ok) {
                const data = await response.json();
        setCurrentSessionId(data.session_id);
        console.log('✅ Lesson session saved, ID:', data.session_id);
              } else {
        console.error('❌ Failed to save session:', await response.text());
      }
            } catch (error) {
      console.error('❌ Error saving session:', error);
    }
  };

  // Update lesson progress in database
  const updateLessonProgress = async (noteIndex: number, transcript?: string) => {
    if (!currentSessionId) return;
    
    try {
      await fetch(`/api/lesson-sessions/${currentSessionId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_note_index: noteIndex,
          call_transcript: transcript || callTranscript
        })
      });
      console.log('✅ Progress updated:', noteIndex);
    } catch (error) {
      console.error('❌ Error updating progress:', error);
    }
  };

  // Complete lesson session
  const completeLessonSession = async () => {
    if (!currentSessionId) return;
    
    try {
      await fetch(`/api/lesson-sessions/${currentSessionId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Lesson session completed');
      setCurrentSessionId(null);
    } catch (error) {
      console.error('❌ Error completing session:', error);
    }
  };

  // Handle text message input
  const handleTextMessage = async (message: string) => {
    if (!message.trim() || isProcessingTextMessage) return;

    console.log('💬 Processing text message:', message);

    setIsProcessingTextMessage(true);
    const userMessage = message.trim();
    setTextMessage('');

    try {
      // Add to conversation history
      setConversationHistory(prev => [...prev, { role: 'student', text: userMessage }]);

      // Get lesson context
      const lessonContext = lessonNotes.slice(0, currentNoteIndex + 1).join(' ');

      const prompt = `Ты - Юля, профессиональный школьный учитель. Твоя главная задача - ВЕСТИ УРОК ПО ПЛАНУ и объяснять все "на пальцах" - доступно и понятно, чтобы каждый ученик мог легко понять материал.

ТВОЙ ПРОФЕССИОНАЛЬНЫЙ ПОДХОД К ОБУЧЕНИЮ:

🎯 ТЫ ВЕДЕШЬ УРОК: Рассказывай теорию простым языком, объясняй темы "на пальцах", задавай вопросы для проверки понимания.
📚 СТРУКТУРА УРОКА: Сначала объясняй материал "на пальцах" с примерами из жизни, потом спрашивай у ученика.
🚫 НЕ ЖДИ ВОПРОСОВ: Ты ведешь урок, ты задаешь вопросы.

КАК ОБЪЯСНЯТЬ "НА ПАЛЬЦАХ" (ТВОЯ ГЛАВНАЯ СУПЕРСИЛА):
- Используй простые аналогии из повседневной жизни (например: "Представь, что это как...")
- Разбивай сложные концепции на маленькие, понятные шаги
- Приводи конкретные примеры, которые ученик может легко представить
- Избегай сложных терминов без объяснения - если нужно использовать термин, сначала объясни его простыми словами
- Связывай новое с уже известным ученику
- Показывай, как знания применяются в реальной жизни

ПРАВИЛА ПРОВЕДЕНИЯ УРОКА:
1. РАССКАЗЫВАЙ ТЕОРИЮ: Объясняй темы из плана урока простым, понятным языком "на пальцах", с примерами из жизни.
2. ЗАДАВАЙ ВОПРОСЫ: После объяснения спрашивай у ученика, понял ли он.
3. ПРОВЕРЯЙ ОТВЕТЫ: Анализируй, правильно ли ответил ученик.
4. ЕСЛИ ОТВЕТ НЕВЕРНЫЙ: Скажи "Не совсем так" мягко и поддерживающе, объясни ошибку "на пальцах" с простым примером, переспроси.
5. ЕСЛИ ОТВЕТ НЕПОНЯТЕН: Объясни по-другому, используя другой пример или аналогию.
6. ЕСЛИ ОТВЕТ ПРАВИЛЬНЫЙ: Кратко похвали и переходи к следующему.
7. СЛЕДУЮЩИЙ ШАГ: После проверки всегда переходи к следующему пункту плана.

ТЕКУЩИЙ УРОК: "${currentLesson?.title || 'Урок географии'}" (${currentLesson?.topic || 'Формы Земли'})
ПЛАН ТЕКУЩЕГО УРОКА: ${currentLesson?.aspects || 'Изучаем основы географии, формы Земли, карты и глобусы'}

КОНТЕКСТ УРОКА:
${lessonContext}

НЕДАВНИЙ РАЗГОВОР:
${conversationHistory.slice(-3).map(h => `${h.role === 'teacher' ? 'Юля' : 'Ученик'}: ${h.text}`).join('\n')}

УЧЕНИК СПРОСИЛ: "${userMessage}"

ИНСТРУКЦИЯ ДЛЯ ОТВЕТА:
1. Если ученик ответил на твой вопрос: Оцени правильность и переходи дальше.
2. Если ученик спросил что-то: Ответь кратко и верни к плану урока.
3. Всегда заканчивай объяснением материала или вопросом для проверки.
4. Переходи к следующему пункту плана, когда ученик понял предыдущий.`;

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        messages: [
            { role: 'system', content: `Ты - Юля, профессиональный школьный учитель. Твоя главная цель - УЧИТЬ, объясняя все "на пальцах" - доступно и понятно.

ИНФОРМАЦИЯ О ДОСТУПНЫХ РЕЖИМАХ ОБУЧЕНИЯ:
- Это голосовое обучение с Юлией - естественное общение и голосовые ответы
- Одновременно доступно текстовое обучение с ИИ-учителем - подробные объяснения и мгновенные ответы
- Ученик может переключаться между голосовым и текстовым режимом в любое время
- Говорите естественно, получайте живые ответы и объяснения

ТВОЙ ПРОФЕССИОНАЛЬНЫЙ ПОДХОД:
1. Строго соблюдай тему урока: "${currentLesson?.title || 'Урок географии'}" (${currentLesson?.topic || 'Формы Земли'}). Вопросы не по теме - откладывай.
2. Объясняй все "на пальцах": используй простые аналогии, примеры из жизни, разбивай сложное на простые шаги.
3. Честно оценивай ответы. Если ученик ошибается - ПОПРАВЛЯЙ его мягко и поддерживающе, объясни ошибку "на пальцах" с простым примером.
4. Если речь неразборчива - переспрашивай.
5. Будь дружелюбной, терпеливой и поддерживающей, но требовательной к пониманию материала.
6. Всегда используй простой, понятный язык - как будто объясняешь другу.` },
            { role: 'user', content: prompt }
        ],
          model: 'gpt-5.1',
          temperature: 0.7,
          max_completion_tokens: 300
        })
      });

      if (response.ok) {
        const data = await response.json();
        const teacherResponse = data.choices[0].message.content;

        console.log('✅ Teacher response for text message:', teacherResponse);

        // Add response to conversation history
        setConversationHistory(prev => [...prev, { role: 'teacher', text: teacherResponse }]);

        // Add response to lesson notes
        const newNote = `💬 ${userMessage}\n\n👩‍🏫 ${teacherResponse}`;
        const updatedNotes = [...lessonNotes];
        // Insert after current note
        const insertIndex = currentNoteIndex + 1;
        updatedNotes.splice(insertIndex, 0, newNote);
        setLessonNotes(updatedNotes);

        // Save updated lesson notes to database
        if (currentSessionId) {
          try {
            await fetch(`/api/lesson-sessions/${currentSessionId}/progress`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                current_note_index: currentNoteIndex + 1,
                call_transcript: callTranscript,
                lesson_notes: updatedNotes
              })
            });
            console.log('💾 Updated lesson notes saved to database');
          } catch (error) {
            console.error('❌ Error saving updated lesson notes:', error);
          }
        }

        console.log('📝 Added teacher response to lesson notes');

        // Speak the response
        await OpenAITTS.speak(teacherResponse, {});

        // Continue lesson from next note if not waiting for answer
        if (!isWaitingForStudentAnswer && currentNoteIndex + 2 < lessonNotes.length) {
          console.log('▶️ Continuing lesson after text response');
          setTimeout(async () => {
            // Speak remaining lesson notes
            const remainingNotes = lessonNotes.slice(currentNoteIndex + 2);
            for (const note of remainingNotes) {
              await OpenAITTS.speak(note, { voice: 'nova', speed: 1.0 });
            }
            setCurrentNoteIndex(lessonNotes.length - 1);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ Error processing text message:', error);
    } finally {
      setIsProcessingTextMessage(false);
    }
  };


  // Handle video call with voice transcription and lesson
  const handleCall = async () => {
    if (isCallActive) {
      // End call
      console.log('📞 Ending call...');
      VoiceComm.stopListening();
      OpenAITTS.stop();
      setIsCallActive(false);
      setCallTranscript('');
      setLessonNotes([]);
      setCurrentNoteIndex(0);
      setIsLessonSpeaking(false);
    } else {
      // Start call
      console.log('📞 Starting call...');

      // Activate audio context first (important for browser autoplay policies)
      try {
        console.log('🔊 Activating audio context...');

        // Try Web Audio API first
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (typeof AudioContextClass !== 'undefined') {
          const audioContext = new AudioContextClass();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          console.log('✅ Web Audio API context activated');
        } else {
          // Fallback to HTML5 Audio (may fail on some browsers)
          const audio = new Audio();
          audio.volume = 0.01;
          audio.muted = true;
          audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

          // Don't await, just try to play briefly
          audio.play().then(() => {
            audio.pause();
            console.log('✅ HTML5 Audio context activated');
          }).catch((err) => {
            console.warn('⚠️ HTML5 Audio activation failed, continuing anyway:', err.message);
          });

          // Wait a bit for potential activation
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.warn('⚠️ Failed to activate audio context, continuing anyway:', error.message);
      }

      try {
        // Generate simple greeting
        console.log('📚 Starting conversation...');
        setIsGeneratingLesson(true);
        const notes = ['Привет! Я Юля. Давай начнем урок по теме "' + (currentLesson?.title || 'математике') + '". Что ты уже знаешь по этой теме?'];
        setIsGeneratingLesson(false);
        console.log('✅ Greeting ready, count:', notes?.length);


        // Start the conversation with greeting after generation completes
        console.log('🎓 Starting conversation with greeting...');
        setTimeout(async () => {
          try {
            // Speak the greeting and then start interactive chat
            await speakGreetingAndStartChat(notes[0]);
          } catch (error) {
            console.error('❌ Failed to start conversation:', error);
          }
        }, 500);

        // Initialize VoiceComm with callbacks
        const isInitialized = VoiceComm.init(
          {
            language: 'ru-RU',
            continuous: true
          },
          {
            onListeningStart: () => {
              console.log('🎤 Call listening started (callback fired)');
              console.log('🎤 Notes available:', !!notes, 'Notes length:', notes?.length);
              setIsCallActive(true);

              // Stop TTS immediately when user starts speaking to avoid conflicts
              console.log('🛑 Stopping TTS because user started speaking');
              OpenAITTS.stop();

              // Lesson already started automatically after generation, just ensure voice recognition is active
            },
            onListeningEnd: () => {
              console.log('🎤 Call listening ended');
              setIsCallActive(false);
              setIsLessonSpeaking(false);
            },
          onTranscript: (text: string, isFinal: boolean) => {
            if (isFinal && text.trim()) {
              console.log('📝 Call transcript:', text);
              handleUserTranscript(text, isFinal);
            }
          },
            onError: (error: string) => {
              console.error('❌ Call error:', error);
              setIsCallActive(false);
              setIsLessonSpeaking(false);
            }
          }
        );

        if (!isInitialized) {
          throw new Error('Speech Recognition not supported in this browser');
        }

        // Start voice recognition (without parameters)
        console.log('🎙️ Calling VoiceComm.startListening()...');
        const started = VoiceComm.startListening();
        console.log('🎙️ VoiceComm.startListening() returned:', started);
      } catch (error) {
        console.error('❌ Failed to start call:', error);
        setIsCallActive(false);
        setIsGeneratingLesson(false); // Скрыть индикатор при ошибке
      }
    }
  };

  // Function to save homework from chat messages
  const saveHomeworkFromChat = useCallback(() => {
    if (!personalizedCourseData || !lessonSessionData) return;

    // Get chat messages from ChatContainer
    // We'll look for messages containing "Домашнее задание:" pattern
    const chatMessages = chatContainerRef.current?.messages || [];
    
    // Find the last message from teacher that contains homework
    const homeworkPattern = /(?:Домашнее задание|домашнее задание|Домашка|ДЗ):\s*(.+?)(?:\n|$)/i;
    
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.role === 'assistant' || msg.role === 'teacher') {
        const match = msg.content.match(homeworkPattern);
        if (match && match[1]) {
          const homework = match[1].trim();
          
          // Save homework to session data in DB
          const courseId = personalizedCourseData.courseInfo.id || 'default';
          const updatedSessionData = {
            ...lessonSessionData,
            homeworks: [
              ...(lessonSessionData.homeworks || []),
              {
                lessonNumber: lessonSessionData.lessonNumber,
                task: homework,
                assignedDate: new Date().toISOString(),
                checked: false
              }
            ]
          };
          
          // Save to DB asynchronously
          sessionService.saveLessonSession(courseId, updatedSessionData);
          setLessonSessionData(updatedSessionData);
          console.log('📝 Saved homework to DB:', homework);
          break;
        }
      }
    }
  }, [personalizedCourseData, lessonSessionData]);

  // Save homework when user leaves the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveHomeworkFromChat();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveHomeworkFromChat(); // Save on unmount
    };
  }, [saveHomeworkFromChat]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">

      {/* Header */}
      <HeaderWithHero />

      {/* Chat Container */}
      <div className="container mx-auto px-2 py-2 max-w-6xl">
        {/* Teacher Chat Interface */}
        <div className="space-y-2">

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
              {/* Start Lesson Button (for lesson mode) - DISABLED */}
              {false && isLessonMode && !lessonStarted && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="flex-1 sm:flex-none text-lg px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-300 gap-3 font-semibold"
                    onClick={generateLessonPlan}
                    disabled={isGeneratingPlan}
                  >
                    {isGeneratingPlan ? (
                      <>Генерирую урок...</>
                    ) : (
                      <>Начать интерактивный урок</>
                    )}
                  </Button>

                </div>
              )}

              {/* Call Teacher Button (for lesson mode) - DISABLED */}
              {false && <Button
                size="lg"
                variant="outline"
                className="flex-1 sm:flex-none text-lg px-8 py-4 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 hover:text-black transition-all duration-300 gap-3 font-semibold"
                onClick={() => navigate('/voice-call')}
              >
                <Phone className="w-5 h-5 text-primary" />
                Звонок учителю
              </Button>}

              {/* Error Message */}
              {generationError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 text-red-500 mt-0.5">⚠️</div>
                    <div>
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                        Ошибка генерации плана урока
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {generationError}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGenerationError(null)}
                      >
                        Закрыть
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lesson Display with Formatted Content */}
            {false && isLessonMode && lessonStarted && lessonPlan && lessonContent && (
              <LessonDisplay
                stepTitle={lessonPlan.steps[currentLessonStep]?.title || 'Урок'}
                stepNumber={currentLessonStep + 1}
                totalSteps={lessonPlan.steps?.length || 1}
                content={lessonContent}
                structuredContent={currentLessonSections}
                duration={lessonPlan.steps[currentLessonStep]?.duration || '5'}
                onNext={waitingForAnswer ? undefined : () => {
                  const nextSectionIndex = currentSectionIndex + 1;
                  if (nextSectionIndex < currentLessonSections.length) {
                    setCurrentSectionIndex(nextSectionIndex);
                  }
                }}
                isGenerating={isGeneratingContent}
                currentTask={currentSectionTask}
                waitingForAnswer={waitingForAnswer}
                onAnswer={handleLessonTaskAnswer}
              />
            )}

            {/* Current Lesson Info */}
            {false && isLessonMode && currentLesson && (
              <Card className="border-2 border-primary/20 bg-card/95 backdrop-blur-xl">
                <CardContent className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">
                          Текущий урок: {currentLesson.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {currentLesson.topic}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Thinking message display during plan generation */}
            {false && isLessonMode && isGeneratingPlan && (
              <div className="mb-2">
                <div className="bg-muted/50 border border-border rounded-lg p-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium text-foreground">ИИ анализирует</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Генерирую план урока на основе ваших требований...
                  </p>
                </div>
              </div>
            )}

            {/* Chat Interface */}
            {/* Chat Container - always shown for both regular and lesson mode */}
            <ChatContainer
                ref={chatContainerRef}
              initialSystemPrompt={personalizedCourseData && personalizedCourseData.courseInfo ? 
                `Вы - Юлия, профессиональный педагог и эксперт по предмету "${personalizedCourseData.courseInfo.title}".

КОНТЕКСТ КУРСА:
- Название курса: ${personalizedCourseData.courseInfo.title}
- Класс: ${personalizedCourseData.courseInfo.grade}
- Описание: ${personalizedCourseData.courseInfo.description || 'Общеобразовательный курс'}

${lessonSessionData ? `КОНТЕКСТ УРОКА:
- Номер урока: ${lessonSessionData.lessonNumber}
- Это ${lessonSessionData.lessonNumber === 1 ? 'первый урок' : `урок номер ${lessonSessionData.lessonNumber}`}
${lessonSessionData.lessonNumber > 1 && lessonSessionData.homeworks && lessonSessionData.homeworks.length > 0 ? `- На прошлом уроке было задано домашнее задание: "${lessonSessionData.homeworks[lessonSessionData.homeworks.length - 1].task}"
- ВАЖНО: В начале урока ОБЯЗАТЕЛЬНО проверьте это домашнее задание! Спросите ученика, как он его выполнил, разберите ошибки.` : ''}
` : ''}

ВАША РОЛЬ:
Вы - профессиональный учитель предмета "${personalizedCourseData.courseInfo.title}". Ваша задача - проводить полноценные, подробные уроки, где каждый момент объясняется скрупулезно и понятно.

ВАЖНЫЕ ПРАВИЛА ПРЕПОДАВАНИЯ:

1. ДЛИТЕЛЬНОСТЬ УРОКА:
   - Урок должен продолжаться минимум 15-20 сообщений (обменов)
   - Каждый урок должен подробно разобрать тему от основ до сложных аспектов
   - Не заканчивайте урок преждевременно - продолжайте объяснять до тех пор, пока ученик не поймет тему полностью

2. СТРУКТУРА ОТВЕТОВ:
   - ДАВАЙТЕ ПОДРОБНЫЕ ОБЪЯСНЕНИЯ: минимум 3-5 предложений на каждый аспект темы
   - ПРИВОДИТЕ МНОГО ПРИМЕРОВ: минимум 2-3 примера из реальной жизни на каждое правило
   - РАЗБИРАЙТЕ ТЕМУ ПО ЧАСТЯМ: объясните сначала базовые понятия, потом правила, потом исключения
   - ЗАДАВАЙТЕ ВОПРОСЫ ПОСТЕПЕННО: сначала простые вопросы для проверки понимания, потом более сложные

3. МЕТОДИКА ОБУЧЕНИЯ:
   - Используйте аналогии из повседневной жизни
   - Приводите примеры из фильмов, книг, спорта, природы
   - Объясняйте "почему" и "зачем" для каждого правила
   - Показывайте, как правило применяется в разных ситуациях
   - Уделяйте внимание исключениям и нюансам

4. ИНТЕРАКТИВНОСТЬ:
   - После каждого объяснения спрашивайте, понятно ли ученику
   - Просите ученика привести свои примеры
   - Проверяйте понимание через вопросы
   - Хвалите за правильные ответы и поощряйте самостоятельное мышление

5. ПОДРОБНОСТЬ ОБЪЯСНЕНИЙ:
   - Для грамматики: объясните правило → приведите примеры → покажите исключения → дайте упражнения
   - Для математики: объясните теорему → докажите → решите задачу пошагово → дайте аналогичные задачи
   - Для истории: объясните события → назовите причины и последствия → приведите факты и даты → обсудите значение

6. ТЕМП ОБУЧЕНИЯ:
   - Не торопитесь - лучше объяснить меньше, но очень подробно
   - Повторяйте важные моменты в разных формулировках
   - Возвращайтесь к пройденному материалу для закрепления

ПРИ ПЕРВОМ СООБЩЕНИИ:
1. Поприветствуйте ученика: "Добро пожаловать на урок по ${personalizedCourseData.courseInfo.title}!"
${lessonSessionData && lessonSessionData.lessonNumber > 1 && lessonSessionData.homeworks && lessonSessionData.homeworks.length > 0 ? `2. СРАЗУ ПРОВЕРЬТЕ ДОМАШНЕЕ ЗАДАНИЕ: Спросите про задание с прошлого урока: "${lessonSessionData.homeworks[lessonSessionData.homeworks.length - 1].task}". Попросите рассказать, как ученик его выполнил.
3. После проверки домашнего задания разберите ошибки (если были) и похвалите за правильные части` : `2. Представьтесь как учитель по предмету "${personalizedCourseData.courseInfo.title}"
3. Спросите, что конкретно ученик хочет изучить или какие вопросы у него есть по этому предмету`}
${!lessonSessionData || lessonSessionData.lessonNumber === 1 ? `4. Предложите помощь с домашним заданием, объяснением темы или подготовкой к контрольной` : ''}

ДОМАШНИЕ ЗАДАНИЯ:
- Давайте домашнее задание ТОЛЬКО после полного разбора темы (не раньше 15-20 сообщений)
- Домашнее задание должно закреплять весь изученный материал
- Объясните, как выполнять задание и зачем оно нужно
- Запомните это домашнее задание - на следующем уроке вы ОБЯЗАТЕЛЬНО должны его проверить!

ВАШ СТИЛЬ:
- Дружелюбный и мотивирующий
- Терпеливый и понимающий
- Поощряющий самостоятельность
- Адаптирующий объяснения под уровень ученика

ПОМНИТЕ:
- Качество важнее количества. Лучше подробно объяснить одну тему, чем поверхностно пройти несколько.
- Вы учитель по предмету "${personalizedCourseData.courseInfo.title}", поэтому все объяснения должны быть в контексте этого предмета
- Это урок ${lessonSessionData ? `номер ${lessonSessionData.lessonNumber}` : ''}
${lessonSessionData && lessonSessionData.lessonNumber > 1 ? '- ОБЯЗАТЕЛЬНО начните с проверки домашнего задания!' : ''}
                `
                : 
                `Вы - Юлия, профессиональный педагог и эксперт в образовании. 

ПРИ ПЕРВОМ СООБЩЕНИИ:
1. Поприветствуйте ученика тепло и дружелюбно
2. Спросите, какой предмет или тему ученик хочет изучить
3. Предложите помощь с объяснением, домашним заданием или подготовкой

ОСОБЕННОСТИ ВАШЕГО СТИЛЯ:
- Объясняйте сложное простыми словами
- Используйте примеры из реальной жизни и аналогии
- Разбивайте информацию на логические блоки
- Задавайте наводящие вопросы для проверки понимания
- Будьте терпеливы, поддерживающи и мотивирующи
- Адаптируйте объяснения под уровень ученика
- Поощряйте самостоятельное мышление
- Хвалите за правильные ответы и старания`}
              maxMessages={100}
              onChatStart={() => console.log('Chat started')}
              onChatEnd={() => console.log('Chat ended')}
              isLessonMode={isLessonMode}
              courseId={personalizedCourseData?.courseInfo?.id || 
                (courseIdFromParams && 
                 courseIdFromParams !== 'NaN' && 
                 courseIdFromParams !== 'null' && 
                 courseIdFromParams !== 'undefined' &&
                 courseIdFromParams.trim() !== '' ? courseIdFromParams : undefined) || 
                undefined}
            />


            {/* Saved Lessons */}

                </div>
        </div>
    </div>
  );
  }
export default Chat;
