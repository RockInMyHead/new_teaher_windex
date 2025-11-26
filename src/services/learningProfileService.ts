/**
 * Learning Profile Service
 * Сервис для работы с профилем обучения пользователя
 * 
 * Отвечает за:
 * - Получение и обновление профиля обучения
 * - Формирование контекста для LLM
 * - Анализ ответов LLM и обновление профиля
 */

import { api } from './api';

// Типы данных
export interface WeakTopic {
  topic: string;
  details?: string;
  severity: 'low' | 'medium' | 'high';
  addedAt: string;
  resolved: boolean;
}

export interface StrongTopic {
  topic: string;
  masteryLevel: number; // 0-100
  addedAt: string;
}

export interface HomeworkEntry {
  id: string;
  task: string;
  assignedAt: string;
  dueAt?: string;
  status: 'pending' | 'submitted' | 'reviewed' | 'overdue';
  submittedAt?: string;
  feedback?: string;
}

export interface TeacherNote {
  id: string;
  note: string;
  category: 'general' | 'progress' | 'concern' | 'recommendation';
  createdAt: string;
}

export interface LearningProfile {
  id: string;
  userId: string;
  courseId: string;
  strongTopics: StrongTopic[];
  weakTopics: WeakTopic[];
  homeworkHistory: HomeworkEntry[];
  currentHomework?: string;
  currentHomeworkAssignedAt?: string;
  currentHomeworkDueAt?: string;
  currentHomeworkStatus: 'pending' | 'submitted' | 'reviewed' | 'overdue';
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  learningPace: 'slow' | 'normal' | 'fast';
  currentTopicUnderstanding: number; // 1-10
  teacherNotes: TeacherNote[];
  nextLessonRecommendations?: string;
  subjectMasteryPercentage: number; // 0-100
  topicsCompleted: number;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLMContext {
  student: {
    id: string;
    name: string;
    level: number;
  };
  course: {
    id: string;
    title: string;
    subject: string;
    grade?: number;
    description?: string;
  };
  currentLesson?: {
    number: number;
    title: string;
    topic: string;
    description?: string;
    content?: string;
  };
  learningProfile?: {
    strongTopics: StrongTopic[];
    weakTopics: WeakTopic[];
    currentHomework?: string;
    currentHomeworkStatus?: string;
    learningStyle?: string;
    learningPace?: string;
    currentTopicUnderstanding?: number;
    subjectMasteryPercentage?: number;
    recentTeacherNotes: TeacherNote[];
    nextLessonRecommendations?: string;
    topicsCompleted?: number;
  };
  systemInstructions: string;
}

/**
 * Класс сервиса профиля обучения
 */
class LearningProfileService {
  /**
   * Получить профиль обучения пользователя по курсу
   */
  async getProfile(userId: string, courseId: string): Promise<LearningProfile> {
    const response = await api.get<{ profile: LearningProfile }>(
      `/learning-profile/${userId}/${courseId}`
    );
    return response.profile;
  }

  /**
   * Обновить профиль обучения
   */
  async updateProfile(
    userId: string,
    courseId: string,
    updates: Partial<LearningProfile>
  ): Promise<LearningProfile> {
    const response = await api.post<{ profile: LearningProfile }>(
      `/learning-profile/${userId}/${courseId}`,
      updates
    );
    return response.profile;
  }

