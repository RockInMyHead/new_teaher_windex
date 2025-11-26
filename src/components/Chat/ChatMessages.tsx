/**
 * ChatMessages - Display chat messages
 */

import React from 'react';
import { MessageSquare, Trash2, Volume2, VolumeX, Brain, VolumeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ChatMessagesProps } from './types';
import { logger } from '@/utils/logger';
import { MarkdownRenderer } from './MarkdownRenderer';
import { OpenAITTS, isTTSAvailable } from '@/lib/openaiTTS';

// Streaming text component with character-by-character animation
const StreamingText: React.FC<{ content: string }> = ({ content }) => {
  // Нормализуем текст для правильной обработки UTF-8
  const normalizedContent = content.normalize('NFC');

  const [displayedText, setDisplayedText] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const currentIndexRef = React.useRef(0);
  const contentRef = React.useRef('');
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    // If content changed (new chars added), continue typing
    if (normalizedContent !== contentRef.current) {
      contentRef.current = normalizedContent;
      setIsTyping(true);

      // Start typing if not already running
      if (!timerRef.current) {
        const typeNext = () => {
          if (currentIndexRef.current < contentRef.current.length) {
            // Используем Array.from для правильной работы с UTF-8 символами
            const chars = Array.from(contentRef.current);
            const char = chars[currentIndexRef.current];

            // Разные задержки для разных типов символов
            let delay = 30; // Увеличенная базовая задержка для лучшей видимости

            if (char === ' ') {
              delay = 25;
            } else if (char === '\n') {
              delay = 150; // Дольше для абзацев
            } else if (['.', '!', '?', ':', ';', '—'].includes(char)) {
              delay = 120; // Дольше для знаков препинания
            } else if (char.match(/[а-яё]/i)) {
              delay = 40; // Для русских букв
            } else if (char.match(/[a-z]/i)) {
              delay = 35; // Для английских букв
            }

            currentIndexRef.current++;
            const displayedChars = chars.slice(0, currentIndexRef.current);
            setDisplayedText(displayedChars.join(''));

            timerRef.current = setTimeout(typeNext, delay);
          } else {
            setIsTyping(false);
            timerRef.current = null;
          }
        };

        // Небольшая задержка перед началом печати
        setTimeout(typeNext, 100);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content]);

  // Reset on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setIsTyping(false);
      currentIndexRef.current = 0;
    };
  }, []);

  return (
    <div className="relative">
      <MarkdownRenderer content={displayedText} isStreaming={true} />
      {isTyping && (
        <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse align-middle"></span>
      )}
    </div>
  );
};

