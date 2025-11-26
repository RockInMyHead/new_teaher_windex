/**
 * Session Service - Manages lesson sessions, chat history, and user state via API
 * Replaces localStorage functionality
 */

const API_BASE = '/api/sessions';

export interface LessonSession {
  id?: string;
  lessonNumber: number;
  completedLessons: string[];
  homeworks: Array<{ task: string; assignedAt: string; completed?: boolean }>;
  lastLessonDate: string;
  currentTopic?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
  ttsPlayed?: boolean;
}

export interface UserState {
  currentCourseId?: string;
  currentLessonData?: any;
  courseInfo?: any;
  lessonIndex?: number;
  personalizedCourse?: any;
  selectedCourseData?: any;
}

/**
 * Helper function to safely parse JSON response
 * Checks content-type and handles errors gracefully
 */
async function safeJsonParse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type');
  
  // Check if response is JSON
  if (!contentType || !contentType.includes('application/json')) {
    console.warn('⚠️ Response is not JSON. Content-Type:', contentType);
    // Try to read the text for debugging
    try {
      const text = await response.text();
      console.warn('📄 Non-JSON response body:', text.substring(0, 200));
    } catch (e) {
      // Ignore text read errors
    }
    return null;
  }
  
  try {
    return await response.json();
  } catch (error) {
    console.error('❌ Failed to parse JSON:', error);
    return null;
  }
}

class SessionService {
  private userId: string = 'default_user';

  setUserId(userId: string) { 
    this.userId = userId;
    console.log('🔐 SessionService userId set to:', userId);
  }
  
  getUserId(): string { 
    return this.userId; 
  }

  // LESSON SESSIONS
  async getLessonSession(courseId: string): Promise<LessonSession | null> {
    try {
      const response = await fetch(`${API_BASE}/sessions/lesson/${this.userId}/${courseId}`);
      if (!response.ok) return null;

      const data = await safeJsonParse<{ session: LessonSession }>(response);
      return data?.session || null;
    } catch (error) {
      console.error('Error getting lesson session:', error);
      return null;
    }
  }

  async saveLessonSession(courseId: string, session: Partial<LessonSession>): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/sessions/lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, courseId, ...session })
      });
      return response.ok;
    } catch (error) {
      console.error('Error saving lesson session:', error);
      return false;
    }
  }

  async deleteLessonSession(courseId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/sessions/lesson/${this.userId}/${courseId}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting lesson session:', error);
      return false;
    }
  }

  // =====================================================
  // USER LIBRARY
  // =====================================================

  async addCourseToLibrary(courseData: {
    courseId: string;
    subject: string;
    grade: number;
    title: string;
    description: string;
  }): Promise<boolean> {
    try {
      console.log('📚 [sessionService] Adding course to library:', {
        userId: this.userId,
        courseId: courseData.courseId,
        title: courseData.title
      });
      
      const response = await fetch(`${API_BASE}/library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          ...courseData
        })
      });
      
      if (!response.ok) {
        console.error('❌ [sessionService] Failed to add course to library:', response.status, await response.text());
      } else {
        console.log('✅ [sessionService] Course added to library successfully');
      }
      
      return response.ok;
    } catch (error) {
      console.error('Error adding course to library:', error);
      return false;
    }
  }

  async getUserLibrary(): Promise<Array<{
    id: string;
    courseId: string;
    subject: string;
    grade: number;
    title: string;
    description: string;
    addedAt: string;
    lastAccessedAt: string;
  }>> {
    try {
      console.log('📚 [sessionService] Getting user library for userId:', this.userId);
      
      const response = await fetch(`${API_BASE}/library/${this.userId}`);
      if (!response.ok) {
        console.error('❌ [sessionService] Failed to get library:', response.status);
        return [];
      }

      const data = await safeJsonParse<{ courses: any[] }>(response);
      console.log('✅ [sessionService] Library loaded:', data?.courses?.length || 0, 'courses');
      return data?.courses || [];
    } catch (error) {
      console.error('Error getting user library:', error);
      return [];
    }
  }

  async removeCourseFromLibrary(courseId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/library/${this.userId}/${courseId}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      console.error('Error removing course from library:', error);
      return false;
    }
  }

  // CHAT HISTORY
  async getChatHistory(courseId: string = 'general', limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${API_BASE}/chat/${this.userId}/${courseId}?limit=${limit}`);
      if (!response.ok) return [];
      
      const data = await safeJsonParse<{ messages: ChatMessage[] }>(response);
      return data?.messages || [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  async saveChatHistory(courseId: string = 'general', messages: ChatMessage[]): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          courseId,
          messages: messages.map(m => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
          }))
        })
      });
      return response.ok;
    } catch (error) {
      console.error('Error saving chat history:', error);
      return false;
    }
  }

  async clearChatHistory(courseId: string = 'general'): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/chat/${this.userId}/${courseId}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
  }

  // USER STATE
  async getUserState(): Promise<UserState | null> {
    try {
      const response = await fetch(`${API_BASE}/state/${this.userId}`);
      if (!response.ok) return null;
      
      const data = await safeJsonParse<{ state: UserState }>(response);
      return data?.state || null;
    } catch (error) {
      console.error('Error getting user state:', error);
      return null;
    }
  }

  async saveUserState(state: Partial<UserState>): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, ...state })
      });
      return response.ok;
    } catch (error) {
      console.error('Error saving user state:', error);
      return false;
    }
  }

  async clearCourseState(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/state/clear-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId })
      });
      return response.ok;
    } catch (error) {
      console.error('Error clearing course state:', error);
      return false;
    }
  }
}

export const sessionService = new SessionService();
export default sessionService;
