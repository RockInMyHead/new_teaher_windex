/**
 * useChat Hook - Manage chat state and operations
 * With database persistence for chat history via sessionService
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, ChatCompletionRequest, UseChatReturn, AppError } from '@/types';
import { chatService } from '@/services/api/chatService';
import { handleApiError, getUserFriendlyErrorMessage } from '@/services/api/errorHandler';
import { logger } from '@/utils/logger';
import { learningProgressService } from '@/services';
import { sessionService } from '@/services/sessionService';

const MAX_STORED_MESSAGES = 50;

/**
 * Find homework assignments in chat history
 */
function findHomeworkInHistory(messages: Message[]): string | null {
  // Look for messages containing homework assignments from ASSISTANT only
  // Must contain specific homework assignment patterns

  for (const message of messages.slice().reverse()) { // Start from most recent
    // Only check assistant messages for homework assignments
    if (message.role !== 'assistant') continue;

    const content = message.content.toLowerCase();

    // Must contain explicit homework assignment patterns
    const homeworkPatterns = [
      'домашнее задание',
      'дз:',
      'домашняя работа',
      'выполните дома',
      'задание на дом',
      'для следующего урока'
    ];

    // Must have homework indicators (blanks, tasks, exercises)
    const homeworkIndicators = ['___', 'вставьте', 'заполните', 'определите', 'напишите', 'решите'];

    const hasHomeworkPattern = homeworkPatterns.some(pattern => content.includes(pattern));
    const hasHomeworkIndicators = homeworkIndicators.some(indicator => message.content.includes(indicator));

    // Additional check: message should be reasonably long (not just a greeting)
    const isReasonableLength = message.content.length > 100;

    if (hasHomeworkPattern && hasHomeworkIndicators && isReasonableLength) {
      console.log('📚 Found valid homework assignment in history:', message.content.substring(0, 150) + '...');
      return message.content;
    }
  }

  console.log('📝 No valid homework assignments found in history');
  return null;
}

/**
 * Check if homework needs to be checked based on chat history
 */
function shouldCheckHomework(messages: Message[]): boolean {
  const homework = findHomeworkInHistory(messages);
  if (!homework) return false;

  // Check if homework was already checked/reviewed
  const recentMessages = messages.slice(-10); // Last 10 messages
  const checkedKeywords = ['проверим', 'проверили', 'молодец', 'отлично', 'правильно', 'неправильно'];

  for (const message of recentMessages) {
    if (message.role === 'assistant') {
      const content = message.content.toLowerCase();
      if (checkedKeywords.some(keyword => content.includes(keyword))) {
        console.log('✅ Homework appears to have been checked already');
        return false; // Homework was already checked
      }
    }
  }

  console.log('📝 Homework needs to be checked');
  return true;
}

/**
 * Функция пост-обработки текста для исправления распространенных ошибок
 */
function postProcessText(text: string): string {
  let processed = text;

  // Исправление распространенных ошибок
  const corrections = [
    // Слитные слова
    [/изменениелаголов/g, 'изменение глаголов'],
    [/спреннями/g, 'спряжениями'],
    [/спрение/g, 'спряжение'],
    [/голы/g, 'глаголы'],
    [/напр\./g, 'например'],
    [/кот\./g, 'которые'],
    [/т\.е\./g, 'то есть'],
    [/и\.т\.д\./g, 'и так далее'],

    // Неполные предложения
    [/спряж\.$/g, 'спряжения.'],

    // Ошибки в окончаниях
    [/спрениями/g, 'спряжениями'],
    [/спрении/g, 'спряжения'],

    // Пунктуация
    [/-ять -еть \(/g, '-ять, -еть ('],
    [/-ять -еть,/g, '-ять, -еть,'],
    [/-ить или -/g, '-ить или -еть ('],
  ];

  corrections.forEach(([pattern, replacement]) => {
    processed = processed.replace(pattern, replacement as string);
  });

  return processed;
}

/**
 * Convert file to base64 data URL
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface UseChatOptions {
  onMessageReceived?: (message: Message) => void;
  onError?: (error: AppError) => void;
  maxMessages?: number;
  /** Course ID for per-course chat history - REQUIRED for proper history separation */
  courseId?: string;
}

