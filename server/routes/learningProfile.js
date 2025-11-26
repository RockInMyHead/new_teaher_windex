/**
 * Learning Profile Routes
 * API для управления профилем обучения пользователя
 * 
 * Профиль содержит:
 * - Сильные и слабые стороны ученика
 * - История домашних заданий
 * - Стиль и скорость обучения
 * - Заметки учителя (LLM)
 * - Рекомендации для следующего урока
 * 
 * ВАЖНО: Курсы НЕ хранятся в БД - используется конфиг курсов
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { parseCourseId, getCourseById, getFullCourseTitle } = require('../config/courses');

/**
 * @route   GET /api/learning-profile/:userId/:courseId
 * @desc    Получить профиль обучения пользователя по курсу
 * @access  Private
 */
router.get('/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Получаем профиль
    const profileResult = await db.query(
      'SELECT * FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (profileResult.rows.length === 0) {
      // Создаем новый профиль если не существует
      await db.query(
        `INSERT INTO user_learning_profiles (user_id, course_id, last_activity_at)
         VALUES (?, ?, datetime('now'))`,
        [userId, courseId]
      );

      // Получаем созданный профиль
      const newProfileResult = await db.query(
        'SELECT * FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
      );

      return res.json({ profile: parseProfile(newProfileResult.rows[0]) });
    }

    res.json({ profile: parseProfile(profileResult.rows[0]) });
  } catch (error) {
    console.error('Error fetching learning profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-profile/:userId/:courseId
 * @desc    Создать или обновить профиль обучения
 * @access  Private
 */
router.post('/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const updates = req.body;

    // Проверяем существование профиля
    const existingProfile = await db.query(
      'SELECT id FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existingProfile.rows.length === 0) {
      // Создаем новый профиль
      await db.query(
        `INSERT INTO user_learning_profiles (
          user_id, course_id, 
          strong_topics, weak_topics, homework_history,
          current_homework, current_homework_status,
          learning_style, learning_pace, current_topic_understanding,
          teacher_notes, next_lesson_recommendations,
          subject_mastery_percentage, topics_completed,
          last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          userId, courseId,
          JSON.stringify(updates.strongTopics || []),
          JSON.stringify(updates.weakTopics || []),
          JSON.stringify(updates.homeworkHistory || []),
          updates.currentHomework || null,
          updates.currentHomeworkStatus || 'pending',
          updates.learningStyle || null,
          updates.learningPace || 'normal',
          updates.currentTopicUnderstanding || 5,
          JSON.stringify(updates.teacherNotes || []),
          updates.nextLessonRecommendations || null,
          updates.subjectMasteryPercentage || 0,
          updates.topicsCompleted || 0
        ]
      );
    } else {
      // Обновляем существующий профиль
      const setClauses = [];
      const values = [];

      if (updates.strongTopics !== undefined) {
        setClauses.push('strong_topics = ?');
        values.push(JSON.stringify(updates.strongTopics));
      }
      if (updates.weakTopics !== undefined) {
        setClauses.push('weak_topics = ?');
        values.push(JSON.stringify(updates.weakTopics));
      }
      if (updates.homeworkHistory !== undefined) {
        setClauses.push('homework_history = ?');
        values.push(JSON.stringify(updates.homeworkHistory));
      }
      if (updates.currentHomework !== undefined) {
        setClauses.push('current_homework = ?');
        values.push(updates.currentHomework);
      }
      if (updates.currentHomeworkStatus !== undefined) {
        setClauses.push('current_homework_status = ?');
        values.push(updates.currentHomeworkStatus);
      }
      if (updates.currentHomeworkAssignedAt !== undefined) {
        setClauses.push('current_homework_assigned_at = ?');
        values.push(updates.currentHomeworkAssignedAt);
      }
      if (updates.learningStyle !== undefined) {
        setClauses.push('learning_style = ?');
        values.push(updates.learningStyle);
      }
      if (updates.learningPace !== undefined) {
        setClauses.push('learning_pace = ?');
        values.push(updates.learningPace);
      }
      if (updates.currentTopicUnderstanding !== undefined) {
        setClauses.push('current_topic_understanding = ?');
        values.push(updates.currentTopicUnderstanding);
      }
      if (updates.teacherNotes !== undefined) {
        setClauses.push('teacher_notes = ?');
        values.push(JSON.stringify(updates.teacherNotes));
      }
      if (updates.nextLessonRecommendations !== undefined) {
        setClauses.push('next_lesson_recommendations = ?');
        values.push(updates.nextLessonRecommendations);
      }
      if (updates.subjectMasteryPercentage !== undefined) {
        setClauses.push('subject_mastery_percentage = ?');
        values.push(updates.subjectMasteryPercentage);
      }
      if (updates.topicsCompleted !== undefined) {
        setClauses.push('topics_completed = ?');
        values.push(updates.topicsCompleted);
      }

      // Всегда обновляем last_activity_at
      setClauses.push("last_activity_at = datetime('now')");

      if (setClauses.length > 0) {
        values.push(userId, courseId);
        await db.query(
          `UPDATE user_learning_profiles SET ${setClauses.join(', ')} 
           WHERE user_id = ? AND course_id = ?`,
          values
        );
      }
    }

    // Возвращаем обновленный профиль
    const updatedProfile = await db.query(
      'SELECT * FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({ profile: parseProfile(updatedProfile.rows[0]) });
  } catch (error) {
    console.error('Error updating learning profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-profile/:userId/:courseId/add-weak-topic
 * @desc    Добавить проблемную тему
 * @access  Private
 */
router.post('/:userId/:courseId/add-weak-topic', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const { topic, details, severity } = req.body;

    // Получаем текущий профиль
    const profileResult = await db.query(
      'SELECT weak_topics FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    let weakTopics = [];
    if (profileResult.rows.length > 0 && profileResult.rows[0].weak_topics) {
      weakTopics = JSON.parse(profileResult.rows[0].weak_topics);
    }

    // Добавляем новую проблемную тему
    const newWeakTopic = {
      topic,
      details: details || '',
      severity: severity || 'medium', // low, medium, high
      addedAt: new Date().toISOString(),
      resolved: false
    };

    // Проверяем, нет ли уже такой темы
    const existingIndex = weakTopics.findIndex(t => t.topic === topic);
    if (existingIndex >= 0) {
      // Обновляем существующую
      weakTopics[existingIndex] = { ...weakTopics[existingIndex], ...newWeakTopic };
    } else {
      weakTopics.push(newWeakTopic);
    }

    // Сохраняем
    if (profileResult.rows.length === 0) {
      await db.query(
        `INSERT INTO user_learning_profiles (user_id, course_id, weak_topics, last_activity_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, courseId, JSON.stringify(weakTopics)]
      );
    } else {
      await db.query(
        `UPDATE user_learning_profiles SET weak_topics = ?, last_activity_at = datetime('now')
         WHERE user_id = ? AND course_id = ?`,
        [JSON.stringify(weakTopics), userId, courseId]
      );
    }

    res.json({ success: true, weakTopics });
  } catch (error) {
    console.error('Error adding weak topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-profile/:userId/:courseId/add-strong-topic
 * @desc    Добавить сильную тему
 * @access  Private
 */
router.post('/:userId/:courseId/add-strong-topic', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const { topic, masteryLevel } = req.body;

    // Получаем текущий профиль
    const profileResult = await db.query(
      'SELECT strong_topics FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    let strongTopics = [];
    if (profileResult.rows.length > 0 && profileResult.rows[0].strong_topics) {
      strongTopics = JSON.parse(profileResult.rows[0].strong_topics);
    }

    // Добавляем сильную тему
    const newStrongTopic = {
      topic,
      masteryLevel: masteryLevel || 80, // 0-100
      addedAt: new Date().toISOString()
    };

    const existingIndex = strongTopics.findIndex(t => t.topic === topic);
    if (existingIndex >= 0) {
      strongTopics[existingIndex] = { ...strongTopics[existingIndex], ...newStrongTopic };
    } else {
      strongTopics.push(newStrongTopic);
    }

    // Сохраняем
    if (profileResult.rows.length === 0) {
      await db.query(
        `INSERT INTO user_learning_profiles (user_id, course_id, strong_topics, last_activity_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, courseId, JSON.stringify(strongTopics)]
      );
    } else {
      await db.query(
        `UPDATE user_learning_profiles SET strong_topics = ?, last_activity_at = datetime('now')
         WHERE user_id = ? AND course_id = ?`,
        [JSON.stringify(strongTopics), userId, courseId]
      );
    }

    res.json({ success: true, strongTopics });
  } catch (error) {
    console.error('Error adding strong topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-profile/:userId/:courseId/assign-homework
 * @desc    Назначить домашнее задание
 * @access  Private
 */
router.post('/:userId/:courseId/assign-homework', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const { homework, dueAt } = req.body;

    // Получаем текущий профиль
    const profileResult = await db.query(
      'SELECT homework_history FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    let homeworkHistory = [];
    if (profileResult.rows.length > 0 && profileResult.rows[0].homework_history) {
      homeworkHistory = JSON.parse(profileResult.rows[0].homework_history);
    }

    // Добавляем ДЗ в историю
    const homeworkEntry = {
      id: Date.now().toString(),
      task: homework,
      assignedAt: new Date().toISOString(),
      dueAt: dueAt || null,
      status: 'pending',
      submittedAt: null,
      feedback: null
    };

    homeworkHistory.push(homeworkEntry);

    // Сохраняем
    if (profileResult.rows.length === 0) {
      await db.query(
        `INSERT INTO user_learning_profiles (
          user_id, course_id, 
          current_homework, current_homework_assigned_at, current_homework_due_at, current_homework_status,
          homework_history, last_activity_at
        ) VALUES (?, ?, ?, datetime('now'), ?, 'pending', ?, datetime('now'))`,
        [userId, courseId, homework, dueAt || null, JSON.stringify(homeworkHistory)]
      );
    } else {
      await db.query(
        `UPDATE user_learning_profiles SET 
         current_homework = ?, 
         current_homework_assigned_at = datetime('now'),
         current_homework_due_at = ?,
         current_homework_status = 'pending',
         homework_history = ?,
         last_activity_at = datetime('now')
         WHERE user_id = ? AND course_id = ?`,
        [homework, dueAt || null, JSON.stringify(homeworkHistory), userId, courseId]
      );
    }

    res.json({ success: true, homework: homeworkEntry });
  } catch (error) {
    console.error('Error assigning homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-profile/:userId/:courseId/add-teacher-note
 * @desc    Добавить заметку учителя (LLM)
 * @access  Private
 */
router.post('/:userId/:courseId/add-teacher-note', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const { note, category } = req.body;

    // Получаем текущий профиль
    const profileResult = await db.query(
      'SELECT teacher_notes FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    let teacherNotes = [];
    if (profileResult.rows.length > 0 && profileResult.rows[0].teacher_notes) {
      teacherNotes = JSON.parse(profileResult.rows[0].teacher_notes);
    }

    // Добавляем заметку
    const newNote = {
      id: Date.now().toString(),
      note,
      category: category || 'general', // general, progress, concern, recommendation
      createdAt: new Date().toISOString()
    };

    teacherNotes.push(newNote);

    // Ограничиваем количество заметок (последние 50)
    if (teacherNotes.length > 50) {
      teacherNotes = teacherNotes.slice(-50);
    }

    // Сохраняем
    if (profileResult.rows.length === 0) {
      await db.query(
        `INSERT INTO user_learning_profiles (user_id, course_id, teacher_notes, last_activity_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, courseId, JSON.stringify(teacherNotes)]
      );
    } else {
      await db.query(
        `UPDATE user_learning_profiles SET teacher_notes = ?, last_activity_at = datetime('now')
         WHERE user_id = ? AND course_id = ?`,
        [JSON.stringify(teacherNotes), userId, courseId]
      );
    }

    res.json({ success: true, note: newNote });
  } catch (error) {
    console.error('Error adding teacher note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-profile/:userId/:courseId/llm-context
 * @desc    Получить контекст для LLM (полная информация о ученике)
 * @access  Private
 * 
 * ВАЖНО: Курсы берутся из конфига, НЕ из БД
 */
router.get('/:userId/:courseId/llm-context', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Парсим courseId для получения предмета и уровня
    const { subject, level } = parseCourseId(courseId);
    const courseConfig = getCourseById(courseId);
    const courseTitle = getFullCourseTitle(courseId, level);

    // Получаем профиль обучения из БД
    let profile = null;
    const profileResult = await db.query(
      'SELECT * FROM user_learning_profiles WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (profileResult.rows.length > 0) {
      profile = parseProfile(profileResult.rows[0]);
    }

    // Получаем информацию о пользователе
    let user = null;
    const userResult = await db.query(
      'SELECT id, username, full_name, level FROM users WHERE id = ?',
      [userId]
    );
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    }

    // Формируем информацию о курсе из конфига (НЕ из БД!)
    const course = {
      id: courseId,
      title: courseTitle,
      subject: courseConfig?.subject || subject,
      grade: level,
      description: courseConfig?.description || `Курс ${subject} для ${level} класса`
    };

    // Формируем контекст для LLM
    const llmContext = {
      // Информация о ученике
      student: {
        id: user?.id || userId,
        name: user?.full_name || user?.username || 'Ученик',
        level: user?.level || 1
      },

      // Информация о курсе (из конфига)
      course: course,

      // Текущий урок (не используем статичные уроки из БД)
      currentLesson: null,

      // Профиль обучения
      learningProfile: profile ? {
        // Сильные стороны
        strongTopics: profile.strongTopics || [],
        
        // Проблемные темы
        weakTopics: profile.weakTopics || [],
        
        // Текущее ДЗ
        currentHomework: profile.currentHomework,
        currentHomeworkStatus: profile.currentHomeworkStatus,
        
        // Стиль обучения
        learningStyle: profile.learningStyle,
        learningPace: profile.learningPace,
        
        // Уровень понимания
        currentTopicUnderstanding: profile.currentTopicUnderstanding,
        subjectMasteryPercentage: profile.subjectMasteryPercentage,
        
        // Последние заметки учителя (последние 5)
        recentTeacherNotes: (profile.teacherNotes || []).slice(-5),
        
        // Рекомендации
        nextLessonRecommendations: profile.nextLessonRecommendations,
        
        // Статистика
        topicsCompleted: profile.topicsCompleted
      } : null,

      // Системные инструкции для LLM
      systemInstructions: generateSystemInstructions(course, profile, null)
    };

    console.log(`📚 [LLM Context] Course: "${courseTitle}", User: ${userId}`);
    res.json(llmContext);
  } catch (error) {
    console.error('Error generating LLM context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Парсинг профиля из БД
 */
function parseProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    strongTopics: safeJsonParse(row.strong_topics, []),
    weakTopics: safeJsonParse(row.weak_topics, []),
    homeworkHistory: safeJsonParse(row.homework_history, []),
    currentHomework: row.current_homework,
    currentHomeworkAssignedAt: row.current_homework_assigned_at,
    currentHomeworkDueAt: row.current_homework_due_at,
    currentHomeworkStatus: row.current_homework_status,
    learningStyle: row.learning_style,
    learningPace: row.learning_pace,
    currentTopicUnderstanding: row.current_topic_understanding,
    teacherNotes: safeJsonParse(row.teacher_notes, []),
    nextLessonRecommendations: row.next_lesson_recommendations,
    subjectMasteryPercentage: row.subject_mastery_percentage,
    topicsCompleted: row.topics_completed,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Безопасный парсинг JSON
 */
function safeJsonParse(str, defaultValue) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Генерация системных инструкций для LLM на основе профиля ученика
 */
function generateSystemInstructions(course, profile, currentLesson) {
  let instructions = `Ты - профессиональный преподаватель`;

  if (course) {
    instructions += ` ${course.subject || course.title}`;
    if (course.grade) {
      instructions += ` для ${course.grade} класса`;
    }
  }

  instructions += `. Ведёшь индивидуальный урок с учеником.\n\n`;

  if (currentLesson) {
    instructions += `ТЕКУЩИЙ УРОК:\n`;
    instructions += `- Тема: ${currentLesson.title}\n`;
    instructions += `- Раздел: ${currentLesson.topic}\n`;
    if (currentLesson.description) {
      instructions += `- Описание: ${currentLesson.description}\n`;
    }
    instructions += `\n`;
  }

  if (profile) {
    // Информация о стиле обучения
    if (profile.learningStyle || profile.learningPace) {
      instructions += `ОСОБЕННОСТИ УЧЕНИКА:\n`;
      if (profile.learningStyle) {
        const styleDescriptions = {
          visual: 'визуал - лучше воспринимает информацию через картинки и схемы',
          auditory: 'аудиал - лучше воспринимает информацию на слух',
          kinesthetic: 'кинестетик - лучше учится через практику и действия',
          reading: 'читатель - лучше воспринимает текстовую информацию'
        };
        instructions += `- Стиль обучения: ${styleDescriptions[profile.learningStyle] || profile.learningStyle}\n`;
      }
      if (profile.learningPace) {
        const paceDescriptions = {
          slow: 'предпочитает медленный темп с подробными объяснениями',
          normal: 'нормальный темп обучения',
          fast: 'быстро усваивает материал, можно давать больше информации'
        };
        instructions += `- Темп: ${paceDescriptions[profile.learningPace] || profile.learningPace}\n`;
      }
      instructions += `\n`;
    }

    // Сильные стороны
    if (profile.strongTopics && profile.strongTopics.length > 0) {
      instructions += `СИЛЬНЫЕ СТОРОНЫ УЧЕНИКА:\n`;
      profile.strongTopics.forEach(t => {
        instructions += `- ${t.topic} (уровень владения: ${t.masteryLevel}%)\n`;
      });
      instructions += `\n`;
    }

    // Проблемные темы
    if (profile.weakTopics && profile.weakTopics.length > 0) {
      const unresolvedWeakTopics = profile.weakTopics.filter(t => !t.resolved);
      if (unresolvedWeakTopics.length > 0) {
        instructions += `ПРОБЛЕМНЫЕ ТЕМЫ (требуют особого внимания):\n`;
        unresolvedWeakTopics.forEach(t => {
          instructions += `- ${t.topic}`;
          if (t.details) instructions += `: ${t.details}`;
          instructions += ` [${t.severity || 'medium'}]\n`;
        });
        instructions += `\n`;
      }
    }

    // Текущее ДЗ
    if (profile.currentHomework && profile.currentHomeworkStatus === 'pending') {
      instructions += `ТЕКУЩЕЕ ДОМАШНЕЕ ЗАДАНИЕ:\n`;
      instructions += `${profile.currentHomework}\n`;
      instructions += `Статус: ожидает выполнения\n\n`;
    }

    // Рекомендации
    if (profile.nextLessonRecommendations) {
      instructions += `РЕКОМЕНДАЦИИ ДЛЯ ЭТОГО УРОКА:\n`;
      instructions += `${profile.nextLessonRecommendations}\n\n`;
    }
  }

  instructions += `ВАЖНЫЕ ПРАВИЛА:\n`;
  instructions += `1. Веди урок на русском языке\n`;
  instructions += `2. Адаптируй сложность под уровень ученика\n`;
  instructions += `3. Если ученик делает ошибки в проблемных темах - объясняй подробнее\n`;
  instructions += `4. Хвали за успехи в сильных темах\n`;
  instructions += `5. В конце урока можешь задать домашнее задание\n`;
  instructions += `6. Отвечай кратко и по делу, но дружелюбно\n`;

  return instructions;
}

/**
 * @route   POST /api/learning-profile/:userId/:courseId/assessment
 * @desc    Save lesson assessment from LLM
 * @access  Private
 */
router.post('/:userId/:courseId/assessment', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const {
      lessonTitle,
      lessonTopic,
      durationMinutes,
      grade,
      feedback,
      strengths,
      improvements
    } = req.body;

    // Validate required fields
    if (!lessonTitle || !grade || grade < 2 || grade > 5) {
      return res.status(400).json({ error: 'Missing required fields or invalid grade' });
    }

    // Insert assessment
    const result = await db.query(
      `INSERT INTO lesson_assessments
       (user_id, course_id, lesson_title, lesson_topic, duration_minutes, grade, llm_feedback, strengths, improvements)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        courseId,
        lessonTitle,
        lessonTopic || null,
        durationMinutes || null,
        grade,
        feedback || null,
        JSON.stringify(strengths || []),
        JSON.stringify(improvements || [])
      ]
    );

    res.json({
      success: true,
      assessmentId: result.lastID
    });
  } catch (error) {
    console.error('Error saving lesson assessment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-profile/:userId/:courseId/assessments
 * @desc    Get lesson assessments for a course
 * @access  Private
 */
router.get('/:userId/:courseId/assessments', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const assessments = await db.query(
      `SELECT
        id,
        lesson_title as lessonTitle,
        lesson_topic as lessonTopic,
        lesson_date as lessonDate,
        duration_minutes as durationMinutes,
        grade,
        llm_feedback as llmFeedback,
        strengths,
        improvements
       FROM lesson_assessments
       WHERE user_id = ? AND course_id = ?
       ORDER BY lesson_date DESC`,
      [userId, courseId]
    );

    // Parse JSON fields
    const parsedAssessments = assessments.rows.map(row => ({
      id: row.id,
      lessonTitle: row.lessonTitle,
      lessonTopic: row.lessonTopic,
      lessonDate: row.lessonDate,
      durationMinutes: row.durationMinutes,
      grade: row.grade,
      llmFeedback: row.llmFeedback,
      strengths: safeJsonParse(row.strengths, []),
      improvements: safeJsonParse(row.improvements, [])
    }));

    res.json({
      assessments: parsedAssessments,
      totalAssessments: parsedAssessments.length
    });
  } catch (error) {
    console.error('Error getting lesson assessments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-profile/:userId/:courseId/stats
 * @desc    Get course statistics and assessments summary
 * @access  Private
 */
router.get('/:userId/:courseId/stats', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Get all assessments for the course
    const assessments = await db.query(
      `SELECT grade, duration_minutes, lesson_date
       FROM lesson_assessments
       WHERE user_id = ? AND course_id = ?
       ORDER BY lesson_date DESC`,
      [userId, courseId]
    );

    if (assessments.rows.length === 0) {
      return res.json({
        totalLessons: 0,
        totalTime: 0,
        averageGrade: 0,
        grades: [],
        recentAssessments: []
      });
    }

    // Calculate statistics
    const grades = assessments.rows.map(row => row.grade);
    const totalTime = assessments.rows.reduce((sum, row) => sum + (row.duration_minutes || 0), 0);
    const averageGrade = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;

    // Get recent assessments (last 5)
    const recentAssessments = assessments.rows.slice(0, 5).map(row => ({
      grade: row.grade,
      date: row.lesson_date
    }));

    res.json({
      totalLessons: assessments.rows.length,
      totalTime: totalTime,
      averageGrade: Math.round(averageGrade * 10) / 10, // Round to 1 decimal
      grades: grades,
      recentAssessments: recentAssessments
    });
  } catch (error) {
    console.error('Error getting course stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