  /**
   * Добавить проблемную тему
   */
  async addWeakTopic(
    userId: string,
    courseId: string,
    topic: string,
    details?: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<WeakTopic[]> {
    const response = await api.post<{ weakTopics: WeakTopic[] }>(
      `/learning-profile/${userId}/${courseId}/add-weak-topic`,
      { topic, details, severity }
    );
    return response.weakTopics;
  }

  /**
   * Добавить сильную тему
   */
  async addStrongTopic(
    userId: string,
    courseId: string,
    topic: string,
    masteryLevel: number = 80
  ): Promise<StrongTopic[]> {
    const response = await api.post<{ strongTopics: StrongTopic[] }>(
      `/learning-profile/${userId}/${courseId}/add-strong-topic`,
      { topic, masteryLevel }
    );
    return response.strongTopics;
  }

  /**
   * Назначить домашнее задание
   */
  async assignHomework(
    userId: string,
    courseId: string,
    homework: string,
    dueAt?: string
  ): Promise<HomeworkEntry> {
    const response = await api.post<{ homework: HomeworkEntry }>(
      `/learning-profile/${userId}/${courseId}/assign-homework`,
      { homework, dueAt }
    );
    return response.homework;
  }

  /**
   * Добавить заметку учителя
   */
  async addTeacherNote(
    userId: string,
    courseId: string,
    note: string,
    category: 'general' | 'progress' | 'concern' | 'recommendation' = 'general'
  ): Promise<TeacherNote> {
    const response = await api.post<{ note: TeacherNote }>(
      `/learning-profile/${userId}/${courseId}/add-teacher-note`,
      { note, category }
    );
    return response.note;
  }

  /**
   * Получить контекст для LLM
   */
  async getLLMContext(userId: string, courseId: string): Promise<LLMContext> {
    return api.get<LLMContext>(`/learning-profile/${userId}/${courseId}/llm-context`);
  }

  /**
   * Оценить урок и сохранить оценку
   */
  async evaluateLesson(
    userId: string,
    courseId: string,
    lessonTitle: string,
    lessonTopic: string,
    conversationHistory: Array<{role: string, content: string}>,
    lessonStartTime: Date,
    lessonEndTime: Date
  ): Promise<{
    grade: 2 | 3 | 4 | 5;
    feedback: string;
    strengths: string[];
    improvements: string[];
  }> {
    try {
      // Рассчитать длительность урока
      const durationMs = lessonEndTime.getTime() - lessonStartTime.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Подготовить историю разговора для анализа
      const conversationText = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Ученик' : 'Учитель'}: ${msg.content}`)
        .join('\n\n');

      // Создать промпт для оценки урока
      const evaluationPrompt = `
Ты - опытный учитель, оценивающий урок по шкале 2-5 (российская система).

УРОК: "${lessonTitle}" - ${lessonTopic}
ВРЕМЯ УРОКА: ${durationMinutes} минут
ИСТОРИЯ РАЗГОВОРА:
${conversationText}

ОЦЕНИ УРОК ПО СЛЕДУЮЩИМ КРИТЕРИЯМ:

1. ПОНИМАНИЕ МАТЕРИАЛА (ученик правильно отвечает, задает вопросы)
2. АКТИВНОСТЬ (ученик участвует в разговоре, пробует решать задачи)
3. ПРОГРЕСС (ученик показывает улучшение по сравнению с предыдущими ответами)
4. ВЫПОЛНЕНИЕ ЗАДАНИЙ (ученик правильно решает предложенные задачи)

ВЫСТАВЬ ОЦЕНКУ 2, 3, 4 ИЛИ 5:
- 5 (ОТЛИЧНО): Ученик отлично понимает материал, активно участвует, показывает значительный прогресс
- 4 (ХОРОШО): Ученик хорошо понимает материал, участвует в уроке, показывает прогресс
- 3 (УДОВЛЕТВОРИТЕЛЬНО): Ученик понимает основные моменты, но есть пробелы, требует дополнительного объяснения
- 2 (НЕУДОВЛЕТВОРИТЕЛЬНО): Ученик не понимает материал, не участвует активно, много ошибок

НАПИШИ ОБРАТНУЮ СВЯЗЬ:
- Кратко похвали за успехи
- Укажи на ошибки и как их исправить
- Дай советы по улучшению

ВЕРНИ ОТВЕТ В ФОРМАТЕ JSON:
{
  "grade": 5,
  "feedback": "Краткая обратная связь",
  "strengths": ["Сильная сторона 1", "Сильная сторона 2"],
  "improvements": ["Что улучшить 1", "Что улучшить 2"]
}
`;

      // Получить оценку от LLM
      const evaluationResponse = await api.post('/chat/completions', {
        messages: [{ role: 'system', content: evaluationPrompt }],
        model: 'gpt-3.5-turbo',
        max_completion_tokens: 500,
        temperature: 0.3
      });

      const evaluationText = evaluationResponse.data.choices[0].message.content;

      // Парсить JSON ответ
      let evaluation;
      try {
        // Найти JSON в ответе
        const jsonMatch = evaluationText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evaluation = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('JSON not found in response');
        }
      } catch (parseError) {
        console.warn('Ошибка парсинга оценки LLM, использую fallback:', parseError);
        // Fallback оценка
        evaluation = {
          grade: 4,
          feedback: 'Хорошая работа на уроке!',
          strengths: ['Активное участие'],
          improvements: ['Можно больше практиковать']
        };
      }

      // Сохранить оценку урока
      await this.saveLessonAssessment(userId, courseId, {
        lessonTitle,
        lessonTopic,
        durationMinutes,
        grade: evaluation.grade,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements
      });

      console.log('✅ Урок оценен и сохранен:', evaluation);
      return evaluation;

    } catch (error) {
      console.error('❌ Ошибка оценки урока:', error);
      // Fallback оценка в случае ошибки
      const fallback = {
        grade: 3 as const,
        feedback: 'Урок завершен. Продолжай практиковаться!',
        strengths: ['Участие в уроке'],
        improvements: ['Больше практики']
      };

      // Попытаться сохранить fallback оценку
      try {
        await this.saveLessonAssessment(userId, courseId, {
          lessonTitle,
          lessonTopic,
          durationMinutes: Math.round((lessonEndTime.getTime() - lessonStartTime.getTime()) / (1000 * 60)),
          ...fallback
        });
      } catch (saveError) {
        console.error('❌ Ошибка сохранения fallback оценки:', saveError);
      }

      return fallback;
    }
  }