export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const {
    onMessageReceived,
    onError,
    maxMessages = 100,
    courseId,
  } = options;

  // Determine the effective course ID - use 'general' for general chat
  const effectiveCourseId = courseId || 'general';
  
  // Store courseId in ref to track changes
  const courseIdRef = useRef(effectiveCourseId);
  const isInitializedRef = useRef(false);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Load messages from database on mount and when courseId changes
  useEffect(() => {
    const loadMessages = async () => {
      console.log('🚀 useChat loading messages for courseId:', effectiveCourseId);
      try {
        const history = await sessionService.getChatHistory(effectiveCourseId, MAX_STORED_MESSAGES);
        const loadedMessages = history.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        console.log('📂 Chat history loaded from DB:', loadedMessages.length, 'messages for course:', effectiveCourseId);
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Failed to load chat history from DB:', error);
        setMessages([]);
      }
      isInitializedRef.current = true;
    };

    if (courseIdRef.current !== effectiveCourseId || !isInitializedRef.current) {
      console.log('🔄 Course changed or initializing:', effectiveCourseId);
      courseIdRef.current = effectiveCourseId;
      loadMessages();
    }
  }, [effectiveCourseId]);

  // Save messages to database whenever they change (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isInitializedRef.current || messages.length === 0) return;
    
    // Debounce saves to avoid too many API calls
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('💾 Saving chat history to DB:', messages.length, 'messages for course:', effectiveCourseId);
      await sessionService.saveChatHistory(effectiveCourseId, messages as any);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, effectiveCourseId]);

  /**
   * Send message to AI with streaming
   */
  const sendMessage = useCallback(
    async (content: string, systemPrompt: string, model: string = 'gpt-5.1', images?: File[]) => {
      try {
        setIsLoading(true);
        setError(null);

        // Add user message
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content,
          timestamp: new Date(),
          images: images || [],
        };

        setMessages(prev => {
          const updated = [...prev, userMessage];
          if (updated.length > maxMessages) {
            return updated.slice(-maxMessages);
          }
          return updated;
        });

        onMessageReceived?.(userMessage);

        // Create streaming assistant message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };

        setStreamingMessage(assistantMessage);

        // Prepare chat messages
        const chatMessages = messagesRef.current
          .slice(-29) // Keep last 29 messages + new one = 30 total
          .map(async (msg) => {
            if (msg.images && msg.images.length > 0) {
              // Convert images to base64 and create content array
              const imageUrls = await Promise.all(
                msg.images.map(file => fileToBase64(file))
              );

              const content = [
                { type: 'text' as const, text: msg.content }
              ];

              imageUrls.forEach(url => {
                content.push({
                  type: 'image_url' as const,
                  image_url: { url }
                });
              });

              return {
                role: msg.role,
                content,
              };
            }

            return {
              role: msg.role,
              content: msg.content,
            };
          });

        // Check for homework in history and add to system prompt
        const homeworkInfo = findHomeworkInHistory(messagesRef.current);
        const shouldCheckHW = shouldCheckHomework(messagesRef.current);

        let enhancedSystemPrompt = systemPrompt;
        
        // Добавляем инструкции для распознавания изображений
        if (images && images.length > 0) {
          enhancedSystemPrompt += `

ВАЖНО: Ученик прислал изображение (возможно, фото домашней работы или рукописного текста).

ИНСТРУКЦИИ ПО РАСПОЗНАВАНИЮ ИЗОБРАЖЕНИЙ:
1. Внимательно изучи изображение и распознай весь текст (включая рукописный)
2. Если это домашняя работа - проверь её и укажи на ошибки
3. Объясни, что написано неправильно и как исправить
4. Похвали за правильные ответы
5. Если текст нечитаемый - попроси переснять фото более качественно

При распознавании рукописного текста:
- Учитывай особенности детского почерка
- Если буква похожа на несколько вариантов - выбирай наиболее логичный в контексте
- Обращай внимание на исправления и зачеркивания`;

          console.log('📝 Enhanced system prompt with image recognition instructions');
        }
        
        if (homeworkInfo && shouldCheckHW) {
          enhancedSystemPrompt += `

ВАЖНО: В истории беседы найдено невыполненное домашнее задание!
Домашнее задание: "${homeworkInfo}"

Начните урок с проверки этого задания! Спросите ученика, как он справился с заданием.`;

          console.log('📝 Enhanced system prompt with homework check');
        }

        // Wait for all message conversions
        const resolvedChatMessages = await Promise.all(chatMessages);

        resolvedChatMessages.unshift({
          role: 'system',
          content: enhancedSystemPrompt,
        });

        // Add current message with images
        if (images && images.length > 0) {
          const imageUrls = await Promise.all(
            images.map(file => fileToBase64(file))
          );

          // Создаем массив контента с текстом и изображениями
          const messageContent: Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string}}> = [
            { type: 'text' as const, text: content }
          ];

          imageUrls.forEach(url => {
            messageContent.push({
              type: 'image_url' as const,
              image_url: { url }
            });
          });

          resolvedChatMessages.push({
            role: 'user',
            content: messageContent,
          });
        } else {
          resolvedChatMessages.push({
            role: 'user',
            content,
          });
        }

        // Определяем тип чата и соответствующие настройки
        const lessonContext = learningProgressService.getLessonContext();
        const isLessonChat = !!lessonContext;

        console.log('🎓 Chat type determination:', {
          hasLessonContext: !!lessonContext,
          isLessonChat,
          lessonTitle: lessonContext?.currentLessonTitle
        });

        // Store isLessonChat in a variable accessible to the callback
        const lessonChatFlag = isLessonChat;

        // Настройки для разных типов чата
        // ВАЖНО: GPT-5.1 НЕ поддерживает presence_penalty и frequency_penalty!
        const chatSettings = isLessonChat ? {
          // Образовательный чат - подробные объяснения требуют больше токенов
          temperature: 0.3,
          max_completion_tokens: 2000
        } : {
          // Общий чат - более креативные настройки
          temperature: 0.7,
          max_completion_tokens: 2000
        };

        // Get AI response with streaming
        // GPT-5.1 не поддерживает: presence_penalty, frequency_penalty, top_p
        const request: ChatCompletionRequest = {
          model,
          messages: resolvedChatMessages as any,
          max_completion_tokens: chatSettings.max_completion_tokens,
          temperature: chatSettings.temperature,
        };

        console.log('🎛️ Using chat settings:', chatSettings);

        // Initialize streaming message
        console.log('🚀 Initializing streaming message');
        setStreamingMessage({
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        });

        let chunkBuffer = '';
        let lastUpdateTime = Date.now();

        // Add cache-busting timestamp to ensure latest code is used
        const requestWithCacheBust = {
          ...request,
          _cache_bust: Date.now(),
          _force_no_params: true // Additional flag to ensure no old params
        };

        // Explicitly remove any unsupported parameters that might be present
        delete requestWithCacheBust.top_p;
        delete requestWithCacheBust.presence_penalty;
        delete requestWithCacheBust.frequency_penalty;

        console.log('📤 [USE CHAT] Sending request to chatService:', JSON.stringify(requestWithCacheBust, null, 2));

        await chatService.sendMessageStream(requestWithCacheBust, (chunk: string) => {
          console.log('📦 Received chunk:', chunk, `(length: ${chunk.length})`);
          chunkBuffer += chunk;

          // Update UI at most every 50ms to avoid too frequent re-renders
          const now = Date.now();
          if (now - lastUpdateTime >= 50 || chunk.includes('\n')) {
          setStreamingMessage(prev => {
              const newContent = (prev?.content || '') + chunkBuffer;
            console.log('📝 Updated streaming message, total length:', newContent.length);
              chunkBuffer = '';
              lastUpdateTime = now;
            return {
              role: 'assistant',
              content: newContent,
              timestamp: prev?.timestamp || new Date(),
            };
          });
          }
        });

        // Finalize streaming message
        setStreamingMessage(prev => {
          if (!prev) return null;

          // Применяем пост-обработку для исправления ошибок в образовательном контенте
          const processedContent = lessonChatFlag ? postProcessText(prev.content) : prev.content;
          const processedMessage = {
            ...prev,
            content: processedContent
          };

          console.log('✅ Finalizing streaming message with', processedContent.length, 'characters');
          console.log('📝 Original content:', prev.content);
          console.log('📝 Processed content:', processedContent);

          setMessages(currentMessages => {
            const updated = [...currentMessages, processedMessage];
          if (updated.length > maxMessages) {
            return updated.slice(-maxMessages);
          }
          return updated;
        });
          onMessageReceived?.(processedMessage);
          return null;
        });

        logger.debug('Message sent successfully');
      } catch (err) {
        const appError = handleApiError(err);
        setError(appError);
        setStreamingMessage(null);
        onError?.(appError);
        logger.error('Failed to send message', err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [onMessageReceived, onError, maxMessages]
  );

  /**
   * Add message directly
   */
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      const updated = [...prev, message];
      if (updated.length > maxMessages) {
        return updated.slice(-maxMessages);
      }
      return updated;
    });
    onMessageReceived?.(message);
  }, [onMessageReceived, maxMessages]);

  /**
   * Clear all messages (including database) for current course
   */
  const clearMessages = useCallback(async () => {
    setMessages([]);
    await sessionService.clearChatHistory(effectiveCourseId);
    logger.debug('Messages cleared for course:', effectiveCourseId);
  }, [effectiveCourseId]);

  /**
   * Update message
   */
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  /**
   * Get last message
   */
  const getLastMessage = useCallback((): Message | null => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages]);

  /**
   * Get conversation context
   */
  const getContext = useCallback((limit: number = 10): Message[] => {
    return messages.slice(-limit);
  }, [messages]);

  return {
    messages,
    isLoading,
    sendMessage,
    addMessage,
    clearMessages,
    updateMessage,
    getLastMessage,
    getContext,
    error,
    streamingMessage,
  };
};

// Re-export for convenience
export default useChat;

