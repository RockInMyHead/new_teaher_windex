import { replaceNumbersInText } from './numbersToWords';

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  model?: 'tts-1' | 'tts-1-hd';
  format?: 'aac' | 'mp3' | 'opus' | 'flac';
}

// Интерфейс для элемента очереди воспроизведения
interface AudioQueueItem {
  buffer: AudioBuffer;
  index: number;
  text: string;
}

export class OpenAITTS {
  private static audioContext: AudioContext | null = null;
  private static currentAudio: HTMLAudioElement | null = null;
  private static videoElement: HTMLVideoElement | null = null;
  private static currentAudioUrl: string | null = null;
  private static interactionListenersAttached = false;
  
  // Новые свойства для параллельной генерации
  private static audioQueue: AudioQueueItem[] = [];
  private static isPlaying = false;
  private static currentSource: AudioBufferSourceNode | null = null;
  private static shouldStop = false;
  private static onPlaybackComplete: (() => void) | null = null;

  // Инициализация отслеживания пользовательского взаимодействия
  private static initInteractionTracking(): void {
    if (this.interactionListenersAttached || typeof window === 'undefined') return;

    const updateInteraction = () => this.updateUserInteraction();

    // Отслеживаем различные типы взаимодействия
    const events = ['click', 'keydown', 'touchstart', 'mousedown', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, updateInteraction, { passive: true });
    });

    // Отмечаем, что обработчики установлены
    this.interactionListenersAttached = true;
    console.log('👆 TTS interaction tracking initialized');
  }

  // Получить правильный MIME тип для аудио формата
  private static getMimeType(format: string): string {
    switch (format) {
      case 'aac': return 'audio/aac';
      case 'mp3': return 'audio/mpeg';
      case 'opus': return 'audio/opus';
      case 'flac': return 'audio/flac';
      default: return 'audio/mpeg';
    }
  }

  // Очистить текст от ударений и специальных символов для TTS
  private static cleanTextForTTS(text: string): string {
    if (!text) return text;

    // Удаляем знаки ударений (+) перед гласными
    let cleaned = text.replace(/\+([аеёиоуыэюя])/gi, '$1');

    // Удаляем другие специальные символы, которые могут мешать TTS
    cleaned = cleaned.replace(/[«»""''""''""]/g, ''); // Убираем кавычки

    // Убираем лишние пробелы
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  static async generateSpeech(text: string, options: TTSOptions = {}): Promise<ArrayBuffer> {
    const {
      voice = 'alloy', // alloy - нейтральный мужской голос, хорошо подходит для русского
      speed = 1.0,
      model = 'tts-1',
      format = 'mp3' // MP3 - максимальная совместимость со всеми браузерами
    } = options;

    console.log('🎤 generateSpeech called:', {
      textLength: text.length,
      textPreview: text.substring(0, 50) + '...',
      voice,
      speed,
      model
    });

    // Преобразуем цифры в слова и удаляем ударения (знаки +)
    const processedText = this.cleanTextForTTS(replaceNumbersInText(text));
    console.log('📝 Original text:', text.substring(0, 100) + '...');
    console.log('📝 Processed text:', processedText.substring(0, 100) + '...');
    console.log('📝 Text changed:', text !== processedText);

    console.log('📡 Fetching TTS from:', `${window.location.origin}/api/audio/speech`);
    const response = await fetch(`${window.location.origin}/api/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: processedText,
        voice: voice,
        response_format: format,
        speed: speed,
      }),
    });

    console.log('📡 TTS API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ TTS API error:', errorData);
      throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ TTS audio received, size:', arrayBuffer.byteLength, 'bytes');
    return arrayBuffer;
  }

  static async speak(text: string, options: TTSOptions = {}): Promise<void> {
    return this.speakText(text, options);
  }

  /**
   * 🚀 НОВЫЙ МЕТОД: Параллельная генерация TTS с последовательным воспроизведением
   * Разбивает текст на предложения, генерирует аудио параллельно,
   * и воспроизводит по мере готовности
   */
  static async speakStreaming(text: string, options: TTSOptions = {}): Promise<void> {
    console.log('🚀 TTS Streaming: Starting parallel generation...');
    
    // Инициализируем отслеживание взаимодействия
    this.initInteractionTracking();
    
    // Проверяем доступность TTS
    if (!isTTSAvailable()) {
      console.error('❌ TTS not available');
      return this.fallbackToBrowserTTS(text, () => {});
    }
    
    // Проверяем user activation
    if (!this.hasUserActivation()) {
      console.warn('⚠️ No user activation for TTS');
      this.showAutoplayWarning();
      return;
    }
    
    // Останавливаем текущее воспроизведение
    this.stop();
    this.shouldStop = false;
    this.audioQueue = [];
    
    // Разбиваем текст на предложения
    const sentences = this.splitIntoSentences(text);
    console.log(`📝 TTS Streaming: Split into ${sentences.length} sentences`);
    
    if (sentences.length === 0) {
      console.warn('⚠️ No sentences to speak');
      return;
    }
    
    // Если только одно предложение - используем обычный метод
    if (sentences.length === 1) {
      return this.speakText(text, options);
    }
    
    // Инициализируем AudioContext
    await this.initAudioContext();
    
    return new Promise<void>(async (resolve) => {
      this.onPlaybackComplete = resolve;
      
      // Запускаем параллельную генерацию всех предложений
      const generationPromises = sentences.map((sentence, index) => 
        this.generateSentenceAudio(sentence, index, options)
      );
      
      // Обрабатываем результаты по мере готовности
      let nextToPlay = 0;
      let completedCount = 0;
      const totalSentences = sentences.length;
      
      // Используем Promise.allSettled для обработки всех результатов
      const results = await Promise.allSettled(generationPromises);
      
      // Сортируем готовые аудио по индексу
      const readyAudios: (AudioQueueItem | null)[] = new Array(totalSentences).fill(null);
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          readyAudios[result.value.index] = result.value;
        } else {
          console.warn(`⚠️ Sentence ${i} generation failed`);
        }
      }
      
      // Начинаем воспроизведение
      console.log('▶️ TTS Streaming: Starting playback...');
      this.playVideo();
      
      const playNext = async () => {
        if (this.shouldStop) {
          console.log('🛑 TTS Streaming: Stopped by user');
          this.pauseVideo();
          resolve();
          return;
        }
        
        while (nextToPlay < totalSentences && !readyAudios[nextToPlay]) {
          nextToPlay++;
        }
        
        if (nextToPlay >= totalSentences) {
          console.log('✅ TTS Streaming: All sentences played');
          this.pauseVideo();
          this.isPlaying = false;
          resolve();
          return;
        }
        
        const audioItem = readyAudios[nextToPlay];
        if (audioItem) {
          console.log(`▶️ Playing sentence ${nextToPlay + 1}/${totalSentences}: "${audioItem.text.substring(0, 30)}..."`);
          
          try {
            await this.playAudioBuffer(audioItem.buffer);
            nextToPlay++;
            playNext();
          } catch (error) {
            console.error(`❌ Error playing sentence ${nextToPlay}:`, error);
            nextToPlay++;
            playNext();
          }
        } else {
          nextToPlay++;
          playNext();
        }
      };
      
      this.isPlaying = true;
      playNext();
    });
  }
  
  /**
   * Разбивает текст на предложения для TTS
   */
  private static splitIntoSentences(text: string): string[] {
    // Убираем лишние пробелы и переносы строк
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Разбиваем по знакам препинания, сохраняя их
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const sentences = cleanText.match(sentenceRegex) || [];
    
    // Фильтруем слишком короткие предложения (меньше 5 символов)
    // и объединяем очень короткие с предыдущими
    const result: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 5) continue;
      
      // Если предложение очень короткое и есть предыдущее, объединяем
      if (trimmed.length < 20 && result.length > 0) {
        result[result.length - 1] += ' ' + trimmed;
      } else {
        result.push(trimmed);
      }
    }
    
    // Если остался текст без знаков препинания в конце
    const lastMatch = cleanText.match(/[^.!?]+$/);
    if (lastMatch && lastMatch[0].trim().length > 5) {
      const remaining = lastMatch[0].trim();
      if (result.length > 0 && remaining.length < 20) {
        result[result.length - 1] += ' ' + remaining;
      } else {
        result.push(remaining);
      }
    }
    
    return result;
  }
  
  /**
   * Генерирует аудио для одного предложения
   */
  private static async generateSentenceAudio(
    sentence: string, 
    index: number, 
    options: TTSOptions
  ): Promise<AudioQueueItem | null> {
    try {
      console.log(`🎤 Generating audio for sentence ${index + 1}: "${sentence.substring(0, 30)}..."`);
      
      const startTime = Date.now();
      const arrayBuffer = await this.generateSpeech(sentence, options);
      const generationTime = Date.now() - startTime;
      
      console.log(`✅ Sentence ${index + 1} generated in ${generationTime}ms, size: ${arrayBuffer.byteLength} bytes`);
      
      // Декодируем в AudioBuffer
      if (!this.audioContext) {
        await this.initAudioContext();
      }
      
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        this.audioContext!.decodeAudioData(
          arrayBuffer.slice(0),
          (buffer) => resolve(buffer),
          (error) => reject(error)
        );
      });
      
      return {
        buffer: audioBuffer,
        index,
        text: sentence
      };
    } catch (error) {
      console.error(`❌ Failed to generate sentence ${index + 1}:`, error);
      return null;
    }
  }
  
  /**
   * Инициализирует AudioContext
   */
  private static async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }
      this.audioContext = new AudioContextClass();
      console.log('✅ AudioContext initialized');
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('✅ AudioContext resumed');
    }
  }
  
  /**
   * Воспроизводит один AudioBuffer
   */
  private static playAudioBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext || this.shouldStop) {
        resolve();
        return;
      }
      
      try {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        
        this.currentSource = source;
        
        source.onended = () => {
          this.currentSource = null;
          resolve();
        };
        
        source.start(0);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Проверка на user activation (необходима для autoplay)
  private static hasUserActivation(): boolean {
    // Проверяем современный API userActivation
    if (typeof navigator !== 'undefined' && 'userActivation' in navigator) {
      return (navigator as any).userActivation?.hasBeenActive || false;
    }

    // Fallback: проверяем на недавнее взаимодействие (click, keypress, etc.)
    // Это не идеально, но лучше чем ничего
    const now = Date.now();
    const lastInteraction = (window as any)._ttsLastInteraction || 0;
    return (now - lastInteraction) < 5000; // 5 секунд
  }

  // Показать предупреждение об autoplay
  private static showAutoplayWarning(): void {
    console.warn('🔊 TTS заблокирован политикой autoplay браузера');
    console.warn('💡 Для включения звука нажмите на любую кнопку на странице');

    // Показываем toast уведомление (если есть система уведомлений)
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast('Для включения голоса нажмите на любую кнопку на странице', 'warning');
    }

    // Диспатчим событие для компонентов
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts-autoplay-blocked', {
        detail: { message: 'TTS заблокирован политикой autoplay браузера' }
      }));
    }
  }

  // Обновить время последнего взаимодействия
  static updateUserInteraction(): void {
    if (typeof window !== 'undefined') {
      (window as any)._ttsLastInteraction = Date.now();
    }
  }

  // Проверить и активировать TTS после взаимодействия пользователя
  static async tryActivateTTS(): Promise<boolean> {
    console.log('🔄 Checking TTS activation...');

    if (this.hasUserActivation()) {
      console.log('✅ TTS is now activated');
      return true;
    }

    console.log('⏳ TTS still not activated - waiting for user interaction');
    return false;
  }

  // Повторно воспроизвести последний заблокированный TTS (после взаимодействия)
  static async retryLastTTS(): Promise<void> {
    console.log('🔄 Retrying last TTS after user interaction...');

    if (!this.hasUserActivation()) {
      console.warn('⚠️ Still no user activation');
      return;
    }

    // Здесь можно хранить последний текст для повтора
    // Пока просто логируем
    console.log('💡 User can now use TTS normally');
  }

  static async speakText(text: string, options: TTSOptions = {}): Promise<void> {
    console.log('🎙️ OpenAI TTS speakText called with text:', text.substring(0, 50) + '...');

    // Инициализируем отслеживание взаимодействия при первом использовании
    this.initInteractionTracking();

    try {
      // Проверяем доступность OpenAI TTS
      if (!isTTSAvailable()) {
        console.error('❌ OpenAI TTS not available - missing API key or browser audio support');
        throw new Error('OpenAI TTS not available: missing API key or browser does not support Audio API');
      }

      // Проверяем user activation для autoplay
      if (!this.hasUserActivation()) {
        console.warn('⚠️ No user activation detected - TTS may be blocked by browser autoplay policy');
        console.warn('💡 User needs to interact with the page first (click, tap, etc.)');

        // Показываем уведомление пользователю
        this.showAutoplayWarning();
        return;
      }

      console.log('✅ OpenAI TTS is available');

      // Force MP3 format for OpenAI TTS compatibility
      if (!options.format) {
        options.format = 'mp3';
      }
      console.log('🎵 OpenAI TTS using format:', options.format);

      // Останавливаем текущее воспроизведение
      this.stop();

      // Генерируем речь
      console.log('🎤 Calling generateSpeech...');
      const audioBuffer = await this.generateSpeech(text, options);
      console.log('✅ generateSpeech completed');

      // OpenAI TTS: Web Audio API is more reliable across browsers
      console.log('🎵 OpenAI TTS - Using Web Audio API...');
      console.log('🎵 Audio buffer size:', audioBuffer.byteLength, 'bytes');

      return new Promise<void>(async (resolve) => {
        const cleanup = () => {
          if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
          }
        };

        try {
          // Initialize AudioContext
          if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
              throw new Error('AudioContext not supported');
            }
            this.audioContext = new AudioContextClass();
            console.log('✅ AudioContext initialized, state:', this.audioContext.state);
          }

          // Ensure AudioContext is running (required after user interaction)
          if (this.audioContext.state === 'suspended') {
            console.log('🔄 Resuming suspended AudioContext...');
            await this.audioContext.resume();
            console.log('✅ AudioContext resumed, state:', this.audioContext.state);
          }

          // Make a copy of the buffer for decoding (decodeAudioData consumes the buffer)
          const bufferCopy = audioBuffer.slice(0);
          
          // Decode audio buffer
          console.log('🔄 Decoding audio buffer via Web Audio API...');
          
          // Use callback-based API for better Safari compatibility
          const decodedBuffer = await new Promise<AudioBuffer>((resolveBuffer, rejectBuffer) => {
            this.audioContext!.decodeAudioData(
              bufferCopy,
              (buffer) => {
                console.log('✅ Audio decoded, duration:', buffer.duration.toFixed(2), 's, channels:', buffer.numberOfChannels);
                resolveBuffer(buffer);
              },
              (error) => {
                console.error('❌ decodeAudioData failed:', error);
                rejectBuffer(error);
              }
            );
          });

          // Create and play using Web Audio API
          const source = this.audioContext.createBufferSource();
          source.buffer = decodedBuffer;
          source.connect(this.audioContext.destination);

          source.onended = () => {
            console.log('✅ OpenAI TTS playback completed');
            this.pauseVideo();
            cleanup();
            resolve();
          };

          console.log('▶️ Starting OpenAI TTS playback...');
          source.start(0);
          this.playVideo();
          console.log('✅ OpenAI TTS playback started successfully!');

        } catch (webAudioError: any) {
          console.error('❌ Web Audio API error:', webAudioError.message || webAudioError);
          console.log('🔄 OpenAI TTS failed, using browser speech synthesis...');
          
          // Browser speech synthesis is the only reliable fallback
          this.fallbackToBrowserTTS(text, resolve);
          cleanup();
        }
      });

    } catch (error) {
      console.error('❌ OpenAI TTS error:', error);
      // Don't throw - provide visual feedback instead
      console.log('⚠️ TTS failed completely, providing visual feedback only');
      // Return successfully to prevent app from breaking
      return;
    }
  }

  // Web Audio API fallback for OpenAI TTS
  private static async tryWebAudioFallback(audioBuffer: ArrayBuffer, resolve: () => void, cleanup: () => void): Promise<void> {
    try {
      console.log('🔄 OpenAI TTS: Trying Web Audio API as fallback...');

      // Initialize AudioContext for OpenAI TTS
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('✅ AudioContext initialized for OpenAI TTS fallback');
      }

      // Ensure AudioContext is running for OpenAI TTS
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('✅ AudioContext resumed for OpenAI TTS fallback');
      }

      // Decode OpenAI TTS audio buffer
      console.log('🔄 Decoding OpenAI TTS audio buffer via Web Audio...');
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
      console.log('✅ OpenAI TTS audio decoded, duration:', decodedBuffer.duration, 'seconds');

      // Create and play OpenAI TTS using Web Audio API
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.audioContext.destination);

      source.onended = () => {
        console.log('✅ OpenAI TTS Web Audio playback completed successfully');
        this.pauseVideo();
        cleanup();
        resolve();
      };

      console.log('▶️ 🚀 Starting OpenAI TTS playback via Web Audio API...');
      source.start(0);
      this.playVideo();
      console.log('✅ OpenAI TTS Web Audio playback started - using OpenAI voice!');

    } catch (webAudioError) {
      console.warn('⚠️ Web Audio API fallback also failed:', webAudioError.message);
      console.log('🔄 OpenAI TTS: Using browser speech synthesis as last resort...');

      // Final fallback: Browser speech synthesis
      this.fallbackToBrowserTTS('', resolve);
      cleanup();
    }
  }

  // Вспомогательная функция для конвертации ArrayBuffer в base64
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static stop(): void {
    // Останавливаем флаг для streaming
    this.shouldStop = true;
    this.isPlaying = false;
    this.audioQueue = [];
    
    // Останавливаем текущий AudioBufferSourceNode
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
    
    // Останавливаем HTML Audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    
    // Вызываем callback завершения если есть
    if (this.onPlaybackComplete) {
      this.onPlaybackComplete();
      this.onPlaybackComplete = null;
    }
    
    this.pauseVideo();
    console.log('🛑 TTS stopped');
  }

  static isPlayingAudio(): boolean {
    return this.isPlaying || (this.currentAudio !== null && !this.currentAudio.paused) || this.currentSource !== null;
  }

  // Set video element to sync with TTS
  static setVideoElement(video: HTMLVideoElement | null): void {
    this.videoElement = video;
    console.log('🎥 Video element set:', !!video);
    
    // Pause video initially
    if (video) {
      video.pause();
    }
  }

  // Play video when TTS starts
  private static playVideo(): void {
    if (this.videoElement) {
      console.log('▶️ Playing video');
      this.videoElement.play().catch((err) => {
        console.warn('⚠️ Could not play video:', err.message);
      });
    }
  }

  // Pause video when TTS stops
  private static pauseVideo(): void {
    if (this.videoElement) {
      console.log('⏸️ Pausing video');
      this.videoElement.pause();
    }
  }


  // Fallback method if MP3 fails - try browser's built-in speech synthesis
  private static async fallbackToSpeechSynthesis(text: string, resolve: () => void, reject: (error: Error) => void) {
    try {
      console.log('🔄 Falling back to browser speech synthesis...');

      if (!('speechSynthesis' in window)) {
        console.log('⚠️ Speech synthesis not available in browser');
        // Don't reject - just resolve as if speech worked (silent mode)
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU'; // Russian language
      utterance.rate = 0.9; // Slightly slower than default
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Set up event handlers
      let hasStarted = false;

      utterance.onstart = () => {
        console.log('✅ Speech synthesis started');
        hasStarted = true;
        this.playVideo();
      };

      utterance.onend = () => {
        console.log('✅ Speech synthesis ended');
        this.pauseVideo();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ Speech synthesis error:', event.error, event);

        // If speech synthesis fails due to autoplay policy, just resolve silently
        if (event.error === 'not-allowed' || event.error === 'interrupted') {
          console.log('⚠️ Speech blocked by browser policy, continuing silently');
          resolve();
        } else {
          // For other errors, still resolve but log the issue
          console.log('⚠️ Speech synthesis failed, continuing with visual feedback only');
          resolve();
        }
      };

      // Add timeout as safety net
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          console.log('⚠️ Speech synthesis timeout, continuing silently');
          resolve();
        }
      }, 5000); // 5 second timeout

      utterance.onstart = () => {
        clearTimeout(timeout);
        console.log('✅ Speech synthesis started');
        hasStarted = true;
        this.playVideo();
      };

      utterance.onend = () => {
        clearTimeout(timeout);
        console.log('✅ Speech synthesis ended');
        this.pauseVideo();
        resolve();
      };

      console.log('🎤 Attempting to speak via browser synthesis...');
      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('❌ Speech synthesis setup failed:', error);
      // Don't reject - resolve silently so the app continues working
      console.log('⚠️ Speech synthesis failed, continuing with visual feedback only');
      resolve();
    }
  }

  // Final fallback to browser speech synthesis
  private static async fallbackToBrowserTTS(text: string, resolve: () => void): Promise<void> {
    try {
      console.log('🔄 Using browser speech synthesis as fallback...');

      if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Speech synthesis not supported in this browser');
        resolve();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Find a Russian voice if available
      const voices = window.speechSynthesis.getVoices();
      const russianVoice = voices.find(v => v.lang.startsWith('ru'));
      if (russianVoice) {
        utterance.voice = russianVoice;
        console.log('🎤 Using Russian voice:', russianVoice.name);
      }

      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          this.pauseVideo();
          resolve();
        }
      };

      utterance.onstart = () => {
        console.log('✅ Browser speech synthesis started');
        this.playVideo();
      };

      utterance.onend = () => {
        console.log('✅ Browser speech synthesis completed');
        safeResolve();
      };

      utterance.onerror = (event) => {
        console.warn('⚠️ Browser speech synthesis error:', event.error);
        safeResolve();
      };

      // Timeout safety net
      setTimeout(() => {
        if (!resolved) {
          console.warn('⚠️ Browser speech synthesis timeout');
          window.speechSynthesis.cancel();
          safeResolve();
        }
      }, 30000); // 30 second timeout

      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('❌ Browser speech synthesis setup error:', error);
      this.pauseVideo();
      resolve();
    }
  }

  // Fallback to speech synthesis if MP3 fails
  private static async fallbackToWAV(audioBuffer: ArrayBuffer, text: string, resolve: () => void, reject: (error: Error) => void, cleanup: () => void) {
    try {
      console.log('🔄 Attempting speech synthesis fallback...');

      // Try speech synthesis first (more reliable)
      // Note: this function now always resolves, never rejects
      await this.fallbackToSpeechSynthesis(text, resolve, reject);
    } catch (speechError) {
      console.error('❌ All audio fallbacks failed');
      // Resolve anyway to prevent app from breaking
      console.log('⚠️ All audio methods failed, continuing with visual feedback only');
      resolve();
    }
  }
}

// Функция для проверки поддержки аудио формата
export async function isAudioFormatSupported(format: string): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;

  try {
    const audio = new Audio();
    const mimeType = format === 'aac' ? 'audio/aac' :
                     format === 'mp3' ? 'audio/mpeg' :
                     format === 'opus' ? 'audio/opus' :
                     format === 'flac' ? 'audio/flac' : 'audio/mpeg';

    const canPlay = audio.canPlayType(mimeType);
    console.log(`🎵 Format ${format} (${mimeType}) support:`, canPlay);
    return canPlay !== '';
  } catch (error) {
    console.warn('Error checking audio format support:', error);
    return false;
  }
}

// Функция для получения лучшего поддерживаемого формата
export async function getBestSupportedFormat(): Promise<string> {
  // MP3 is the most compatible format for Blob URLs across all browsers
  const formats = ['mp3', 'aac', 'opus', 'flac'];

  for (const format of formats) {
    if (await isAudioFormatSupported(format)) {
      console.log(`✅ Best supported format: ${format}`);
      return format;
    }
  }

  console.warn('❌ No supported audio formats found, using mp3 as fallback');
  return 'mp3'; // fallback
}

// Функция для проверки доступности TTS
export function isTTSAvailable(): boolean {
  // Проверяем поддержку Audio API в браузере
  // API ключ проверяется на сервере при фактическом запросе
  const hasAudioSupport = typeof Audio !== 'undefined' &&
                         typeof AudioContext !== 'undefined' &&
                         typeof window !== 'undefined' &&
                         typeof fetch !== 'undefined';

  return hasAudioSupport;
}

// Функция для проверки, разрешено ли автоматическое воспроизведение аудио
export async function isAutoplayAllowed(): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;

  try {
    const audio = new Audio();
    audio.volume = 0.01; // Очень тихий звук для теста
    audio.muted = true;

    // Пытаемся воспроизвести
    await audio.play();
    audio.pause();
    return true;
  } catch (error) {
    return false;
  }
}

// Функция для активации аудио после пользовательского взаимодействия
export function activateAudio(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🔊 Activating audio context...');

      // Multiple attempts to activate audio
      const activationPromises = [];

      // 1. Activate AudioContext
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const activationPromise = (async () => {
          try {
            const AudioContextClass = AudioContext || webkitAudioContext;
            const audioContext = new AudioContextClass();

            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log('✅ AudioContext activated');
            }

            // Test with a short beep
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);

            return true;
          } catch (error) {
            console.warn('⚠️ AudioContext activation failed:', error);
            return false;
          }
        })();
        activationPromises.push(activationPromise);
      }

      // 2. Test HTML Audio multiple times
      for (let i = 0; i < 3; i++) {
        const htmlAudioPromise = (async () => {
          try {
            const testAudio = new Audio();
            testAudio.volume = 0.01;
            testAudio.muted = true;
            testAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

            return new Promise<boolean>((resolveAudio) => {
              testAudio.onended = () => {
                console.log(`✅ HTML Audio test ${i + 1} successful`);
                resolveAudio(true);
              };

              testAudio.onerror = () => {
                console.log(`⚠️ HTML Audio test ${i + 1} failed`);
                resolveAudio(false);
              };

              testAudio.play().catch(() => {
                console.log(`⚠️ HTML Audio play ${i + 1} failed`);
                resolveAudio(false);
              });

              // Timeout fallback
              setTimeout(() => resolveAudio(false), 1000);
            });
          } catch (error) {
            console.log(`⚠️ HTML Audio setup ${i + 1} failed:`, error);
            return false;
          }
        })();
        activationPromises.push(htmlAudioPromise);
      }

      // 3. Test speech synthesis
      const speechPromise = (async () => {
        try {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('test');
            utterance.volume = 0.01;
            utterance.lang = 'ru-RU';

            return new Promise<boolean>((resolveSpeech) => {
              utterance.onstart = () => {
                console.log('✅ Speech synthesis test successful');
                resolveSpeech(true);
              };

              utterance.onend = () => {
                console.log('✅ Speech synthesis test completed');
                resolveSpeech(true);
              };

              utterance.onerror = () => {
                console.log('⚠️ Speech synthesis test failed');
                resolveSpeech(false);
              };

              window.speechSynthesis.speak(utterance);

              // Timeout fallback
              setTimeout(() => resolveSpeech(false), 2000);
            });
          }
          return false;
        } catch (error) {
          console.log('⚠️ Speech synthesis setup failed:', error);
          return false;
        }
      })();
      activationPromises.push(speechPromise);

      // Wait for all activation attempts
      const results = await Promise.all(activationPromises);
      const successCount = results.filter(Boolean).length;

      console.log(`🔊 Audio activation results: ${successCount}/${results.length} successful`);

      if (successCount > 0) {
        console.log('✅ Audio activation completed successfully');
        resolve();
      } else {
        console.log('⚠️ All audio activation methods failed');
        resolve(); // Still resolve to continue app functionality
      }

    } catch (error) {
      console.error('❌ Audio activation error:', error);
      // Always resolve to prevent app from breaking
      console.log('⚠️ Audio activation failed, continuing without audio');
      resolve();
    }
  });
}