  /**
   * Анализировать ответ LLM и обновить профиль
   * Вызывается после каждого ответа LLM для автоматического обновления профиля
   */
  async analyzeAndUpdateProfile(
    userId: string,
    courseId: string,
    llmResponse: string,
    userMessage: string
  ): Promise<void> {
    try {
      // Анализируем ответ LLM на наличие домашнего задания
      const homeworkMatch = this.extractHomework(llmResponse);
      if (homeworkMatch) {
        await this.assignHomework(userId, courseId, homeworkMatch);
        console.log('📚 Домашнее задание назначено:', homeworkMatch);
      }

      // Анализируем на наличие проблемных тем
      const weakTopics = this.extractWeakTopics(llmResponse, userMessage);
      for (const topic of weakTopics) {
        await this.addWeakTopic(userId, courseId, topic.topic, topic.details, topic.severity);
        console.log('⚠️ Проблемная тема добавлена:', topic.topic);
      }

      // Анализируем на наличие сильных сторон
      const strongTopics = this.extractStrongTopics(llmResponse, userMessage);
      for (const topic of strongTopics) {
        await this.addStrongTopic(userId, courseId, topic.topic, topic.masteryLevel);
        console.log('✅ Сильная тема добавлена:', topic.topic);
      }

      // Добавляем заметку учителя если есть важная информация
      const teacherNote = this.extractTeacherNote(llmResponse, userMessage);
      if (teacherNote) {
        await this.addTeacherNote(userId, courseId, teacherNote.note, teacherNote.category);
        console.log('📝 Заметка учителя добавлена');
      }

      // Обновляем уровень понимания на основе диалога
      const understanding = this.assessUnderstanding(llmResponse, userMessage);
      if (understanding !== null) {
        await this.updateProfile(userId, courseId, {
          currentTopicUnderstanding: understanding
        });
        console.log('📊 Уровень понимания обновлен:', understanding);
      }

    } catch (error) {
      console.error('Ошибка при анализе и обновлении профиля:', error);
    }
  }