export const ChatMessages = React.memo(
  ({
    messages,
    isLoading = false,
    onMessageRemove,
    streamingMessage,
    isLessonMode = false
  }: ChatMessagesProps) => {
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);

    // TTS state
    const [speakingMessageId, setSpeakingMessageId] = React.useState<string | null>(null);
    const [ttsSupported, setTtsSupported] = React.useState(false);

    // Check TTS availability on mount
    React.useEffect(() => {
      const checkTTSAvailability = async () => {
        try {
          // Basic browser support check
          const hasBasicSupport = isTTSAvailable();

          console.log('🔊 TTS basic support check:', {
            hasBasicSupport,
            Audio: typeof Audio,
            AudioContext: typeof AudioContext,
            window: typeof window,
            fetch: typeof fetch
          });

          if (!hasBasicSupport) {
            console.log('❌ TTS not supported: browser audio API not available');
            setTtsSupported(false);
            return;
          }

          // Test TTS API availability with a minimal request
          const testResponse = await fetch('/api/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'tts-1',
              input: 'test',
              voice: 'alloy'
            })
          });

          // If we get a response (even error), TTS API is available
          // 401/403 means API key issues, but service is available
          const isAvailable = testResponse.status !== 404 && testResponse.status !== 500;

          console.log('🔊 TTS API availability check:', {
            apiResponse: testResponse.status,
            apiResponseText: await testResponse.text().catch(() => 'unknown'),
            available: isAvailable
          });

          setTtsSupported(isAvailable);
        } catch (error) {
          console.warn('⚠️ TTS availability check failed:', error);
          setTtsSupported(false);
        }
      };

      checkTTSAvailability();
    }, []);

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
      if (scrollAreaRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      }
    }, [messages, streamingMessage]);

    // Clean content for TTS (remove markdown and HTML)
    const cleanContentForTTS = (content: string): string => {
      // First remove HTML tags
      const withoutHtml = content
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML spaces
        .replace(/&[a-zA-Z0-9#]+;/g, ' '); // Replace HTML entities

      // Then clean markdown
      return withoutHtml
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1')     // Remove italic
          .replace(/```.*?```/gs, '')      // Remove code blocks
          .replace(/`(.*?)`/g, '$1')       // Remove inline code
          .replace(/#{1,6}\s/g, '')        // Remove headers
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
          .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
          .replace(/\n+/g, ' ')            // Replace newlines with spaces
        .replace(/\s+/g, ' ')            // Normalize whitespace
          .trim();
    };

    // TTS functions
    const speakMessage = async (messageId: string, content: string) => {
      try {
        setSpeakingMessageId(messageId);
        const cleanContent = cleanContentForTTS(content);

        console.log('🎵 Attempting to speak message:', {
          messageId,
          contentLength: cleanContent.length,
          ttsSupported
        });

        await OpenAITTS.speak(cleanContent, { voice: 'nova', speed: 1.1 });
        console.log('✅ TTS speak completed successfully');
      } catch (error) {
        console.error('❌ TTS error:', error);
        alert('Ошибка озвучки: ' + (error.message || 'Неизвестная ошибка'));
      } finally {
        setSpeakingMessageId(null);
      }
    };

    const stopSpeaking = () => {
      OpenAITTS.stop();
      setSpeakingMessageId(null);
    };

    // Track previous streaming message to detect completion
    const prevStreamingMessageRef = React.useRef<Message | null>(null);


    const handleRemove = (id: string) => {
      logger.debug('Removing message', { id });
      onMessageRemove?.(id);
    };

    return (
      <ScrollArea className="h-full w-full bg-background">
        <div ref={scrollAreaRef} className="space-y-4 p-4">

          {messages.length === 0 && !isLessonMode ? (
            <div key="empty-state" className="flex h-full items-center justify-center text-muted-foreground px-4">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg">Я универсальный учитель по любым предметам. Задайте мне вопрос и мы разберем тему!</p>
              </div>
            </div>
          ) : messages.length === 0 && isLessonMode ? (
            <div key="lesson-loading" className="flex h-full items-center justify-center text-muted-foreground px-4">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50 animate-pulse" />
                <p className="text-sm">Подготовка урока...</p>
              </div>
            </div>
          ) : (
            <div key="messages-container" className="space-y-4">
              {messages.map(message => (
              <div
                key={message.id}
                className={`flex group ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Message bubble */}
                <div className={`max-w-[80%] sm:max-w-[70%]`}>
                  {/* Time stamp with TTS button for assistant */}
                  <div className={`flex items-center justify-between mb-1 px-1 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    </span>

                    {/* Compact TTS button for assistant messages */}
                    {message.role === 'assistant' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!ttsSupported}
                        onClick={() => {
                          console.log('🎵 TTS button clicked for message:', message.id, 'ttsSupported:', ttsSupported);
                          if (!ttsSupported) {
                            alert('Озвучка недоступна. Проверьте настройки API.');
                            return;
                          }
                          if (speakingMessageId === message.id) {
                            stopSpeaking();
                          } else {
                            speakMessage(message.id, message.content);
                          }
                        }}
                        className={`h-6 w-6 p-0 ml-2 transition-all duration-200 ${
                          speakingMessageId === message.id
                            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                            : !ttsSupported
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title={
                          !ttsSupported
                            ? "Озвучка недоступна"
                            : speakingMessageId === message.id
                            ? "Остановить озвучку"
                            : "Озвучить сообщение"
                        }
                      >
                        {speakingMessageId === message.id ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Message content */}
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm transition-all duration-300 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : speakingMessageId === message.id
                          ? 'bg-blue-50 border-2 border-blue-400 text-card-foreground ring-2 ring-blue-200'
                        : 'bg-card border border-border/50 text-card-foreground'
                    }`}
                  >
                    {/* Images */}
                    {(message.images || message.imageUrls) && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(message.images || []).map((image, index) => (
                          <img
                            key={index}
                            src={URL.createObjectURL(image)}
                            alt={`Attachment ${index + 1}`}
                            className="max-w-32 max-h-32 object-cover rounded-lg border border-border/50"
                          />
                        ))}
                        {(message.imageUrls || []).map((url, index) => (
                          <img
                            key={`url-${index}`}
                            src={url}
                            alt={`Attachment ${index + 1}`}
                            className="max-w-32 max-h-32 object-cover rounded-lg border border-border/50"
                          />
                        ))}
                      </div>
                    )}

                    {/* Text content */}
                    {message.content && (
                      <div className="text-sm leading-relaxed">
                        {message.role === 'user' ? (
                          <div className="break-words whitespace-pre-wrap">{message.content}</div>
                        ) : (
                          <MarkdownRenderer content={message.content} />
                        )}
                      </div>
                    )}

                    {/* Speaking indicator */}
                    {speakingMessageId === message.id && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 animate-pulse">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]"></div>
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:100ms]"></div>
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:200ms]"></div>
                        </div>
                        <span>Воспроизведение...</span>
                      </div>
                    )}

                    {/* Action buttons for assistant messages */}
                    {message.role === 'assistant' && onMessageRemove && (
                      <div className="mt-3 flex justify-end">
                          <Button
                          variant="outline"
                            size="sm"
                            onClick={() => handleRemove(message.id)}
                          className="h-7 w-7 p-0 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200"
                            title="Удалить сообщение"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ))}

              {/* Streaming message */}
              {streamingMessage && (
                <div
                  key="streaming-message"
                  className="flex gap-0 group justify-start animate-in slide-in-from-bottom-2 duration-300"
                >
                  {/* Message bubble */}
                  <div className="max-w-[80%] sm:max-w-[70%]">
                    {/* Time stamp with typing indicator */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 px-1">
                      <span>
                      {streamingMessage.timestamp.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]"></div>
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]"></div>
                          <div className="w-1 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]"></div>
                        </div>
                        <span className="text-blue-600 font-medium">Печатает...</span>
                      </div>
                    </div>

                    {/* Message content */}
                    <div className="rounded-2xl px-4 py-3 shadow-sm bg-card border border-border/50 text-card-foreground border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/30">
                      <div className="text-sm leading-relaxed">
                        <StreamingText content={streamingMessage.content} />
                      </div>
                      {/* Streaming status indicator */}
                      {streamingMessage.content && (
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/30 pt-2">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span>ИИ пишет ответ...</span>
                          </div>
                          <span className="opacity-60 font-mono">
                            {streamingMessage.content.length} символов
                          </span>
                        </div>
                      )}

                      {/* Action buttons for streaming message */}
                      <div className="mt-3 flex gap-1">
                        {/* TTS Button - always visible */}
                        {streamingMessage.content && (
                          <Button
                            variant={speakingMessageId === 'streaming' ? "destructive" : "outline"}
                            size="sm"
                            disabled={!ttsSupported}
                            onClick={() => {
                              if (!ttsSupported) {
                                alert('Озвучка недоступна. Проверьте настройки API.');
                                return;
                              }
                              if (speakingMessageId === 'streaming') {
                                stopSpeaking();
                              } else {
                                speakMessage('streaming', streamingMessage.content);
                              }
                            }}
                            className={`h-8 px-3 gap-2 transition-all duration-200 ${
                              speakingMessageId === 'streaming'
                                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                                : !ttsSupported
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                            }`}
                            title={
                              !ttsSupported
                                ? "Озвучка недоступна"
                                : speakingMessageId === 'streaming'
                                ? "Остановить озвучку"
                                : "Озвучить сообщение"
                            }
                          >
                            {speakingMessageId === 'streaming' ? (
                              <>
                                <VolumeX className="h-4 w-4" />
                                <span className="text-xs font-medium">Стоп</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-4 w-4" />
                                <span className="text-xs font-medium">Озвучить</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
                <div key="loading-indicator" className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback>Ю</AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-muted p-3">
                <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                </div>
              </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for memoization
    return (
      prevProps.messages === nextProps.messages &&
      prevProps.isLoading === nextProps.isLoading
    );
  }
);

ChatMessages.displayName = 'ChatMessages';

export default ChatMessages;

