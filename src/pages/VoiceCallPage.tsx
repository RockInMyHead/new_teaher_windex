import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mic, Loader2, MicOff, PhoneOff } from 'lucide-react';
import { HeaderWithHero } from '@/components/Header';
import { useLearningProfile } from '@/hooks/useLearningProfile';
import { sessionService } from '@/services/sessionService';
import { learningProfileService } from '@/services/learningProfileService';
import { parseCourseId, getFullCourseTitle, getCourseById } from '@/config/courses';
import { OpenAITTS } from '@/lib/openaiTTS';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const VoiceCallPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get course ID from URL params
  const courseIdFromParams = searchParams.get('course') || '';
  const userIdFromStorage = sessionService.getUserId();

  // Learning profile hook - loads student profile and LLM context
  const {
    profile: learningProfile,
    llmContext,
    isLoading: isLoadingProfile,
    systemPrompt: profileSystemPrompt,
    analyzeAndUpdateFromLLM,
    loadLLMContext
  } = useLearningProfile({
    userId: userIdFromStorage,
    courseId: courseIdFromParams,
    autoLoad: !!courseIdFromParams
  });

  // State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speechTheses, setSpeechTheses] = useState<string[]>([]);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Lesson tracking
  const lessonStartTimeRef = useRef<Date | null>(null);
  
  // Use ref for lesson context to avoid closure issues
  const lessonContextRef = useRef<{
    title: string;
    topic: string;
    description: string;
  } | null>(null);

  // Refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const isActiveRef = useRef<boolean>(false);
  // videoRef removed - using CSS animated avatar instead
  // Web Speech Recognition instance
  const recognitionRef = useRef<any>(null);

  // Audio analysis refs
  const analyserRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio detection refs
  const speechFramesRef = useRef<number>(0);
  const silenceFramesRef = useRef<number>(0);
  const silenceAfterSpeechRef = useRef<number>(0);
  const speechDetectedRef = useRef<boolean>(false);
  const processingTypeRef = useRef<string | null>(null);

  // Audio calibration refs
  const isCalibrationDoneRef = useRef<boolean>(false);
  const calibrationSamplesRef = useRef<number[]>([]);
  const noiseFloorRef = useRef<number>(0);
  const isQuickCalibrationRef = useRef<boolean>(false);

  // Media recording refs
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // TTS Audio ref for cleanup
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Profile creation tracking
  const profileCreationAttemptedRef = useRef<boolean>(false);
  
  // Initialization tracking
  const initializationStartedRef = useRef<boolean>(false);

  // Audio detection constants
  const MIN_THRESHOLD = 5;
  const REQUIRED_SPEECH_FRAMES = 30;
  const MIN_SPEECH_DURATION = 15;
  const SILENCE_AFTER_SPEECH_FRAMES = 90;
  const QUICK_CALIBRATION_FRAMES = 30;
  const CALIBRATION_FRAMES = 150;

  // Web Speech API parameters
  const SILENCE_TIMEOUT = 2000; // 2 seconds of silence to consider speech ended

  // Toggle microphone mute/unmute
  const toggleMute = () => {
    if (isMuted) {
      // Unmute - resume listening
      setIsMuted(false);
      console.log('🎤 Microphone unmuted');
      if (!isListening && !isProcessing) {
        startListening();
      }
    } else {
      // Mute - stop listening
      setIsMuted(true);
      console.log('🔇 Microphone muted');
      stopListening();
    }
    // Hide audio blocked indicator after user interaction
    if (audioBlocked) {
      setAudioBlocked(false);
    }
  };

  // End lesson and navigate back
  const endLesson = async () => {
    console.log('📞 Ending lesson');

    // Evaluate lesson if we have enough data
    if (lessonStartTimeRef.current && messages.length > 1 && userIdFromStorage && courseIdFromParams) {
      try {
        console.log('📊 Evaluating lesson...');
        const lessonTitle = lessonContextRef.current?.title || 'Голосовой урок';
        const lessonTopic = lessonContextRef.current?.topic || '';

        // Convert messages to conversation format
        const conversationHistory = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        // Evaluate and save lesson assessment
        await learningProfileService.evaluateLesson(
          userIdFromStorage,
          courseIdFromParams,
          lessonTitle,
          lessonTopic,
          conversationHistory,
          lessonStartTimeRef.current,
          new Date()
        );

        console.log('✅ Lesson evaluation completed');
      } catch (error) {
        console.error('❌ Error evaluating lesson:', error);
      }
    }

    stopListening();
    cleanup();
    setSpeechTheses([]);
    // Hide audio blocked indicator after user interaction
    if (audioBlocked) {
      setAudioBlocked(false);
    }
    navigate(-1);
  };

  // Cleanup function
  // Stop TTS function (called when user starts speaking)
  const stopTTS = () => {
    console.log('🔇 Interrupting TTS due to user speech...');

    // Stop OpenAI TTS streaming
    OpenAITTS.stop();

    // Stop HTML Audio TTS (legacy fallback)
    if (currentAudioRef.current) {
      console.log('🔇 Stopping TTS audio...');
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }

    // Stop browser TTS (Speech Synthesis)
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      console.log('🔇 Stopping Speech Synthesis...');
      window.speechSynthesis.cancel();
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleanup started');
    
    // Stop OpenAI TTS streaming
    OpenAITTS.stop();
    
    // Stop TTS Audio (legacy fallback)
    if (currentAudioRef.current) {
      console.log('🔇 Stopping TTS audio...');
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    
    // Stop browser TTS (Speech Synthesis)
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      console.log('🔇 Stopping Speech Synthesis...');
      window.speechSynthesis.cancel();
    }
    
    // Stop Web Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Speech recognition stop error:', e);
      }
      recognitionRef.current = null;
    }
    
    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    isActiveRef.current = false;
    
    console.log('✅ Cleanup complete');
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('🛑 Recording stopped');
    }
  };

  // Setup audio analysis for speech detection
  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      source.connect(analyser);
      analyserRef.current = analyser;

      console.log('🎵 Audio analysis setup complete');
    } catch (error) {
      console.error('❌ Audio analysis setup failed:', error);
    }
  };

  // Handle speech audio processing
  const handleSpeech = async (audioBlob: Blob) => {
    try {
      console.log('🎤 Processing speech audio...', audioBlob.size, 'bytes');

      setIsProcessing(true);
      setError(null);

      // Convert blob to base64 for API
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;

          // Send to Whisper API for transcription
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio: base64Audio,
              language: 'ru'
            })
          });

          if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
          }

          const result = await response.json();
          const transcript = result.transcript || '';

          if (transcript.trim()) {
            console.log('📝 Transcribed:', transcript);
            await handleSpeechTranscript(transcript.trim());
          } else {
            console.log('🤷 Empty transcript, resuming listening...');
            resumeListening();
          }
        } catch (error) {
          console.error('❌ Transcription error:', error);
          setError('Ошибка распознавания речи');
          resumeListening();
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('❌ Speech handling error:', error);
      setIsProcessing(false);
      resumeListening();
    }
  };

  // Start Web Speech API listening
  const startListening = async () => {
    if (isActiveRef.current) {
      console.log('⚠️ Already active, skipping start');
      return;
    }

    try {
      console.log('🎤 Starting Web Speech API listening...');

      // Check if Web Speech API is available
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error('Web Speech API not supported in this browser');
      }

      // Cleanup any existing recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      // Get microphone access (required for Speech Recognition)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      audioStreamRef.current = stream;
      console.log('✅ Microphone access granted');

      // Create new recognition instance
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Configure recognition
      recognition.continuous = true; // Keep listening until stopped
      recognition.interimResults = true; // Get intermediate results
      recognition.lang = 'ru-RU'; // Russian language
      recognition.maxAlternatives = 1;

      isActiveRef.current = true;
      setIsListening(true);
      setError(null);

      let finalTranscript = '';
      let interimTranscript = '';

      recognition.onstart = () => {
        console.log('🎙️ Web Speech Recognition started');
        // TTS will be stopped automatically when new speech starts
      };

      recognition.onresult = async (event) => {
        interimTranscript = '';

        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            console.log('🎤 Final result:', transcript);

            // Process the final transcript
            if (transcript.trim().length > 0) {
              await handleSpeechTranscript(transcript.trim());
            }
          } else {
            interimTranscript += transcript;
            // Removed frequent interim result logging for performance
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);

        if (event.error === 'not-allowed') {
          setError('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.');
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          console.log('🤫 No speech detected, continuing...');
          // Continue listening - this is normal
        } else if (event.error === 'network') {
          console.warn('🌐 Network error, will retry...');
          setError('Проблема с сетью, пытаемся восстановить...');
          // Try to restart after a delay
          setTimeout(() => {
            if (isActiveRef.current) {
              console.log('🔄 Retrying speech recognition after network error...');
              startListening();
            }
          }, 2000);
        } else if (event.error === 'audio-capture') {
          console.warn('🎤 Audio capture error, restarting...');
          setError('Проблема с микрофоном, перезапускаем...');
          // Try to restart listening
          setTimeout(() => {
            if (isActiveRef.current) {
              console.log('🔄 Retrying speech recognition after audio capture error...');
              startListening();
            }
          }, 1000);
        } else if (event.error === 'not-available') {
          setError('Распознавание речи недоступно в этом браузере');
          setIsListening(false);
        } else {
          console.error('❌ Unhandled speech recognition error:', event.error);
          setError(`Ошибка распознавания речи: ${event.error}`);
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');

        // Restart if still active (unless it was stopped intentionally)
        if (isActiveRef.current) {
          console.log('🔄 Auto-restarting speech recognition...');
          setTimeout(() => startListening(), 100);
        }
      };

      // Start recognition
      recognition.start();
      console.log('🎤 Web Speech Recognition initiated');

    } catch (error) {
      console.error('❌ Start listening error:', error);

      if (error instanceof Error && error.message.includes('Web Speech API not supported')) {
        setError('Ваш браузер не поддерживает распознавание речи');
      } else {
      setError('Ошибка доступа к микрофону');
      }

      isActiveRef.current = false;
      setIsListening(false);
    }
  };


  // Detect audio levels with adaptive noise floor
  const detectAudio = () => {
    if (!isActiveRef.current || !analyserRef.current) {
      console.log('🛑 Detection stopped');
      return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average and max energy in voice frequency range (roughly bins 10-100 for typical sample rates)
    // Human voice is typically 85-255 Hz (low) to 3400 Hz (high)
    // We focus on bins that represent ~300-3000 Hz
    const voiceStartBin = Math.floor(bufferLength * 0.05); // ~5% of spectrum
    const voiceEndBin = Math.floor(bufferLength * 0.4); // ~40% of spectrum
    
    let sum = 0;
    let max = 0;
    let count = 0;
    
    for (let i = voiceStartBin; i < voiceEndBin && i < bufferLength; i++) {
      sum += dataArray[i];
      if (dataArray[i] > max) max = dataArray[i];
      count++;
    }
    
    const average = count > 0 ? sum / count : 0;
    
    // Calibration phase: measure background noise
    if (!isCalibrationDoneRef.current) {
      // Only add reasonable samples to calibration (filter out extreme spikes)
      if (average > 1 && average < 80) {
        calibrationSamplesRef.current.push(average);
      }
      
      // Use quick calibration (0.5s) for resume, full calibration (1.5s) for initial start
      const requiredFrames = isQuickCalibrationRef.current ? QUICK_CALIBRATION_FRAMES : CALIBRATION_FRAMES;
      
      if (calibrationSamplesRef.current.length >= requiredFrames) {
        // Calculate noise floor as average of calibration samples
        const noiseSum = calibrationSamplesRef.current.reduce((a, b) => a + b, 0);
        const measuredNoiseFloor = noiseSum / calibrationSamplesRef.current.length;
        
        // Set minimum noise floor to avoid zero threshold (optimized for quiet environments)
        noiseFloorRef.current = Math.max(measuredNoiseFloor, 3);
        
        isCalibrationDoneRef.current = true;
        const calibType = isQuickCalibrationRef.current ? 'Quick' : 'Full';
        console.log(`🎚️ ${calibType} calibration: measured=${measuredNoiseFloor.toFixed(2)}, actual=${noiseFloorRef.current.toFixed(2)}, threshold=${(noiseFloorRef.current * 2.0).toFixed(2)}`);
      } else {
        // Still calibrating, continue
        animationFrameRef.current = requestAnimationFrame(detectAudio);
        return;
      }
    }
    
    // Dynamic speech threshold: noise floor * 1.5 (adaptive to environment)
    const MIN_THRESHOLD = 8; // Минимальный абсолютный порог (lower for quiet speech)
    const dynamicThreshold = Math.max(noiseFloorRef.current * 1.5, MIN_THRESHOLD);

    // Periodic logging to debug detection issues (every 50 frames = ~2.5 seconds)
    if (speechFramesRef.current === 0 && silenceFramesRef.current % 50 === 0 && silenceFramesRef.current > 0) {
      console.log(`👂 Listening... avg=${average.toFixed(1)}, max=${max}, threshold=${dynamicThreshold.toFixed(1)} (normal speaking volume)`);
    }

    // После начала речи используем стабильный порог для детекции тишины
    const silenceThreshold = speechDetectedRef.current
      ? Math.max(dynamicThreshold * 0.5, MIN_THRESHOLD * 0.4) // Более низкий порог после речи для стабильности
      : dynamicThreshold; // Порог для начала речи

    // Адаптивная логика обнаружения речи с автоматической корректировкой порогов
    let effectiveSilenceThreshold = silenceThreshold;

    // Если уровни сигнала постоянно ниже порогов, автоматически снижаем пороги
    // Это помогает с тихой речью в тихой среде
    if (speechDetectedRef.current && silenceFramesRef.current > 100) {
      // После 5 секунд тишины при активной речи - снижаем порог
      effectiveSilenceThreshold = Math.max(silenceThreshold * 0.6, MIN_THRESHOLD * 0.3);
      console.log(`🎚️ Auto-adjusted silence threshold: ${effectiveSilenceThreshold.toFixed(1)} (was ${silenceThreshold.toFixed(1)})`);
    }

    const isSpeech = speechDetectedRef.current
      ? average > effectiveSilenceThreshold || max > noiseFloorRef.current * 1.8 // После начала речи - поддержание
      : average > dynamicThreshold || max > noiseFloorRef.current * 2.2; // Для начала речи
    
    if (isSpeech) {
      // Speech detected
      speechFramesRef.current++;
      silenceAfterSpeechRef.current = 0;

      // Mark that speech was detected
      if (speechFramesRef.current >= REQUIRED_SPEECH_FRAMES && !speechDetectedRef.current) {
        // Removed detailed speech analysis logging for performance
        speechDetectedRef.current = true;
      }
      
      // Log every 100 frames to monitor (less verbose)
      if (speechDetectedRef.current && speechFramesRef.current % 100 === 0) {
        console.log(`🗣️ Speaking... frames=${speechFramesRef.current}, avg=${average.toFixed(1)}, max=${max}, silence_threshold=${silenceThreshold.toFixed(1)}`);
      }
    } else {
      // Silence detected
      if (speechDetectedRef.current) {
        // We detected speech earlier, now counting silence after it
        silenceAfterSpeechRef.current++;
        
        if (silenceAfterSpeechRef.current === 1) {
          console.log(`🤫 Silence detected: avg=${average.toFixed(1)}, silence_threshold=${silenceThreshold.toFixed(1)}`);
        }
        
        if (silenceAfterSpeechRef.current % 30 === 0 && silenceAfterSpeechRef.current > 1) {
          console.log(`🤫 Silence progress: ${silenceAfterSpeechRef.current}/${SILENCE_AFTER_SPEECH_FRAMES}, avg=${average.toFixed(1)}`);
        }
        
        if (silenceAfterSpeechRef.current >= SILENCE_AFTER_SPEECH_FRAMES) {
          // Check minimum speech duration (at least 8 frames = ~0.4 seconds)
          const MIN_SPEECH_DURATION = 8;
          if (speechFramesRef.current >= MIN_SPEECH_DURATION) {
            console.log(`✅ SPEECH ENDED after ${silenceAfterSpeechRef.current} frames of silence (${speechFramesRef.current} speech frames)`);
          processingTypeRef.current = 'speech';
          stopRecording();
          } else {
            console.log(`⚠️ Speech too short (${speechFramesRef.current} frames), restarting listening...`);
            restartListening();
          }
          return;
        }
      } else {
        // No speech yet, just reset speech counter and continue listening
        silenceFramesRef.current++;
        speechFramesRef.current = 0;
        
        // Don't generate follow-up questions on silence - just keep listening
        // User will speak when ready
      }
    }

    // Continue detection
    animationFrameRef.current = requestAnimationFrame(detectAudio);
  };

  // Stop listening
  const stopListening = () => {
    console.log('⏹️ Stop listening called');

    // Stop Web Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Speech recognition stop error:', e);
      }
      recognitionRef.current = null;
    }

    isActiveRef.current = false;
    setIsListening(false);
    console.log('✅ Stop listening complete');
  };

  // Handle speech transcript from Web Speech API
  const handleSpeechTranscript = async (transcript: string) => {
    // Prevent concurrent processing
    if (isProcessing) {
      console.warn('⚠️ Already processing speech, skipping...');
      return;
    }

    try {
      console.log('🔊 Processing speech transcript...');
      setIsProcessing(true);

      // Use transcript directly from Web Speech API
      const transcription = transcript;

      if (!transcription || transcription.trim().length < 2) {
        console.warn('⚠️ Transcription too short');
        setIsProcessing(false);
        return;
      }

      // Basic validation - Web Speech API is usually reliable
      const hasOnlyEmoji = /^[\p{Emoji}\s]+$/u.test(transcription.trim());
      const hasWeirdChars = /[^\w\sа-яё\-.,!?;:()"«»—–…№÷×±=≠<>≤≥√∛∜∫∑∏∆∞∞°%‰‱\s]/gi.test(transcription.trim());

      if (hasOnlyEmoji || hasWeirdChars) {
        console.warn('⚠️ Transcription contains only emoji or weird characters:', transcription);
        setIsProcessing(false);
        return;
      }
      
      // Add user message
      setMessages(prev => [...prev, {
        role: 'user',
        content: transcription,
        timestamp: new Date()
      }]);

      // Get LLM response
      console.log('📤 Getting LLM response for transcription:', transcription.substring(0, 100) + '...');
      let response = await getLLMResponse(transcription);
      console.log('🤖 LLM response received, length:', response ? response.length : 0);
      
      // Handle empty or too short responses with fallback
      if (!response || response.trim().length < 10) {
        console.warn('⚠️ Empty LLM response, using fallback message');
        response = `Хорошо, ты сказал: "${transcription}". Давай разберём это подробнее. Что именно тебе непонятно?`;
      }
      
      // Extract theses from response
      const theses = extractTheses(response);
      setSpeechTheses(theses);
      
      // Clean response from headers for TTS and display
      const cleanResponse = cleanMarkdownHeaders(response);
      
      // Use cleaned response for TTS and display
      let textForTTS = cleanResponse;
      
      // Add assistant message (using cleaned response)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date()
      }]);

      setIsProcessing(false);

      // Speak response (without theses)
      setIsSpeaking(true);
      await speakText(textForTTS);
      setIsSpeaking(false);

      // Resume listening after TTS with delay to prevent audio conflicts
      setTimeout(() => {
        if (isActiveRef.current) {
          startListening();
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Handle speech transcript error:', error);
      setIsProcessing(false);
      setIsSpeaking(false);
      // Try to restart listening
      setTimeout(() => {
        if (isActiveRef.current) {
          startListening();
        }
      }, 1000);
    }
  };

  // Send welcome message when entering chat
  const sendWelcomeMessage = async () => {
    try {
      console.log('👋 Sending welcome message...');
      setIsProcessing(true);

      // Get welcome message from LLM
      const welcomeMessage = await getLLMResponse('');

      // Extract theses from response
      const theses = extractTheses(welcomeMessage);
      setSpeechTheses(theses);

      // Clean response from headers for TTS and display
      const cleanResponse = cleanMarkdownHeaders(welcomeMessage);

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date()
      }]);

      setIsProcessing(false);
      setIsSpeaking(true);
      await speakText(cleanResponse);
      setIsSpeaking(false);

      console.log('✅ Welcome message sent');
    } catch (error) {
      console.error('❌ Error sending welcome message:', error);
      setIsProcessing(false);
    }
  };

  // Handle silence
  const handleSilence = async () => {
    try {
      console.log('🤫 Processing silence...');
      setIsProcessing(true);

      const message = "Есть вопросы? Я готова помочь!";
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: message,
        timestamp: new Date()
      }]);

      setIsProcessing(false);
      setIsSpeaking(true);
      await speakText(message);
      setIsSpeaking(false);

      // Add delay before restarting to prevent echo
      console.log('⏸️ Waiting 2 seconds before restart to prevent echo...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      restartListening();

    } catch (error) {
      console.error('❌ Handle silence error:', error);
      setIsProcessing(false);
      setIsSpeaking(false);
      restartListening();
    }
  };

  // Resume listening after TTS with delay to prevent audio conflicts
  const resumeListening = async () => {
    if (isActiveRef.current) {
      console.log('⚠️ Already active, skipping resume');
      return;
    }

    try {
      console.log('⚡ Resuming listening after TTS...');
      
      // Reset detection state
      speechFramesRef.current = 0;
      silenceFramesRef.current = 0;
      silenceAfterSpeechRef.current = 0;
      speechDetectedRef.current = false;
      processingTypeRef.current = null;
      
      // Quick recalibration (0.5s) to adapt to current noise level
      isCalibrationDoneRef.current = false;
      calibrationSamplesRef.current = [];
      isQuickCalibrationRef.current = true;
      
      isActiveRef.current = true;
      setIsListening(true);
      setError(null);

      // Reuse existing stream or get new one
      let stream = audioStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        audioStreamRef.current = stream;
        console.log('✅ New microphone stream');
      } else {
        console.log('♻️ Reusing existing stream');
      }

      // Setup new MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const processingType = processingTypeRef.current;
        
        if (!processingType) {
          resumeListening();
          return;
        }

        if (audioChunksRef.current.length === 0) {
          resumeListening();
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 5000) {
          resumeListening();
          return;
        }

        if (processingType === 'speech') {
          await handleSpeech(audioBlob);
        } else if (processingType === 'silence') {
          resumeListening();
        }
      };

      mediaRecorder.start();
      console.log('🎙️ Recording resumed');

      // Setup audio analysis - always create fresh context after TTS to avoid conflicts
        setupAudioAnalysis(stream);

    } catch (error) {
      console.error('❌ Resume listening error:', error);

      // Handle specific errors
      if (error.name === 'AbortError') {
        console.warn('⚠️ Audio operation was aborted, retrying in 1 second...');
        setTimeout(() => {
          if (isActiveRef.current) {
            resumeListening();
          }
        }, 1000);
        return;
      }

      setError('Ошибка доступа к микрофону');
      isActiveRef.current = false;
      setIsListening(false);
    }
  };

  // Restart listening (full reset with recalibration)
  const restartListening = () => {
    console.log('🔄 Restarting listening...');

    // Reset all detection state
    speechFramesRef.current = 0;
    silenceFramesRef.current = 0;
    silenceAfterSpeechRef.current = 0;
    speechDetectedRef.current = false;
    processingTypeRef.current = null;
    
    // Reset noise calibration (full calibration)
    isCalibrationDoneRef.current = false;
    calibrationSamplesRef.current = [];
    noiseFloorRef.current = 0;
    isQuickCalibrationRef.current = false; // Full calibration
    
    setTimeout(() => startListening(), 1500);
  };

  // Check if Web Speech API is available
  const isWebSpeechSupported = (): boolean => {
    return !!(
      window.SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition
    );
  };

  // Check if lesson requires OpenAI (English, Chinese, Arabic)
  const shouldUseOpenAI = (): boolean => {
    const lessonContext = lessonContextRef.current;
    if (!lessonContext) return false;

    const title = lessonContext.title.toLowerCase();
    const description = lessonContext.description?.toLowerCase() || '';

    // Always use OpenAI for these languages
    return (
      title.includes('english') || title.includes('английский') ||
      title.includes('англ.') || description.includes('english') ||
      title.includes('китайский') || title.includes('chinese') ||
      title.includes('арабский') || title.includes('arabic') ||
      title.includes('arab.')
    );
  };

  // Transcribe audio with smart method selection
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    // Determine which transcription method to use
    const useOpenAI = shouldUseOpenAI();
    const webSpeechAvailable = isWebSpeechSupported();

    console.log('🎤 Transcription method selection:');
    console.log('  - OpenAI required:', useOpenAI);
    console.log('  - Web Speech available:', webSpeechAvailable);

    // Always use OpenAI for English, Chinese, Arabic
    if (useOpenAI) {
      console.log('🎯 Using OpenAI Whisper (required for this language)');
      return transcribeWithOpenAI(audioBlob);
    }

    // For other languages, try Web Speech API first, then OpenAI fallback
    if (webSpeechAvailable) {
      try {
        console.log('🎯 Trying Web Speech API first...');
        return await transcribeWithWebSpeech(audioBlob);
      } catch (webSpeechError) {
        console.log('⚠️ Web Speech API failed, falling back to OpenAI:', webSpeechError.message);
        return transcribeWithOpenAI(audioBlob);
      }
    } else {
      console.log('🎯 Web Speech API not available, using OpenAI');
      return transcribeWithOpenAI(audioBlob);
    }
  };

  // Transcribe with Web Speech API (client-side)
  const transcribeWithWebSpeech = async (audioBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check if Web Speech API is available
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        reject(new Error('Web Speech API not supported'));
        return;
      }

      // Web Speech API works with live microphone, not recorded audio
      // For now, we'll create a simple implementation that simulates recognition
      // TODO: Implement full Web Speech API integration for live recognition

      // For recorded audio, we'll use a timeout to simulate processing
      // and return a placeholder result
      setTimeout(() => {
        console.log('🎤 Web Speech API simulation for recorded audio');
        // In a real implementation, this would process the audioBlob
        // For now, we'll reject to use OpenAI fallback
        reject(new Error('Web Speech API requires live microphone access, using OpenAI fallback'));
      }, 100);
    });
  };

  // Transcribe with OpenAI Whisper
  const transcribeWithOpenAI = async (audioBlob: Blob): Promise<string> => {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      // Determine language based on lesson context
      const lessonContext = lessonContextRef.current;
      let language = 'ru'; // Default to Russian

      if (lessonContext) {
        const title = lessonContext.title.toLowerCase();
        const description = lessonContext.description?.toLowerCase() || '';

        // Check if it's an English lesson
        if (title.includes('english') || title.includes('английский') ||
            title.includes('англ.') || description.includes('english')) {
          language = 'en';
          console.log('🌍 Detected English lesson, using language: en');
        } else if (title.includes('китайский') || title.includes('chinese')) {
          language = 'zh';
          console.log('🌍 Detected Chinese lesson, using language: zh');
      } else if (title.includes('арабский') || title.includes('arabic') ||
                 title.includes('arab.')) {
        language = 'ar';
        console.log('🌍 Detected Arabic lesson, using language: ar');
        } else {
          console.log('🌍 Using default language: ru');
        }
      }

      formData.append('language', language);

      console.log('🎤 Sending transcription request to server...');

      const response = await fetch('/api/audio/transcriptions', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Transcription request failed:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Transcription result:', result.text?.substring(0, 50) + '...');
      return result.text || '';
  };

  // Clean markdown headers from response for better TTS and display
  const cleanMarkdownHeaders = (text: string): string => {
    // Remove headers like ## Приветствие, ## Разминка, ## Обратная связь, etc.
    // Also remove the empty lines that follow headers
    return text
      .replace(/^## .*$/gm, '') // Remove header lines
      .replace(/^\s*$/gm, '') // Remove empty lines
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single
      .trim();
  };

  // Extract key theses from LLM response - ONLY facts, definitions, and key educational points
  const extractTheses = (response: string): string[] => {
    const theses: string[] = [];
    
    // Clean the response
    const teacherResponse = response.trim();

    // Split into sentences (only by periods, not by ? or !)
    // This helps avoid extracting questions
    const sentences = teacherResponse
      .split(/(?<=[.!])\s+/)
      .filter(s => s.trim().length > 15);

    // Patterns that indicate DEFINITIONS and FACTS (high priority)
    const definitionPatterns = [
      /это\s+.{10,}/i,                          // "X - это Y"
      /называется?\s+.{5,}/i,                   // "называется X"
      /является\s+.{5,}/i,                      // "является X"
      /представляет\s+собой\s+.{5,}/i,         // "представляет собой X"
      /состоит\s+из\s+.{5,}/i,                  // "состоит из X"
      /включает\s+.{5,}/i,                      // "включает X"
      /делится\s+на\s+.{5,}/i,                  // "делится на X"
      /имеет\s+.{5,}/i,                         // "имеет X"
      /содержит\s+.{5,}/i,                      // "содержит X"
      /расположен[а]?\s+.{5,}/i,               // "расположен X"
      /находится\s+.{5,}/i,                     // "находится X"
      /омывается\s+.{5,}/i,                     // "омывается X"
      /граничит\s+с\s+.{5,}/i,                  // "граничит с X"
      /занимает\s+.{5,}/i,                      // "занимает X"
      /составляет\s+.{5,}/i,                    // "составляет X"
      /равен[а]?\s+.{3,}/i,                     // "равен X"
      /насчитывает\s+.{3,}/i,                   // "насчитывает X"
      /существует\s+.{5,}/i,                    // "существует X"
      /образуется\s+.{5,}/i,                    // "образуется X"
      /формируется\s+.{5,}/i,                   // "формируется X"
      /происходит\s+.{5,}/i,                    // "происходит X"
    ];

    // Phrases to SKIP (questions, conversational, prompts)
    const skipPatterns = [
      /\?/,                                      // Any question
      /слышал\s+ли/i,                           // "слышал ли"
      /знаешь\s+ли/i,                           // "знаешь ли"
      /можешь\s+ли/i,                           // "можешь ли"
      /хочешь\s+ли/i,                           // "хочешь ли"
      /^давай/i,                                 // "давай..."
      /^хорошо/i,                               // "хорошо..."
      /^отлично/i,                              // "отлично..."
      /^прекрасно/i,                            // "прекрасно..."
      /^замечательно/i,                         // "замечательно..."
      /^привет/i,                               // "привет..."
      /^здравствуй/i,                           // "здравствуй..."
      /меня\s+зовут/i,                          // "меня зовут..."
      /я\s+(юля|юлия|твой|ваш)/i,              // "я Юля/твой учитель"
      /выбери/i,                                // "выбери..."
      /скажи/i,                                 // "скажи..."
      /напиши/i,                                // "напиши..."
      /расскажи/i,                              // "расскажи..."
      /попробуй/i,                              // "попробуй..."
      /подумай/i,                               // "подумай..."
      /конечно/i,                               // "конечно..."
      /разумеется/i,                            // "разумеется..."
      /готов[а]?\s+начать/i,                   // "готов начать"
      /рад[а]?\s+что/i,                         // "рада что"
      /интересно/i,                             // "интересно..."
      /как\s+ты\s+думаешь/i,                   // "как ты думаешь"
      /что\s+ты\s+знаешь/i,                    // "что ты знаешь"
      /например/i,                              // "например" at start often leads to examples, not definitions
      /^если/i,                                 // "если..."
      /^когда/i,                                // "когда..."
    ];

    // First pass: find sentences with DEFINITIONS (highest quality theses)
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 30 || trimmed.length > 200) continue;

      // Skip if matches any skip pattern
      const shouldSkip = skipPatterns.some(pattern => pattern.test(trimmed));
      if (shouldSkip) continue;

      // Check if it's a definition
      const isDefinition = definitionPatterns.some(pattern => pattern.test(trimmed));

      if (isDefinition && theses.length < 3) {
        let cleanSentence = trimmed
          .replace(/^[*•-]\s*/, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/^[""''""]|[""''""]$/g, '')
          .replace(/^\d+\.\s*/, '')
          .trim();

        // Remove trailing punctuation if needed
        cleanSentence = cleanSentence.replace(/[.!]+$/, '').trim();

        if (cleanSentence.length >= 25 && !theses.includes(cleanSentence)) {
          theses.push(cleanSentence);
        }
      }
    }

    // Second pass: look for numbered/bulleted educational facts
    if (theses.length < 3) {
      const listItems = teacherResponse.match(/(?:\d+\.|\*\s*|-)\s*([^.!?\n]{20,})/gi) || [];

      for (const listItem of listItems) {
        if (theses.length >= 3) break;

        const cleanItem = listItem.replace(/^\d+\.|\*\s*|-/, '').trim();
        if (cleanItem.length < 25 || cleanItem.length > 150) continue;

        // Skip if matches any skip pattern
        const shouldSkip = skipPatterns.some(pattern => pattern.test(cleanItem));
        if (shouldSkip) continue;

        // Check if it contains educational content
        const hasDefinition = definitionPatterns.some(pattern => pattern.test(cleanItem));

        if (hasDefinition && !theses.includes(cleanItem)) {
          theses.push(cleanItem.replace(/[.!]+$/, '').trim());
        }
      }
    }

    // Third pass: extract any remaining factual statements
    if (theses.length < 3) {
      // Look for sentences with numbers/statistics (often factual)
      const factualPatterns = [
        /\d+\s*(км|м|млн|тыс|процент|%|градус|год|век|лет)/i,
        /самый\s+(большой|маленький|высокий|низкий|длинный|короткий|глубокий)/i,
        /крупнейший|важнейший|главный|основной/i,
      ];

      for (const sentence of sentences) {
        if (theses.length >= 3) break;

        const trimmed = sentence.trim();
        if (trimmed.length < 25 || trimmed.length > 150) continue;

        const shouldSkip = skipPatterns.some(pattern => pattern.test(trimmed));
        if (shouldSkip) continue;

        const isFactual = factualPatterns.some(pattern => pattern.test(trimmed));

        if (isFactual) {
          const cleanSentence = trimmed
            .replace(/^[*•-]\s*/, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/^\d+\.\s*/, '')
            .replace(/[.!]+$/, '')
            .trim();

          if (cleanSentence.length >= 25 && !theses.includes(cleanSentence)) {
            theses.push(cleanSentence);
          }
        }
      }
    }

    return theses.slice(0, 3);
  };

  // Get LLM response using GPT-5.1
  const getLLMResponse = async (userMessage: string): Promise<string> => {
    try {
      // Ensure we have at least basic course context
      if (!courseIdFromParams) {
        console.warn('⚠️ No courseId available for LLM response');
        return 'Извините, не удалось определить курс для урока.';
      }

      // Use current context by default, will be updated if direct load succeeds
      let effectiveLLMContext = llmContext;

    // Build system prompt like in Chat.tsx
    const buildSystemPrompt = () => {
      // Получаем название курса из конфига
      const { subject, level } = parseCourseId(courseIdFromParams || 'general');
      const courseTitle = getFullCourseTitle(courseIdFromParams || 'general', level);
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
      if (effectiveLLMContext?.learningProfile) {
        const lp = effectiveLLMContext.learningProfile;

        profileContext += '\n\n👤 ПРОФИЛЬ УЧЕНИКА ПО ЭТОМУ КУРСУ:';

        if (lp.weakTopics && lp.weakTopics.length > 0) {
          const unresolvedWeakTopics = lp.weakTopics.filter((t: any) => !t.resolved);
          if (unresolvedWeakTopics.length > 0) {
            profileContext += `\n⚠️ ПРОБЛЕМНЫЕ ТЕМЫ (уделяй особое внимание):`;
            unresolvedWeakTopics.forEach((t: any) => {
              profileContext += `\n  - ${t.topic}${t.details ? `: ${t.details}` : ''}`;
            });
          }
        }

        if (lp.strongTopics && lp.strongTopics.length > 0) {
          profileContext += `\n✅ СИЛЬНЫЕ СТОРОНЫ:`;
          lp.strongTopics.forEach((t: any) => {
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
          lp.recentTeacherNotes.slice(-3).forEach((note: any) => {
            profileContext += `\n  - ${note.note}`;
          });
        }
      }

      // Build lesson context if available
      const lessonContext = lessonContextRef.current;
      let lessonContextText = '';
      if (lessonContext) {
        lessonContextText = `\n📖 ТЕКУЩИЙ УРОК: "${lessonContext.title}" - ${lessonContext.topic}`;
        lessonContextText += `\nПлан: ${lessonContext.aspects || 'Изучаем тему урока'}`;
      }

      return `${basePrompt}
${profileContext}
${lessonContextText}

🎯 ТВОЙ ПОДХОД К ОБУЧЕНИЮ:
- Объясняй "на пальцах" - используй простые аналогии из жизни
- Разбивай сложные темы на понятные шаги
- Задавай вопросы для проверки понимания
- Хвали за успехи и мягко указывай на ошибки
- Если видишь проблему - добавь её в список проблемных тем

УЧЕНИК СКАЗАЛ: "${userMessage}"

Ответь как учитель по курсу "${courseTitle}". Будь дружелюбной, но профессиональной.`;
    };

    const systemPrompt = buildSystemPrompt();

    // Final check: if we still don't have course context, try to load it synchronously
    if (!effectiveLLMContext?.course && courseIdFromParams && userIdFromStorage) {
      // Attempting synchronous load...
      try {
        // Try to get context from learning profile service directly
        const directContext = await learningProfileService.getLLMContext(userIdFromStorage, courseIdFromParams);
        if (directContext?.course) {
          console.log('✅ Direct context load successful');
          // Use the loaded context for this specific call
          effectiveLLMContext = directContext;
        }
      } catch (error) {
        console.warn('⚠️ Direct context load failed:', error);
      }
    }

    console.log('📤 Sending to LLM with enhanced context');
    console.log('📚 Course:', effectiveLLMContext?.course?.title || courseIdFromParams);
    const currentLessonContext = lessonContextRef.current;
    if (currentLessonContext) {
      console.log('📖 Lesson:', currentLessonContext.title, '|', currentLessonContext.topic);
    }
    console.log('👤 Profile loaded:', !!effectiveLLMContext?.learningProfile);
    console.log('📋 Full LLM context:', {
      hasCourse: !!effectiveLLMContext?.course,
      hasProfile: !!effectiveLLMContext?.learningProfile,
      hasSystemInstructions: !!effectiveLLMContext?.systemInstructions
    });

    // Prepare messages array with conversation history
    const conversationMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const messagesForAPI = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('/api/chat/completions', {
        method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        messages: messagesForAPI,
        model: 'gpt-5.1',
        max_completion_tokens: 800,
        temperature: 0.6,
        top_p: 0.9
        })
      });

      if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('❌ Voice chat LLM request failed:', response.status, errorText);
      throw new Error('Voice chat LLM failed');
    }

      const result = await response.json();
      console.log('📥 LLM API response:', JSON.stringify(result).substring(0, 300));
      
      // Extract content safely
      const content = result?.choices?.[0]?.message?.content || '';
      if (!content) {
        console.warn('⚠️ LLM returned empty content, result:', result);
      }
      return content;
    } catch (error) {
      console.error('❌ Error in getLLMResponse:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw new Error('LLM failed');
    }
  };

  // Speak text with parallel sentence generation and sequential playback
  const speakText = async (text: string): Promise<void> => {
    try {
      console.log('🔊 Speaking with streaming TTS:', text.substring(0, 30) + '...');
      
      // Используем новый метод speakStreaming для параллельной генерации
      // и последовательного воспроизведения предложений
      await OpenAITTS.speakStreaming(text, {
        voice: 'nova',
          model: 'tts-1',
        speed: 1.0
      });
      
      console.log('✅ TTS streaming complete');
      setAudioBlocked(false);

    } catch (error) {
      console.error('❌ TTS streaming error, using fallback:', error);
      setAudioBlocked(true);

      // Fallback to browser TTS
      return new Promise((resolve) => {
        if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
          utterance.rate = 0.9;
          utterance.pitch = 1.0;

        utterance.onend = () => {
          console.log('✅ Browser TTS complete');
          resolve();
        };

          utterance.onerror = (error) => {
            console.error('❌ Browser TTS error:', error);
            resolve();
          };

        window.speechSynthesis.speak(utterance);
        } else {
          console.warn('⚠️ Speech synthesis not available');
          resolve();
        }
      });
    }
  };

  // Load lesson context from DB - reload when courseId changes
  useEffect(() => {
    // Reset lesson context when courseId changes
    if (lessonContextRef.current && !courseIdFromParams) {
      lessonContextRef.current = null;
    }

    const loadLessonContext = async () => {
      try {
        console.log('🔍 Checking user state for currentLesson...');
        const userState = await sessionService.getUserState();

        console.log('📦 Full user state:', userState);
        console.log('🎯 Expected courseId:', courseIdFromParams);
        console.log('📋 Stored courseId:', userState?.currentCourseId);

        // Check if userState contains data for the correct course
        const courseMatches = userState?.currentCourseId === courseIdFromParams || 
                               userState?.currentCourseId === String(courseIdFromParams);

        if (!courseMatches && userState?.currentCourseId) {
          console.log('⚠️ Course mismatch! UserState has data for:', userState?.currentCourseId, 'but we need:', courseIdFromParams);
          console.log('🧹 Clearing old lesson context data...');
          // Clear old data to force fresh lesson loading
          await sessionService.clearCourseState();
          console.log('✅ Old data cleared');
          // Don't return - continue to load correct lesson
        }

        // If we have matching course data, use it
        if (courseMatches && userState?.currentLessonData) {
          const lessonData = userState.currentLessonData;
          console.log('📦 Raw lesson data:', lessonData);

          // Build context from currentLessonData (same structure as Chat.tsx uses)
        const context = {
          title: lessonData.title || 'Урок',
          topic: lessonData.topic || '',
            // Use aspects as the main description (this is what Chat.tsx uses for lesson content)
            description: lessonData.aspects || lessonData.description || lessonData.content || ''
        };

        lessonContextRef.current = context;
        console.log('📚 Lesson context loaded from userState:');
        console.log('  Title:', context.title);
        console.log('  Topic:', context.topic);
          console.log('  Description:', context.description?.substring(0, 200) + '...');
        } else if (courseIdFromParams) {
          // If no matching data, try to load course from API
          console.log('📡 No matching lesson data, loading course from API...');
          try {
            const courseService = (await import('@/services/courseService')).default;
            const courseData = await courseService.getCourse(courseIdFromParams);
            
            if (courseData && courseData.currentLesson) {
              const context = {
                title: courseData.currentLesson.title || 'Урок',
                topic: courseData.currentLesson.topic || '',
                description: courseData.currentLesson.aspects || courseData.currentLesson.description || courseData.currentLesson.content || ''
              };
              
              lessonContextRef.current = context;
              console.log('📚 Lesson context loaded from API:');
              console.log('  Title:', context.title);
              console.log('  Topic:', context.topic);
            } else {
              console.warn('⚠️ No lesson data in course from API');
            }
          } catch (error) {
            console.error('❌ Error loading course from API:', error);
          }
      } else {
          console.warn('⚠️ No lesson context found and no courseId to load from');
      }
    } catch (error) {
      console.error('❌ Error loading lesson context:', error);
    }
    };
    loadLessonContext();
  }, [courseIdFromParams]);

  // Mount effect
  useEffect(() => {
    // Prevent multiple initializations
    if (initializationStartedRef.current) {
      console.log('⚠️ Initialization already started, skipping...');
      return;
    }

    initializationStartedRef.current = true;
    console.log('🎓 VoiceCallPage mounted');
    console.log('🎤 Web Speech API supported:', isWebSpeechSupported());
    console.log('📋 Course ID from params:', courseIdFromParams);
    console.log('👤 User ID:', userIdFromStorage);

    // Force load LLM context at startup to ensure it's available
    const forceLoadContext = async () => {
      if (userIdFromStorage && courseIdFromParams) {
        console.log('🔄 Force loading LLM context at startup...');
        try {
          await loadLLMContext();
          console.log('✅ LLM context force-loaded at startup');
        } catch (error) {
          console.warn('⚠️ Failed to force-load LLM context:', error);
        }
      }
    };

    // Send welcome message if chat is empty and lesson context is loaded
    const initializeChat = async () => {
      // First, ensure context is loaded
      await forceLoadContext();
      console.log('🎓 VoiceCallPage initializing...');
      console.log('📋 courseIdFromParams:', courseIdFromParams);
      console.log('👤 userIdFromStorage:', userIdFromStorage);
      console.log('🔄 isLoadingProfile:', isLoadingProfile);
      console.log('📚 lessonContextRef.current:', !!lessonContextRef.current);
      console.log('🤖 llmContext:', !!llmContext);

      // Wait for learning profile and lesson context to load (extended timeout)
      console.log('⏳ Waiting for profile and lesson context...');
      let attempts = 0;
      const maxAttempts = 50; // Increased from 20 to 50 (5 seconds total)

      // For voice lessons, we only need LLM context and course data, not lesson context
      while (attempts < maxAttempts && (isLoadingProfile || !llmContext || !llmContext?.course)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        // Логируем только один раз на 20-й попытке (каждые 2 секунды)
        if (attempts === 20) {
          console.log('⏳ Loading context...');
        }
      }

      console.log('✅ Wait complete - Loading:', isLoadingProfile, 'Lesson:', !!lessonContextRef.current, 'LLM Context:', !!llmContext);

      // If no learning profile loaded (but LLM context exists), try to create profile manually (only once)
      if (llmContext && !llmContext.learningProfile && userIdFromStorage && courseIdFromParams && !isLoadingProfile && !profileCreationAttemptedRef.current) {
        profileCreationAttemptedRef.current = true; // Mark as attempted
        console.log('📋 LLM context loaded but no learning profile found, creating profile manually...');
        try {
          // Create profile using the same method as chat
          await analyzeAndUpdateFromLLM('', 'system', `Начало голосового урока по курсу ${courseIdFromParams}`);

          // Wait for profile creation
          await new Promise(resolve => setTimeout(resolve, 500));

          console.log('✅ Profile created, reloading LLM context...');
          // Reload LLM context instead of reloading page
          await loadLLMContext();
          console.log('✅ LLM context reloaded');

        } catch (error) {
          console.warn('⚠️ Failed to create profile:', error);
          profileCreationAttemptedRef.current = false; // Reset on error to allow retry
        }
      }

      if (messages.length === 0) {
        console.log('💬 Chat is empty, sending welcome message...');
        await sendWelcomeMessage();
      }

    startListening();
    };

    initializeChat();

    return () => {
      console.log('🎓 VoiceCallPage unmounting');
      cleanup();
      initializationStartedRef.current = false; // Reset for next mount
      profileCreationAttemptedRef.current = false; // Reset for next mount
    };
  }, []);

  // Avatar animation is now CSS-based, no video control needed

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderWithHero />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться назад
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Video Avatar */}
              <div className="text-center">
                <div className="relative inline-block">
                  {/* Animated avatar - always visible */}
                  <div 
                    className="w-48 h-48 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 border-4 border-gray-200 shadow-lg flex items-center justify-center text-white text-6xl font-bold relative overflow-hidden"
                  >
                    <span className="z-10">Ю</span>
                    {/* Animated background when speaking */}
                    {isSpeaking && (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 animate-pulse" />
                    )}
                    {/* Listening indicator */}
                    {isListening && (
                      <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-ping opacity-50" />
                    )}
                  </div>

                  {/* Status overlay */}
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md border">
                    {isListening && (
                      <div className="flex items-center gap-2 text-green-600">
                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Слушает</span>
                  </div>
                )}
                {isProcessing && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-sm font-medium">Обрабатывает</span>
                  </div>
                )}
                {isSpeaking && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Говорит</span>
                      </div>
                    )}
                  </div>

                  {/* Audio blocked indicator */}
                  {audioBlocked && (
                    <div
                      className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg shadow-md max-w-xs cursor-pointer hover:bg-yellow-100 transition-colors"
                      onClick={() => setAudioBlocked(false)}
                    >
                      <div className="text-xs text-yellow-800 text-center">
                        <div className="flex items-center justify-center gap-1 font-medium mb-1">
                          🔇 Автовоспроизведение заблокировано
                        </div>
                        <div className="text-xs opacity-90">
                          Нажмите на любую кнопку для включения звука
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Control buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  onClick={toggleMute}
                  className="flex items-center gap-2"
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                </Button>
              </div>

              {/* Key Theses - Displayed between microphone button and end lesson button */}
              {speechTheses.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Ключевые тезисы урока
                  </h3>
                  <ol className="space-y-2">
                    {speechTheses.map((thesis, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className="flex-1">{thesis}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() => setSpeechTheses([])}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Скрыть
                  </button>
                </div>
              )}

              {/* End lesson button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={endLesson}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <PhoneOff className="w-4 h-4" />
                  Завершить урок
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VoiceCallPage;
