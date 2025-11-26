/**
 * Chat API Module
 * Handles all API calls related to chat completions
 * @module features/chat/api/chatApi
 */

import type { ChatMessage } from '@/types/api';

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_completion_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: 'assistant' | 'user' | 'system';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send a chat completion request to the API
 * @param messages - Array of chat messages
 * @param options - Optional configuration (model, temperature, max_completion_tokens)
 * @returns Promise with the assistant's response content
 */
export async function sendChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const {
    model = 'gpt-3.5-turbo',
    temperature = 0.7,
    max_completion_tokens = 2000
  } = options;

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_completion_tokens
    })
  });

  if (!response.ok) {
    if (response.status === 500) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message?.includes('OpenAI API key not properly configured')) {
        throw new Error('OpenAI API ключ не настроен. Пожалуйста, настройте правильный API ключ в файле .env');
      }
    }
    throw new Error(`API request failed: ${response.status}`);
  }

  const data: ChatCompletionResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Generate lesson plan using AI
 * @param lessonTitle - Title of the lesson
 * @param lessonTopic - Topic of the lesson
 * @param lessonAspects - Aspects or description of the lesson
 * @returns Promise with parsed lesson plan JSON
 */
export async function generateLessonPlan(
  lessonTitle: string,
  lessonTopic: string,
  lessonAspects: string
): Promise<any> {
  const prompt = `Создай урок для ученика по теме: "${lessonTitle}" (${lessonTopic}).

Тема урока: ${lessonAspects}

Создай урок в формате JSON со следующей структурой:
{
  "title": "Название урока",
  "objective": "Цель урока (1-2 предложения)",
  "duration": "Продолжительность урока в минутах",
  "materials": ["список необходимых материалов"],
  "content": "Полный конспект урока для ученика с объяснениями, примерами и упражнениями",
  "practice": [
    {
      "type": "exercise|question|task",
      "description": "Описание упражнения или задания",
      "example": "Пример выполнения"
    }
  ],
  "assessment": "Вопросы для проверки понимания или тест"
}

Урок должен быть написан для ученика, а не для учителя. Включи полные объяснения, примеры и практические задания.`;

  const content = await sendChatCompletion(
    [{ role: 'user', content: prompt }],
    { model: 'gpt-3.5-turbo', temperature: 0.7, max_completion_tokens: 2000 }
  );

  // Parse JSON from response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
  const planJson = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

  return JSON.parse(planJson);
}

/**
 * Generate dynamic lesson content based on student interaction
 * @param lessonContext - Context about the lesson
 * @param studentInput - Student's question or input
 * @param conversationHistory - Previous conversation exchanges
 * @returns Promise with the teacher's response
 */
export async function generateDynamicLessonContent(
  lessonContext: {
    title: string;
    topic: string;
    currentSection?: string;
  },
  studentInput: string,
  conversationHistory: Array<{ role: 'teacher' | 'student'; text: string }> = []
): Promise<string> {
  const systemPrompt = `Ты - опытный учитель, проводящий урок по теме "${lessonContext.title}" (${lessonContext.topic}).
${lessonContext.currentSection ? `Текущий раздел урока: ${lessonContext.currentSection}` : ''}

Ответь на вопрос ученика понятно и по существу. Используй примеры и объяснения, адаптированные под уровень понимания ученика.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history
  conversationHistory.forEach(entry => {
    messages.push({
      role: entry.role === 'teacher' ? 'assistant' : 'user',
      content: entry.text
    });
  });

  // Add current student input
  messages.push({ role: 'user', content: studentInput });

  return sendChatCompletion(messages, {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_completion_tokens: 800
  });
}

/**
 * Process text message in lesson context
 * @param messageContent - The text message from student
 * @param lessonContext - Current lesson information
 * @returns Promise with the response
 */
export async function processTextMessage(
  messageContent: string,
  lessonContext: any
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Ты - учитель, проводящий урок "${lessonContext.title}". Ответь на сообщение ученика.`
    },
    { role: 'user', content: messageContent }
  ];

  return sendChatCompletion(messages, {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_completion_tokens: 500
  });
}





