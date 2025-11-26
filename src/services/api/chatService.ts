/**
 * Chat API Service
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  AppError,
} from '@/types';
import { logger } from '@/utils/logger';
import { getTimeoutDuration, getErrorMessage, API_CONFIG } from '@/utils/constants';
import { handleApiError } from './errorHandler';

export class ChatService {
  private baseUrl = API_CONFIG.BASE_URL;
  private apiPrefix = API_CONFIG.API_PREFIX;

  /**
   * Send educational message with optimized settings for learning
   */
  async sendEducationalMessage(messages: ChatMessage[], maxTokens: number = 2000): Promise<ChatCompletionResponse> {
    const request = this.createEducationalRequest(messages, 'gpt-5.1', maxTokens);
    return this.sendMessage(request);
  }

  /**
   * Send message to AI and get response
   */
  async sendMessage(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const url = `${this.baseUrl}${this.apiPrefix}/chat/completions`;

      logger.debug('Sending chat completion request', {
        model: request.model,
        messageCount: request.messages.length,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        getTimeoutDuration('API_CALL')
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        throw error;
      }

      const data: ChatCompletionResponse = await response.json();

      logger.debug('Chat completion response received', {
        choicesCount: data.choices.length,
        usage: data.usage,
      });

      return data;
    } catch (error) {
      logger.error('Failed to send message', error as Error);
      throw handleApiError(error);
    }
  }

  /**
   * Send message with streaming response
   */
  async sendMessageStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}${this.apiPrefix}/chat/completions`;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        getTimeoutDuration('STREAMING_API_CALL')
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // Ignore parse errors for individual lines
            }
          }
        }
      }

      logger.debug('Stream completed');
    } catch (error) {
      logger.error('Failed to stream message', error as Error);
      throw handleApiError(error);
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}${this.apiPrefix}/models`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        throw error;
      }

      const data = await response.json();
      return data.data?.map((m: any) => m.id) || [];
    } catch (error) {
      logger.error('Failed to get available models', error as Error);
      throw handleApiError(error);
    }
  }

  /**
   * Create a simple message request
   */
  createMessageRequest(
    messages: ChatMessage[],
    model: string = 'gpt-5.1',
    maxTokens: number = 10000,
    temperature: number = 0.4 // СНИЖЕНА для лучшего качества текста
  ): ChatCompletionRequest {
    // GPT-5.1 НЕ поддерживает: top_p, presence_penalty, frequency_penalty
    return {
      model,
      messages,
      max_completion_tokens: maxTokens,
      temperature,
    };
  }

  /**
   * Create educational message request with optimized settings
   */
  createEducationalRequest(
    messages: ChatMessage[],
    model: string = 'gpt-5.1',
    maxTokens: number = 10000
  ): ChatCompletionRequest {
    // GPT-5.1 НЕ поддерживает: top_p, presence_penalty, frequency_penalty
    return {
      model,
      messages,
      max_completion_tokens: maxTokens,
      temperature: 0.3, // ЕЩЕ НИЖЕ для образовательного контента
    };
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(response: Response): Promise<AppError> {
    try {
      const data = await response.json();
      return handleApiError(new Error(data.error?.message || response.statusText));
    } catch {
      return handleApiError(response.statusText);
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();