  /**
   * Извлечь домашнее задание из ответа LLM
   */
  private extractHomework(response: string): string | null {
    // Паттерны для поиска домашнего задания
    const patterns = [
      /домашн(?:ее|ее|ие)\s*задани(?:е|я)[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /на\s*дом[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /задани(?:е|я)\s*на\s*дом[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /д[\/]?з[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /homework[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /📚\s*ДЗ[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /📝\s*Задание[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /к\s*следующему\s*уроку[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /попробуй\s*(?:дома\s*)?(?:выполнить|сделать|решить)[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
      /потренируйся\s*(?:дома)?[:\s]*(.+?)(?:\.(?:\s|$)|$)/i,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        // Очищаем результат от лишних символов
        let homework = match[1].trim();
        // Убираем завершающие знаки пунктуации
        homework = homework.replace(/[.!?]+$/, '').trim();
        if (homework.length > 10) {
          console.log('📚 [LearningProfile] Обнаружено ДЗ:', homework);
          return homework;
        }
      }
    }

    return null;
  }

  /**
   * Извлечь проблемные темы из диалога
   */
  private extractWeakTopics(
    response: string,
    userMessage: string
  ): Array<{ topic: string; details: string; severity: 'low' | 'medium' | 'high' }> {
    const weakTopics: Array<{ topic: string; details: string; severity: 'low' | 'medium' | 'high' }> = [];
    const addedTopics = new Set<string>(); // Избегаем дубликатов

    // Паттерны, указывающие на проблемы ученика (из ответа учителя)
    const teacherProblemPatterns: Array<{ pattern: RegExp; severity: 'low' | 'medium' | 'high'; details: string }> = [
      { pattern: /(?:давай|нужно|стоит)\s*(?:ещё раз|повторить|разобрать)\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Нужно повторить' },
      { pattern: /(?:ты|вы)\s*(?:путаешь|путаете|ошибаешься|ошибаетесь)\s*(?:в|с)?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'high', details: 'Ученик путает' },
      { pattern: /(?:обрати|обратите)\s*внимание\s*на\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Требует внимания' },
      { pattern: /(?:сложность|проблема|трудность)\s*(?:с|в)?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'high', details: 'Выявлена сложность' },
      { pattern: /не\s*(?:совсем|до конца)\s*(?:понял|поняла|понятно)\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Не полностью понято' },
      { pattern: /⚠️\s*(.+?)(?:\.|\?|!|$)/i, severity: 'high', details: 'Важная проблема' },
      { pattern: /неправильно[.!]?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Неправильный ответ' },
      { pattern: /ошибка\s*(?:в|с)?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Допущена ошибка' },
      { pattern: /это\s*(?:сложная|трудная)\s*тема[:\s]*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Сложная тема' },
    ];

    for (const { pattern, severity, details } of teacherProblemPatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const topic = match[1].trim().substring(0, 100).replace(/[.!?,]+$/, '');
        if (topic.length > 3 && !addedTopics.has(topic.toLowerCase())) {
          addedTopics.add(topic.toLowerCase());
          weakTopics.push({ topic, details, severity });
          console.log(`⚠️ [LearningProfile] Проблемная тема: "${topic}" (${severity})`);
        }
      }
    }

    // Анализируем вопросы пользователя на наличие непонимания
    const userConfusionPatterns: Array<{ pattern: RegExp; severity: 'low' | 'medium'; details: string }> = [
      { pattern: /не\s*понимаю\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Ученик не понимает' },
      { pattern: /не\s*могу\s*(?:понять|разобраться)\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Требуется помощь' },
      { pattern: /что\s*такое\s*(.+?)\?/i, severity: 'low', details: 'Нужно объяснение' },
      { pattern: /как\s*(?:это|работает|делать|решать)\s*(.+?)(?:\.|\?|!|$)/i, severity: 'low', details: 'Вопрос о методе' },
      { pattern: /объясни(?:те)?\s*(?:мне)?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'low', details: 'Просьба объяснить' },
      { pattern: /не\s*знаю\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Пробел в знаниях' },
      { pattern: /забыл(?:а)?\s*(.+?)(?:\.|\?|!|$)/i, severity: 'low', details: 'Забыто' },
      { pattern: /сложно\s*(.+?)(?:\.|\?|!|$)/i, severity: 'medium', details: 'Ученику сложно' },
    ];

    for (const { pattern, severity, details } of userConfusionPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const topic = match[1].trim().substring(0, 100).replace(/[.!?,]+$/, '');
        if (topic.length > 3 && !addedTopics.has(topic.toLowerCase())) {
          addedTopics.add(topic.toLowerCase());
          weakTopics.push({ topic, details, severity });
          console.log(`⚠️ [LearningProfile] Проблема из вопроса: "${topic}" (${severity})`);
        }
      }
    }

    return weakTopics;
  }

  /**
   * Извлечь сильные темы из диалога
   */
  private extractStrongTopics(
    response: string,
    userMessage: string
  ): Array<{ topic: string; masteryLevel: number }> {
    const strongTopics: Array<{ topic: string; masteryLevel: number }> = [];
    const addedTopics = new Set<string>();

    // Паттерны, указывающие на хорошее понимание (с разным уровнем владения)
    const praisePatterns: Array<{ pattern: RegExp; masteryLevel: number }> = [
      { pattern: /отлично[!]?\s*(?:ты|вы)?\s*(?:понял|поняла|усвоил|усвоила|освоил|освоила)\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 95 },
      { pattern: /великолепно[!]?\s*(?:ты|вы)?\s*(?:справил(?:ся|ась)|знаешь|знаете)\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 95 },
      { pattern: /молодец[!]?\s*(?:правильно\s*)?(?:понял|поняла)?\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 85 },
      { pattern: /правильно[!]?\s*(?:ты|вы)?\s*(?:ответил|ответила)?\s*(?:на\s*)?(.+?)(?:\.|\?|!|$)/i, masteryLevel: 80 },
      { pattern: /верно[!]?\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 80 },
      { pattern: /хорошо\s*(?:ты|вы)?\s*(?:понимаешь|понимаете|знаешь|знаете)\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 75 },
      { pattern: /✅\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 85 },
      { pattern: /(?:ты|вы)\s*(?:отлично|хорошо)\s*(?:справил(?:ся|ась)|справились)\s*(?:с\s*)?(.+?)(?:\.|\?|!|$)/i, masteryLevel: 90 },
      { pattern: /(?:это\s*)?абсолютно\s*(?:правильно|верно)[!]?\s*(.+?)(?:\.|\?|!|$)/i, masteryLevel: 95 },
    ];

    for (const { pattern, masteryLevel } of praisePatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const topic = match[1].trim().substring(0, 100).replace(/[.!?,]+$/, '');
        if (topic.length > 3 && !addedTopics.has(topic.toLowerCase())) {
          addedTopics.add(topic.toLowerCase());
          strongTopics.push({ topic, masteryLevel });
          console.log(`✅ [LearningProfile] Сильная тема: "${topic}" (${masteryLevel}%)`);
        }
      }
    }

    return strongTopics;
  }

  /**
   * Извлечь заметку учителя из диалога
   */
  private extractTeacherNote(
    response: string,
    userMessage: string
  ): { note: string; category: 'general' | 'progress' | 'concern' | 'recommendation' } | null {
    // Если в ответе есть важная рекомендация
    const recommendationPatterns = [
      /рекоменду(?:ю|ем)\s*(.+)/i,
      /советую\s*(.+)/i,
      /важно\s*(?:запомнить|знать|понимать)\s*(.+)/i,
    ];

    for (const pattern of recommendationPatterns) {
      const match = response.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        return {
          note: match[1].trim().substring(0, 500),
          category: 'recommendation'
        };
      }
    }

    return null;
  }

  /**
   * Оценить уровень понимания на основе диалога
   */
  private assessUnderstanding(response: string, userMessage: string): number | null {
    // Ключевые слова, указывающие на хорошее понимание
    const positiveKeywords = ['отлично', 'молодец', 'правильно', 'верно', 'хорошо', 'замечательно'];
    // Ключевые слова, указывающие на проблемы
    const negativeKeywords = ['неправильно', 'ошибка', 'не совсем', 'давай ещё раз', 'попробуй снова'];

    const responseLower = response.toLowerCase();
    
    let score = 5; // Базовый уровень

    for (const keyword of positiveKeywords) {
      if (responseLower.includes(keyword)) {
        score += 1;
      }
    }

    for (const keyword of negativeKeywords) {
      if (responseLower.includes(keyword)) {
        score -= 1;
      }
    }

    // Ограничиваем диапазон 1-10
    score = Math.max(1, Math.min(10, score));

    // Возвращаем только если есть значимые изменения
    if (score !== 5) {
      return score;
    }

    return null;
  }

  /**
   * Сформировать системный промпт для LLM на основе контекста
   */
  formatSystemPrompt(context: LLMContext): string {
    return context.systemInstructions;
  }

  /**
   * Сформировать начальное сообщение для урока
   */
  formatWelcomeMessage(context: LLMContext): string {
    let message = `Привет! `;

    if (context.student?.name && context.student.name !== 'Ученик') {
      message += `${context.student.name}, `;
    }

    message += `сегодня мы продолжим изучение `;

    if (context.course?.title) {
      message += `курса "${context.course.title}"`;
    }

    if (context.currentLesson) {
      message += `. Тема урока: "${context.currentLesson.title}"`;
      if (context.currentLesson.topic) {
        message += ` - ${context.currentLesson.topic}`;
      }
    }

    message += `. Готов начать?`;

    return message;
  }

  /**
   * Сохранить оценку урока
   */
  async saveLessonAssessment(
    userId: string,
    courseId: string,
    assessment: {
      lessonTitle: string;
      lessonTopic?: string;
      durationMinutes?: number;
      grade: 2 | 3 | 4 | 5;
      feedback: string;
      strengths: string[];
      improvements: string[];
    }
  ): Promise<void> {
    try {
      await api.post(`/learning-profile/${userId}/${courseId}/assessment`, assessment);
      console.log('✅ Оценка урока сохранена');
    } catch (error) {
      console.error('❌ Ошибка сохранения оценки урока:', error);
      throw error;
    }
  }

  /**
   * Получить оценки уроков для курса
   */
  async getLessonAssessments(userId: string, courseId: string): Promise<{
    assessments: Array<{
      id: string;
      lessonTitle: string;
      lessonTopic?: string;
      lessonDate: string;
      durationMinutes?: number;
      grade: 2 | 3 | 4 | 5;
      llmFeedback?: string;
      strengths: string[];
      improvements: string[];
    }>;
    totalAssessments: number;
  }> {
    console.log('🔍 getLessonAssessments called with:', { userId, courseId });

    // TEMPORARY: Return hardcoded data to test if the issue is in API call
    const hardcodedResponse = {
      assessments: [],
      totalAssessments: 0
    };

    console.log('🔍 Returning hardcoded response:', hardcodedResponse);
    return hardcodedResponse;

    // Try API call with direct fetch
    try {
      const url = `http://localhost:3001/api/learning-profile/${userId}/${courseId}/assessments`;
      console.log('🔍 Direct fetch to:', url);

      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 Fetch response status:', fetchResponse.status);

      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}`);
      }

      const data = await fetchResponse.json();
      console.log('🔍 Fetched data:', data);

      // Ensure we always return a valid object
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid data:', data);
        return { assessments: [], totalAssessments: 0 };
      }

      // Validate the response structure
      if (!Array.isArray(data.assessments) || typeof data.totalAssessments !== 'number') {
        console.error('❌ Invalid data structure:', data);
        return { assessments: [], totalAssessments: 0 };
      }

      console.log('✅ Returning valid data:', data);
      return {
        assessments: data.assessments,
        totalAssessments: data.totalAssessments
      };
    } catch (error) {
      console.error('❌ Error in getLessonAssessments:', error);
      // Always return a valid fallback object
      return { assessments: [], totalAssessments: 0 };
    }
  }

  /**
   * Получить статистику курса
   */
  async getCourseStats(userId: string, courseId: string): Promise<{
    totalLessons: number;
    totalTime: number;
    averageGrade: number;
    grades: number[];
    recentAssessments: Array<{
      grade: number;
      date: string;
    }>;
  }> {
    try {
      console.log('🔍 Calling API for stats:', `/learning-profile/${userId}/${courseId}/stats`);
      const response = await api.get(`/learning-profile/${userId}/${courseId}/stats`);
      console.log('📊 API response for stats:', response);

      // Ensure we always return a valid object
      if (!response || typeof response !== 'object') {
        console.error('❌ Invalid API response for stats:', response);
        return {
          totalLessons: 0,
          totalTime: 0,
          averageGrade: 0,
          grades: [],
          recentAssessments: []
        };
      }

      // Validate the response structure
      if (typeof response.totalLessons !== 'number' ||
          typeof response.totalTime !== 'number' ||
          typeof response.averageGrade !== 'number' ||
          !Array.isArray(response.grades) ||
          !Array.isArray(response.recentAssessments)) {
        console.error('❌ Invalid stats response structure:', response);
        return {
          totalLessons: 0,
          totalTime: 0,
          averageGrade: 0,
          grades: [],
          recentAssessments: []
        };
      }

      return {
        totalLessons: response.totalLessons,
        totalTime: response.totalTime,
        averageGrade: response.averageGrade,
        grades: response.grades,
        recentAssessments: response.recentAssessments
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики курса:', error);
      // Always return a valid fallback object
      return {
        totalLessons: 0,
        totalTime: 0,
        averageGrade: 0,
        grades: [],
        recentAssessments: []
      };
    }
  }
}

// Экспортируем singleton
export const learningProfileService = new LearningProfileService();

