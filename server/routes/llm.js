/**
 * LLM API Routes
 * Handles LLM requests and responses
 * Updated to support GPT-5.1 (released Nov 12, 2025)
 */

const express = require('express');
const router = express.Router();

// Default model - GPT-5.1 (released November 12, 2025)
const DEFAULT_MODEL = 'gpt-5.1';
const DEFAULT_MAX_TOKENS = 10000;

/**
 * @route   POST /api/chat/completions
 * @desc    OpenAI-compatible chat completions endpoint (supports GPT-5.1)
 * @access  Private
 */
router.post('/chat/completions', async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens, stream } = req.body;
    
    // Проверяем, есть ли изображения в сообщениях
    const hasImages = messages?.some(m => 
      Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')
    );
    
    // Используем gpt-4o для изображений (поддерживает vision), иначе запрошенную модель
    let selectedModel = model || DEFAULT_MODEL;
    if (hasImages) {
      selectedModel = 'gpt-4o'; // gpt-4o поддерживает vision и лучше распознает рукописный текст
      console.log('🖼️ Images detected, switching to gpt-4o for vision support');
    }
    
    console.log('Chat completions request:', { 
      model: selectedModel,
      messagesCount: messages?.length,
      temperature,
      max_tokens: max_tokens || DEFAULT_MAX_TOKENS,
      stream,
      hasImages
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid messages array' });
    }

    // Get the last user message for context
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const systemMessage = messages.find(m => m.role === 'system');

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (openaiApiKey) {
      // Use real OpenAI API with GPT-5.1
      try {
        const requestBody = {
          model: selectedModel,
          messages: messages,
          temperature: temperature || 0.7,
          max_completion_tokens: max_tokens || DEFAULT_MAX_TOKENS,
          stream: stream || false
        };

        console.log(`🚀 Calling OpenAI API with model: ${selectedModel}`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('OpenAI API error:', errorData);
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        if (stream) {
          // Handle streaming response
          console.log('OpenAI streaming response started');
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          try {
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('Response body is not readable');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.trim()) {
                  // Forward OpenAI SSE format directly
                  res.write(`${line}\n`);
                }
              }
            }

            res.end();
            console.log('OpenAI streaming response completed');
          } catch (streamError) {
            console.error('Error in OpenAI streaming:', streamError);
            // Fall back to mock streaming if OpenAI streaming fails
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const mockContent = "Извините, произошла ошибка при потоковой передаче. Использую обычный ответ.\n\nОтлично! Давай изучим английский язык вместе!";

            const words = mockContent.split(' ');
            for (let i = 0; i < words.length; i++) {
              const chunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: selectedModel,
                choices: [{
                  index: 0,
                  delta: {
                    content: (i > 0 ? ' ' : '') + words[i]
                  },
                  finish_reason: null
                }]
              };

              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              await new Promise(resolve => setTimeout(resolve, 30));
            }

            const finalChunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: selectedModel,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop'
              }]
            };

            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          return;
        } else {
        const data = await response.json();
          console.log(`✅ OpenAI API response received (model: ${selectedModel})`);
        return res.json(data);
        }
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        // Fall through to mock response
      }
    }

    // Generate mock response based on conversation context
    let mockContent = '';
    
    // Check conversation context for better responses
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    if (assistantMessages.length === 0 && systemMessage) {
      // First message with system prompt - likely a lesson or general introduction
      const systemContent = systemMessage.content;
      
      if (systemContent.includes('урок') || systemContent.includes('Урок') || systemContent.includes('ПРИ ПЕРВОМ СООБЩЕНИИ')) {
        // Lesson welcome
        const courseTitleMatch = systemContent.match(/по\s+["']?([^"']+)["']?/);
        const courseTitle = courseTitleMatch ? courseTitleMatch[1] : 'английскому языку';
        
        const lessonNumberMatch = systemContent.match(/урок\s+(\d+)/);
        const lessonNumber = lessonNumberMatch ? lessonNumberMatch[1] : '';
        
        mockContent = `Добро пожаловать на урок по ${courseTitle}!${lessonNumber ? ` Это урок номер ${lessonNumber}.` : ''}

Я Юлия, твой персональный учитель. Сегодня мы будем изучать интересные темы и разбирать все вопросы, которые у тебя возникнут.

С чего бы ты хотел начать? Может быть, у тебя есть вопросы по текущей теме или хочешь разобрать домашнее задание?`;
      } else {
        mockContent = `Привет! Я Юлия, твой персональный учитель. 

${systemContent.includes('предмет') ? 'Я помогу тебе разобраться с любыми вопросами по учебе.' : 'Чем могу помочь тебе сегодня?'}

Расскажи, с каким предметом или темой тебе нужна помощь?`;
      }
    } else if (lastUserMessage) {
      // Ongoing conversation - respond based on user input
      const userInput = lastUserMessage.content?.toLowerCase() || '';

      if (userInput.includes('английск') || userInput.includes('english') || userInput.includes('изучить')) {
        mockContent = `Отлично! Давай изучим английский язык вместе! 

Я могу помочь тебе с:
• 📝 Основами грамматики (времена, артикли, предлоги)
• 🗣️ Развитием разговорных навыков
• 📖 Изучением новых слов и выражений
• ✍️ Практикой письма
• 👂 Развитием навыков понимания речи

Что конкретно ты хочешь изучить? Может быть, начнем с основ или у тебя есть какие-то конкретные темы, которые тебя интересуют?`;
      } else if (userInput.includes('домашн') || userInput.includes('задани') || userInput.includes('homework')) {
        mockContent = `Конечно, помогу с домашним заданием! Расскажи, что именно нужно сделать:

• Какое задание?
• По какой теме?
• Есть ли конкретные вопросы или сложности?

Я объясню материал и помогу разобраться с упражнениями.`;
      } else if (userInput.includes('тест') || userInput.includes('экзамен') || userInput.includes('контрольн')) {
        mockContent = `Подготовка к тестам - это важно! Я помогу тебе:

• Повторить ключевые темы
• Разобрать сложные моменты
• Потренироваться в решении типичных заданий
• Дать советы по подготовке

По какому предмету готовишься и какие темы нужно повторить?`;
      } else {
        mockContent = `Хорошо, давай разберем этот вопрос! 

${lastUserMessage.content}

Я помогу тебе разобраться с этой темой. Расскажи подробнее, что именно тебе непонятно или что ты хочешь узнать?`;
      }
    } else {
      mockContent = `Привет! Я Юлия, твой персональный учитель по всем школьным предметам.

Я могу помочь тебе с:
• 📚 Объяснением сложных тем
• ✏️ Решением домашних заданий
• 🎯 Подготовкой к контрольным и экзаменам
• ❓ Ответами на любые вопросы по учебе

Расскажи, с каким предметом или темой тебе нужна помощь?`;
    }

    if (stream) {
      // Send streaming response in SSE format
      console.log('Sending mock streaming chat completion response');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const words = mockContent.split(' ');
      let currentText = '';

      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];

        const chunk = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: selectedModel,
          choices: [{
            index: 0,
            delta: {
              content: (i > 0 ? ' ' : '') + words[i]
            },
            finish_reason: null
          }]
        };

        res.write(`data: ${JSON.stringify(chunk)}\n\n`);

        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send completion chunk
      const finalChunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: selectedModel,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };

      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Return regular JSON response
    const mockResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
        model: selectedModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: mockContent
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 100,
          completion_tokens: mockContent.length / 4,
          total_tokens: 100 + mockContent.length / 4
      }
    };

    console.log('Sending mock chat completion response');
    res.json(mockResponse);
    }
  } catch (error) {
    console.error('Error in chat completions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/audio/speech
 * @desc    Generate speech from text (OpenAI TTS)
 * @access  Private
 */
router.post('/audio/speech', async (req, res) => {
  try {
    console.log('TTS request received:', {
      model: req.body.model,
      inputLength: req.body.input?.length,
      voice: req.body.voice,
      response_format: req.body.response_format,
      speed: req.body.speed
    });

    const {
      model,
      input,
      voice = 'alloy',
      response_format = 'mp3',
      speed = 1.0
    } = req.body;

    if (!input) {
      console.log('Missing input parameter in TTS request');
      return res.status(400).json({ error: 'Missing input parameter' });
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.log('OpenAI API key not configured, returning mock response');
      // Return mock audio response as fallback
      const sampleRate = 22050;
      const channels = 1;
      const bitsPerSample = 16;
      const duration = 3;
      const dataSize = sampleRate * channels * bitsPerSample / 8 * duration;

      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + dataSize, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
      header.writeUInt16LE(channels * bitsPerSample / 8, 32);
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(dataSize, 40);

      const audioData = Buffer.alloc(dataSize, 0);
      const mockAudioData = Buffer.concat([header, audioData]);

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', mockAudioData.length);
      return res.send(mockAudioData);
    }

    // Use OpenAI TTS API
    console.log(`🎤 Calling OpenAI TTS API with model: ${model || 'tts-1'}, voice: ${voice}, format: ${response_format}`);

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'tts-1',
        input: input,
        voice: voice,
        response_format: response_format,
        speed: speed,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI TTS API error:', errorData);
      throw new Error(`OpenAI TTS API error: ${openaiResponse.status}`);
    }

    // Get the content type from OpenAI response
    const contentType = openaiResponse.headers.get('content-type') || 'audio/mpeg';

    // Stream the audio response directly to client
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');

    // Получаем бинарные данные напрямую (НЕ как текст!)
    const audioBuffer = await openaiResponse.arrayBuffer();
    const audioData = Buffer.from(audioBuffer);
    
    console.log('✅ OpenAI TTS audio received, size:', audioData.length, 'bytes');
    
    res.setHeader('Content-Length', audioData.length);
    res.send(audioData);
    
    console.log('✅ OpenAI TTS audio response sent to client');

  } catch (error) {
    console.error('Error in OpenAI TTS:', error);

    // Return mock audio as fallback
    const sampleRate = 22050;
    const channels = 1;
    const bitsPerSample = 16;
    const duration = 3;
    const dataSize = sampleRate * channels * bitsPerSample / 8 * duration;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const audioData = Buffer.alloc(dataSize, 0);
    const mockAudioData = Buffer.concat([header, audioData]);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', mockAudioData.length);
    res.send(mockAudioData);
  }
});

module.exports = router;
