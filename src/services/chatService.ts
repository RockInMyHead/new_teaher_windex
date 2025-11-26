/**
 * Chat Service
 * Handles chat sessions and messages
 */

import api from './api';

export interface ChatSession {
  id: string;
  userId: string;
  courseId?: string;
  lessonId?: string;
  sessionType: 'lesson' | 'interactive' | 'voice' | 'exam_prep';
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  contextData?: any;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ttsPlayed: boolean;
  ttsAudioUrl?: string;
  createdAt: string;
}

class ChatService {
  /**
   * Create new chat session
   */
  async createSession(data: {
    userId: string;
    courseId?: string;
    lessonId?: string;
    sessionType?: string;
    contextData?: any;
  }): Promise<{ session: ChatSession }> {
    return api.post('/chat/sessions', data);
  }

  /**
   * Get chat session with messages
   */
  async getSession(sessionId: string): Promise<{ session: ChatSession & { messages: ChatMessage[] } }> {
    return api.get(`/chat/sessions/${sessionId}`);
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(
    userId: string,
    filters?: {
      courseId?: string;
      sessionType?: string;
      limit?: number;
    }
  ): Promise<{ sessions: ChatSession[] }> {
    return api.get(`/chat/sessions/user/${userId}`, {
      params: filters as any,
    });
  }

  /**
   * Add message to session
   */
  async addMessage(data: {
    sessionId: string;
    role: string;
    content: string;
    ttsPlayed?: boolean;
    ttsAudioUrl?: string;
  }): Promise<{ message: ChatMessage }> {
    return api.post('/chat/messages', data);
  }

  /**
   * Add multiple messages (for migration)
   */
  async addBulkMessages(sessionId: string, messages: Array<{
    role: string;
    content: string;
    ttsPlayed?: boolean;
    ttsAudioUrl?: string;
    timestamp?: Date;
  }>): Promise<{ messages: ChatMessage[] }> {
    return api.post('/chat/messages/bulk', { sessionId, messages });
  }

  /**
   * End chat session
   */
  async endSession(sessionId: string): Promise<{ session: ChatSession }> {
    return api.put(`/chat/sessions/${sessionId}/end`);
  }

  /**
   * Delete chat session
   */
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return api.delete(`/chat/sessions/${sessionId}`);
  }

  /**
   * Update TTS status for message
   */
  async updateMessageTTS(
    messageId: string,
    data: { ttsPlayed?: boolean; ttsAudioUrl?: string }
  ): Promise<{ message: ChatMessage }> {
    return api.put(`/chat/messages/${messageId}/tts`, data);
  }

}

export const chatService = new ChatService();
export default chatService;

