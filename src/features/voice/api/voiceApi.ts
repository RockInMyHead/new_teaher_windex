/**
 * Voice API Module
 * Handles voice-related API calls for lesson generation and dynamic content
 * @module features/voice/api/voiceApi
 */

import type { ChatMessage } from '@/types/api';
import { sendChatCompletion } from '@/features/chat';

/**
 * Generate lesson notes for voice-based learning
 * @param lessonTitle - Title of the lesson
 * @param lessonTopic - Topic of the lesson
 * @param lessonAspects - Aspects or description of the lesson
 * @param language - Language for the lesson (defaults to Russian)
 * @returns Promise with array of lesson notes
 */
export async function generateVoiceLessonNotes(
  lessonTitle: string,
  lessonTopic: string,
  lessonAspects: string,
  language: string = 'ru-RU'
): Promise<string[]> {
  const systemPrompt = `Ты - учитель, который проводит урок "${lessonTitle}" по теме "${lessonTopic}".
Создай структурированные заметки урока, которые будут зачитываться ученику голосом.
Каждая заметка должна быть краткой (2-3 предложения) и логически завершённой.
Раздели урок на 5-7 ключевых заметок, которые можно зачитать последовательно.

Формат ответа: массив строк, каждая строка - одна заметка для зачитывания.`;

  const userPrompt = `Тема урока: ${lessonAspects}

Создай заметки урока на русском языке, которые будут зачитываться ученику голосом во время урока.`;

  const response = await sendChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model: 'gpt-3.5-turbo', temperature: 0.7, max_completion_tokens: 1000 }
  );

  // Parse the response into an array of notes
  const notes = response
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(line => line.length > 10); // Filter out very short lines

  return notes.length > 0 ? notes : [
    `Добро пожаловать на урок "${lessonTitle}". Сегодня мы изучаем "${lessonTopic}".`,
    `Основная тема урока: ${lessonAspects}`,
    'Во время урока вы можете задавать вопросы голосом.',
    'Учитель будет зачитывать материалы и отвечать на ваши вопросы.',
    'Удачи в изучении материала!'
  ];
}

/**
 * Generate dynamic lesson content based on student voice input
 * @param lessonContext - Current lesson information
 * @param studentInput - Student's voice input/question
 * @param conversationHistory - Previous conversation exchanges
 * @param language - Language for response
 * @returns Promise with teacher's response
 */
export async function generateVoiceDynamicContent(
  lessonContext: {
    title: string;
    topic: string;
    currentNote?: string;
    progress?: number;
  },
  studentInput: string,
  conversationHistory: Array<{ role: 'teacher' | 'student'; text: string }> = [],
  language: string = 'ru-RU'
): Promise<string> {
  const systemPrompt = `Ты - опытный учитель, проводящий голосовой урок по теме "${lessonContext.title}" (${lessonContext.topic}).
${lessonContext.currentNote ? `Текущая тема урока: ${lessonContext.currentNote}` : ''}
${lessonContext.progress ? `Прогресс урока: ${lessonContext.progress}%` : ''}

Отвечай на вопросы ученика понятно и по существу. Используй примеры и объяснения, адаптированные под уровень понимания ученика.
Поскольку это голосовой урок, делай ответы естественными для устной речи.
Отвечай на русском языке.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history (last 5 exchanges to keep context)
  const recentHistory = conversationHistory.slice(-5);
  recentHistory.forEach(entry => {
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
    max_completion_tokens: 500
  });
}

/**
 * Generate summary of the voice lesson
 * @param lessonTitle - Title of the lesson
 * @param conversationHistory - Full conversation history
 * @param duration - Duration of the lesson in minutes
 * @returns Promise with lesson summary
 */
export async function generateVoiceLessonSummary(
  lessonTitle: string,
  conversationHistory: Array<{ role: 'teacher' | 'student'; text: string }>,
  duration: number
): Promise<string> {
  const systemPrompt = `Ты - учитель, подводящий итоги голосового урока.
Создай краткое резюме урока, выделив ключевые моменты и достижения ученика.`;

  const conversationText = conversationHistory
    .map(entry => `${entry.role === 'teacher' ? 'Учитель' : 'Ученик'}: ${entry.text}`)
    .join('\n');

  const userPrompt = `Урок: "${lessonTitle}"
Продолжительность: ${duration} минут
Диалог урока:
${conversationText}

Создай краткое резюме урока (3-5 предложений) на русском языке.`;

  return sendChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model: 'gpt-3.5-turbo', temperature: 0.7, max_completion_tokens: 300 }
  );
}

/**
 * Process voice command or instruction
 * @param command - Voice command from student
 * @param lessonContext - Current lesson context
 * @returns Promise with appropriate response
 */
export async function processVoiceCommand(
  command: string,
  lessonContext: {
    title: string;
    topic: string;
    currentNoteIndex?: number;
    totalNotes?: number;
  }
): Promise<{
  action: 'continue' | 'repeat' | 'question' | 'summary' | 'unknown';
  response: string;
}> {
  const systemPrompt = `Ты - ИИ-помощник в голосовом уроке.
Определи тип запроса ученика и верни JSON с полями:
- action: "continue" | "repeat" | "question" | "summary" | "unknown"
- response: текстовый ответ для озвучки

Действия:
- continue: ученик хочет продолжить урок
- repeat: ученик просит повторить материал
- question: ученик задаёт вопрос по теме
- summary: ученик просит подвести итоги
- unknown: непонятный запрос`;

  const contextInfo = `Урок: "${lessonContext.title}"
Тема: "${lessonContext.topic}"
${lessonContext.currentNoteIndex !== undefined ? `Текущая заметка: ${lessonContext.currentNoteIndex + 1} из ${lessonContext.totalNotes || 0}` : ''}`;

  const userPrompt = `Запрос ученика: "${command}"

Контекст урока:
${contextInfo}`;

  const response = await sendChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { model: 'gpt-3.5-turbo', temperature: 0.3, max_completion_tokens: 200 }
  );

  try {
    const result = JSON.parse(response);
    return {
      action: result.action || 'unknown',
      response: result.response || 'Извините, не понял ваш запрос.'
    };
  } catch {
    return {
      action: 'unknown',
      response: response || 'Извините, не понял ваш запрос.'
    };
  }
}





