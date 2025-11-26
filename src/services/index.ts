/**
 * Services Index
 * Central export for all services
 */

export { default as api } from './api';
export { default as userService } from './userService';
export { default as courseService } from './courseService';
export { default as chatService } from './chatService';
export { default as examService } from './examService';
export { default as learningProgressService } from './learningProgressService';
export { learningProfileService } from './learningProfileService';

// Export types
export type { User, UserPreferences, RegisterData, LoginData } from './userService';
export type { Course, Lesson, UserCourse } from './courseService';
export type { ChatSession, ChatMessage } from './chatService';
export type { ExamCourse } from './examService';
export type { 
  LessonProgress as LessonProgressType, 
  UserCourseProgress, 
  CourseContext 
} from './learningProgressService';
export type {
  LearningProfile,
  LLMContext,
  WeakTopic,
  StrongTopic,
  HomeworkEntry,
  TeacherNote
} from './learningProfileService';

