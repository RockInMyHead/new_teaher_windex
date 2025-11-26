/**
 * ChatInput - Input field for sending messages
 */

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

import React, { useRef, useState, useCallback } from 'react';
import { Send, Loader2, Camera, Upload, X, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChatInputProps } from './types';
import { logger } from '@/utils/logger';
import { OpenAITTS } from '@/lib/openaiTTS';

export const ChatInput = React.memo(
  ({
    onSendMessage,
    isLoading = false,
    disabled = false,
    placeholder = 'Введите сообщение...',
  }: ChatInputProps) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const handleSendMessage = async () => {
      if ((!message.trim() && selectedImages.length === 0) || isLoading || isSending) return;

      // Обновляем время пользовательского взаимодействия для TTS
      OpenAITTS.updateUserInteraction();

      try {
        setIsSending(true);
        logger.debug('Sending message', {
          textLength: message.length,
          imageCount: selectedImages.length
        });

        // Send message with images
        await onSendMessage(message.trim(), selectedImages);

        // Clear input
        setMessage('');
        setSelectedImages([]);
        setImagePreviews([]);

        // Focus input after sending
        inputRef.current?.focus();
      } catch (error) {
        logger.error('Failed to send message', error as Error);
      } finally {
        setIsSending(false);
      }
    };


    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        OpenAITTS.updateUserInteraction();
        handleSendMessage();
      }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        processSelectedFiles(files);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        processSelectedFiles(files);
      }
      // Reset input
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    };

    const processSelectedFiles = (files: File[]) => {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      const validImages = imageFiles.slice(0, 5); // Limit to 5 images

      setSelectedImages(prev => [...prev, ...validImages]);

      // Create previews
      validImages.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    };

    const removeImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const startRecording = useCallback(async () => {
      try {
        console.log('🎤 Starting voice recording...');

        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('❌ getUserMedia not supported');
          alert('Ваш браузер не поддерживает запись голоса.');
          return;
        }

        // Check if MediaRecorder is supported
        if (!window.MediaRecorder) {
          console.error('❌ MediaRecorder not supported');
          alert('Ваш браузер не поддерживает MediaRecorder API.');
          return;
        }

        console.log('🎤 Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
          }
        });
        console.log('✅ Microphone access granted');
        streamRef.current = stream;

        // Try different mime types
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = ''; // Let browser choose
            }
          }
        }

        console.log('🎤 Using mime type:', mimeType || 'auto');
        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

        mediaRecorderRef.current = mediaRecorder;
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          console.log('📦 Audio data chunk received, size:', event.data.size);
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstart = () => {
          console.log('▶️ MediaRecorder started');
        };

        mediaRecorder.onstop = async () => {
          console.log('⏹️ MediaRecorder stopped, processing audio...');
          const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          console.log('📦 Audio blob created, size:', audioBlob.size, 'type:', audioBlob.type);
          await processAudioMessage(audioBlob);
        };

        mediaRecorder.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event);
        };

        console.log('▶️ Starting MediaRecorder...');
        mediaRecorder.start(1000); // Collect data every 1 second
        setIsRecording(true);
        setRecordingTime(0);

        // Start timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);

        console.log('✅ Audio recording started successfully');

        // Update TTS interaction for autoplay
        OpenAITTS.updateUserInteraction();

      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        logger.error('Failed to start recording', error as Error);

        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            alert('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
          } else if (error.name === 'NotFoundError') {
            alert('Микрофон не найден. Проверьте подключение микрофона.');
          } else if (error.name === 'NotSupportedError') {
            alert('Ваш браузер не поддерживает запись голоса.');
          } else {
            alert(`Ошибка записи голоса: ${error.message}`);
          }
        } else {
          alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
        }

        // Reset recording state
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      }
    }, [onSendMessage]);

    const stopRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        logger.debug('Audio recording stopped');
      }
    }, []);

    const processAudioMessage = useCallback(async (audioBlob: Blob) => {
      try {
        setIsSending(true);
        logger.debug('Processing audio message');

        // Convert audio to text using Web Speech API
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        // Create speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not supported');
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ru-RU'; // Russian language

        recognition.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          logger.debug('Speech recognized', { transcript });

          // Send recognized text as message
          await onSendMessage(transcript);
        };

        recognition.onerror = (event) => {
          logger.error('Speech recognition error', event.error);
          alert('Не удалось распознать речь. Попробуйте еще раз.');
        };

        recognition.onend = () => {
          setIsSending(false);
          URL.revokeObjectURL(audioUrl);
        };

        // Play audio and start recognition
        audio.onloadeddata = () => {
          recognition.start();
        };

        audio.load();
      } catch (error) {
        logger.error('Failed to process audio message', error as Error);
        setIsSending(false);
        alert('Не удалось обработать аудио сообщение.');
      }
    }, [onSendMessage]);

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
    }, []);

    // Button is disabled only during loading/sending operations
    // Voice recording is always available when not loading/sending
    const isButtonDisabled = isLoading || isSending || disabled;

    return (
      <div className="p-4 bg-background">
        {/* Image previews */}
        {imagePreviews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Удалить изображение"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input and buttons */}
        <div className="flex gap-2">
          {/* File and camera buttons */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled}
              title="Выбрать файл"
              className="h-10 w-10"
            >
              <Upload className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isLoading || disabled}
              title="Сфотографировать"
              className="h-10 w-10"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>

          <Input
            ref={inputRef}
            value={message}
            onChange={e => setMessage(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="flex-1"
          />

          <Button
            onClick={() => {
              console.log('🎯 Button clicked, state:', {
                hasMessage: message.trim(),
                isRecording,
                isButtonDisabled,
                disabled
              });

              OpenAITTS.updateUserInteraction();

              if (message.trim()) {
                console.log('📤 Sending text message');
                handleSendMessage();
              } else if (isRecording) {
                console.log('⏹️ Stopping recording');
                stopRecording();
              } else {
                console.log('🎤 Starting voice recording');
                startRecording();
              }
            }}
            disabled={isButtonDisabled}
            size="icon"
            title={message.trim() ? "Отправить (Enter)" : (isRecording ? "Остановить запись" : "Начать запись голоса")}
            className={isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : ""}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : message.trim() ? (
              <Send className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <Mic className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Запись голоса...</div>
              <div className="text-sm text-red-500">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <Button
              onClick={stopRecording}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Остановить
            </Button>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          className="hidden"
        />

        {/* Image count indicator */}
        {selectedImages.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            Выбрано изображений: {selectedImages.length} (макс. 5)
          </div>
        )}
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;

