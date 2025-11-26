/**
 * Chat component types and interfaces
 */

import type { Message, AssessmentQuestion, AssessmentResult, TestQuestionData } from '@/types';

// ============= CHAT MESSAGE COMPONENT =============

export interface ChatMessageProps {
  message: Message;
  onRemove?: (id: string) => void;
}

// ============= CHAT INPUT COMPONENT =============

export interface ChatInputProps {
  onSendMessage: (content: string, images?: File[]) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

// ============= CHAT MESSAGES LIST =============

export interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onMessageRemove?: (id: string) => void;
  streamingMessage?: Message | null;
  isLessonMode?: boolean;
}



// ============= ASSESSMENT PANEL =============

export interface AssessmentPanelProps {
  isActive: boolean;
  currentQuestion?: AssessmentQuestion | null;
  questionCount?: number;
  assessmentState?: 'initial' | 'collecting_grade' | 'collecting_topic' | 'in_progress' | 'completed';
  assessmentResult?: AssessmentResult | null;
  classGrade?: string;
  lastTopic?: string;
  onGradeSelect?: (grade: string) => void;
  onTopicSelect?: (topic: string) => void;
  onAnswerSubmit?: (answer: string) => Promise<void>;
  onClose?: () => void;
  isLoading?: boolean;
}

// ============= AUDIO TASK PANEL =============

export interface AudioTaskPanelProps {
  isActive: boolean;
  taskText?: string;
  isRecording?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onClose?: () => void;
}

// ============= TEST QUESTION PANEL =============

export interface TestQuestionPanelProps {
  isActive: boolean;
  questionData?: TestQuestionData | null;
  onAnswerSelect?: (answer: string) => void;
  onClose?: () => void;
}

// ============= CHAT CONTAINER =============

export interface ChatContainerProps {
  initialSystemPrompt?: string;
  maxMessages?: number;
  onChatStart?: () => void;
  onChatEnd?: () => void;
  initialMessages?: Message[];
  onSendMessage?: (message: string) => Promise<void>;
  isLessonMode?: boolean;
  /** Course ID for per-course chat history separation */
  courseId?: string;
}

// ============= INTERNAL STATE =============

export interface ChatInternalState {
  messages: Message[];
  isLoading: boolean;
  assessmentState: 'initial' | 'collecting_grade' | 'collecting_topic' | 'in_progress' | 'completed';
  currentAssessmentQuestion: AssessmentQuestion | null;
  assessmentResult: AssessmentResult | null;
  classGrade: string;
  lastTopic: string;
  questionCount: number;
  isAudioTaskActive: boolean;
  audioTaskText: string;
  isTestQuestionActive: boolean;
  testQuestionData: TestQuestionData | null;
  error: Error | null;
  apiKeyStatus: 'checking' | 'valid' | 'invalid' | 'error';
}

