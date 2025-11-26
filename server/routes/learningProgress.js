/**
 * Learning Progress API Routes
 * Управление прогрессом обучения, темами и домашними заданиями
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * @route   POST /api/learning-progress/enroll
 * @desc    Записать пользователя на курс
 * @access  Private
 */
router.post('/enroll', async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({ error: 'Missing userId or courseId' });
    }

    // Проверяем, не записан ли уже пользователь
    const existing = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existing.rows.length > 0) {
      return res.json({ userCourse: existing.rows[0] });
    }

    // Записываем пользователя на курс
    const result = await db.query(
      `INSERT INTO user_courses (user_id, course_id, current_lesson_number, completed_lessons, progress_percentage, total_study_time_minutes, average_score, status)
       VALUES (?, ?, 1, 0, 0, 0, 0, 'active')`,
      [userId, courseId]
    );

    const userCourse = await db.query(
      'SELECT * FROM user_courses WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({ userCourse: userCourse[0] });
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-progress/users/courses/enroll
 * @desc    Записать пользователя на курс
 * @access  Private
 */
router.post('/users/courses/enroll', async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({ error: 'Missing required fields: userId, courseId' });
    }

    // Проверяем, существует ли курс
    const courseResult = await db.query(
      'SELECT * FROM courses WHERE id = ?',
      [courseId]
    );

    if (!courseResult.rows || courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Проверяем, не записан ли уже пользователь на курс
    const existingUserCourse = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existingUserCourse.rows.length > 0) {
      // Возвращаем существующую запись
      return res.json({
        userCourse: {
          id: existingUserCourse.rows[0].id,
          userId: existingUserCourse.rows[0].user_id,
          courseId: existingUserCourse.rows[0].course_id,
          progress: existingUserCourse.rows[0].progress_percentage,
          enrolledAt: existingUserCourse.rows[0].enrolled_at,
          lastAccessedAt: existingUserCourse.rows[0].last_accessed_at,
          status: existingUserCourse.rows[0].status
        }
      });
    }

    // Создаем новую запись
    await db.query(
      `INSERT INTO user_courses (user_id, course_id, progress_percentage)
       VALUES (?, ?, 0)`,
      [userId, courseId]
    );

    // Получаем созданную запись по user_id и course_id
    const newUserCourseResult = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (newUserCourseResult.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create user course record' });
    }

    const newUserCourse = newUserCourseResult.rows[0];

    res.json({
      userCourse: {
        id: newUserCourse.id,
        userId: newUserCourse.user_id,
        courseId: newUserCourse.course_id,
        progress: newUserCourse.progress_percentage,
        enrolledAt: newUserCourse.enrolled_at,
        lastAccessedAt: newUserCourse.last_accessed_at,
        status: newUserCourse.status
      }
    });

  } catch (error) {
    console.error('Error enrolling user in course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-progress/users/:userId/courses/:courseId
 * @desc    Получить прогресс пользователя по курсу
 * @access  Private
 */
router.get('/users/:userId/courses/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Получаем прогресс по курсу
    const userCourseResult = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (userCourseResult.rows.length === 0) {
      return res.status(404).json({ error: 'User course not found' });
    }

    const userCourse = userCourseResult.rows[0];

    // Получаем прогресс по урокам
    const lessons = await db.query(
      `SELECT ul.*, l.title, l.topic, l.lesson_number
       FROM user_lessons ul
       JOIN lessons l ON ul.lesson_id = l.id
       WHERE ul.user_id = ? AND ul.user_course_id = ?
       ORDER BY l.lesson_number ASC`,
      [userId, userCourse.id]
    );

    res.json({ userCourse, lessons: lessons.rows });
  } catch (error) {
    console.error('Error fetching user course progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-progress/lessons/start
 * @desc    Начать урок
 * @access  Private
 */
router.post('/lessons/start', async (req, res) => {
  try {
    const { userId, courseId, lessonNumber, userCourseId } = req.body;

    if (!userId || !courseId || !lessonNumber || !userCourseId) {
      return res.status(400).json({ error: 'Missing required fields: userId, courseId, lessonNumber, userCourseId' });
    }

    // Получаем реальный ID урока из базы данных
    const lessonResult = await db.query(
      'SELECT * FROM lessons WHERE course_id = ? AND lesson_number = ?',
      [courseId, lessonNumber]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lesson = lessonResult.rows[0];

    // Проверяем, не начат ли уже урок
    const existing = await db.query(
      'SELECT * FROM user_lessons WHERE user_id = ? AND lesson_id = ?',
      [userId, lesson.id]
    );

    if (existing.rows.length > 0) {
      // Обновляем статус, если урок уже существует
      await db.query(
        `UPDATE user_lessons
         SET status = 'in_progress', started_at = datetime('now'), attempts_count = attempts_count + 1, updated_at = datetime('now')
         WHERE id = ?`,
        [existing.rows[0].id]
      );

      const updated = await db.query('SELECT * FROM user_lessons WHERE id = ?', [existing.rows[0].id]);
      return res.json({ lessonProgress: updated.rows[0] });
    }

    // Создаем новую запись прогресса урока
    const result = await db.query(
      `INSERT INTO user_lessons (user_id, lesson_id, user_course_id, status, started_at, attempts_count)
       VALUES (?, ?, ?, 'in_progress', datetime('now'), 1)`,
      [userId, lesson.id, userCourseId]
    );

    const lessonProgress = await db.query(
      'SELECT * FROM user_lessons WHERE id = ?',
      [result.lastID]
    );

    if (lessonProgress.rows.length === 0) {
      // Fallback: попробуем найти по параметрам
      const fallback = await db.query(
        'SELECT * FROM user_lessons WHERE user_id = ? AND lesson_id = ? AND user_course_id = ?',
        [userId, lesson.id, userCourseId]
      );
      
      if (fallback.rows.length > 0) {
        // Обновляем время последнего доступа к курсу
        await db.query(
          `UPDATE user_courses SET last_accessed_at = datetime('now') WHERE id = ?`,
          [userCourseId]
        );
        return res.status(201).json({ lessonProgress: fallback.rows[0] });
      }

      return res.status(500).json({ error: 'Failed to create lesson progress record' });
    }

    // Обновляем время последнего доступа к курсу
    await db.query(
      `UPDATE user_courses SET last_accessed_at = datetime('now') WHERE id = ?`,
      [userCourseId]
    );

    res.status(201).json({ lessonProgress: lessonProgress.rows[0] });
  } catch (error) {
    console.error('Error starting lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-progress/lessons/complete
 * @desc    Завершить урок
 * @access  Private
 */
router.post('/lessons/complete', async (req, res) => {
  try {
    const { userId, lessonId, score, timeSpentMinutes } = req.body;

    if (!userId || !lessonId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Получаем запись урока
    const lessonResult = await db.query(
      'SELECT * FROM user_lessons WHERE user_id = ? AND lesson_id = ?',
      [userId, lessonId]
    );

    if (lessonResult.length === 0) {
      return res.status(404).json({ error: 'Lesson progress not found' });
    }

    const lessonProgress = lessonResult[0];

    // Обновляем статус урока
    await db.query(
      `UPDATE user_lessons 
       SET status = 'completed', 
           completed_at = datetime('now'), 
           score = ?,
           time_spent_minutes = time_spent_minutes + ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [score || null, timeSpentMinutes || 0, lessonProgress.id]
    );

    // Обновляем прогресс курса
    const userCourse = await db.query(
      'SELECT * FROM user_courses WHERE id = ?',
      [lessonProgress.user_course_id]
    );

    if (userCourse.length > 0) {
      const courseId = userCourse[0].course_id;

      // Получаем общее количество уроков в курсе
      const totalLessons = await db.query(
        'SELECT COUNT(*) as count FROM lessons WHERE course_id = ?',
        [courseId]
      );

      // Получаем количество завершенных уроков
      const completedLessons = await db.query(
        `SELECT COUNT(*) as count FROM user_lessons 
         WHERE user_course_id = ? AND status = 'completed'`,
        [userCourse[0].id]
      );

      const total = totalLessons[0].count;
      const completed = completedLessons[0].count;
      const progress = total > 0 ? (completed / total) * 100 : 0;

      // Вычисляем средний балл
      const avgScoreResult = await db.query(
        `SELECT AVG(score) as avg_score FROM user_lessons 
         WHERE user_course_id = ? AND score IS NOT NULL`,
        [userCourse[0].id]
      );

      const avgScore = avgScoreResult[0].avg_score || 0;

      // Обновляем прогресс курса
      await db.query(
        `UPDATE user_courses 
         SET completed_lessons = ?,
             progress_percentage = ?,
             average_score = ?,
             total_study_time_minutes = total_study_time_minutes + ?,
             last_accessed_at = datetime('now'),
             current_lesson_number = current_lesson_number + 1
         WHERE id = ?`,
        [completed, progress, avgScore, timeSpentMinutes || 0, userCourse[0].id]
      );

      // Обновляем статистику пользователя
      await db.query(
        `UPDATE users 
         SET total_lessons_completed = total_lessons_completed + 1,
             total_study_hours = total_study_hours + ?
         WHERE id = ?`,
        [timeSpentMinutes / 60, userId]
      );
    }

    const updatedLesson = await db.query('SELECT * FROM user_lessons WHERE id = ?', [lessonProgress.id]);
    const updatedCourse = await db.query('SELECT * FROM user_courses WHERE id = ?', [lessonProgress.user_course_id]);

    res.json({ 
      lessonProgress: updatedLesson[0],
      userCourse: updatedCourse[0]
    });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-progress/homework/submit
 * @desc    Отправить домашнее задание
 * @access  Private
 */
router.post('/homework/submit', async (req, res) => {
  try {
    const { userId, lessonId, homeworkContent } = req.body;

    if (!userId || !lessonId || !homeworkContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Обновляем домашнее задание
    await db.query(
      `UPDATE user_lessons 
       SET homework_submitted = 1,
           homework_submitted_at = datetime('now'),
           homework_content = ?,
           updated_at = datetime('now')
       WHERE user_id = ? AND lesson_id = ?`,
      [JSON.stringify(homeworkContent), userId, lessonId]
    );

    const lessonProgress = await db.query(
      'SELECT * FROM user_lessons WHERE user_id = ? AND lesson_id = ?',
      [userId, lessonId]
    );

    res.json({ lessonProgress: lessonProgress.rows[0] });
  } catch (error) {
    console.error('Error submitting homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-progress/users/:userId/homeworks
 * @desc    Получить домашние задания пользователя
 * @access  Private
 */
router.get('/users/:userId/homeworks', async (req, res) => {
  try {
    const { userId } = req.params;
    const { courseId, status, limit = 50 } = req.query;

    let query = `
      SELECT ul.*, l.title, l.topic, l.lesson_number, l.homework, c.title as course_title
      FROM user_lessons ul
      JOIN lessons l ON ul.lesson_id = l.id
      JOIN user_courses uc ON ul.user_course_id = uc.id
      JOIN courses c ON uc.course_id = c.id
      WHERE ul.user_id = ?
    `;

    const params = [userId];
    let paramIndex = 1;

    if (courseId) {
      query += ` AND uc.course_id = ?`;
      params.push(courseId);
      paramIndex++;
    }

    if (status === 'pending') {
      query += ` AND ul.homework_submitted = 0 AND l.homework IS NOT NULL`;
    } else if (status === 'submitted') {
      query += ` AND ul.homework_submitted = 1`;
    }

    query += ` ORDER BY l.lesson_number DESC LIMIT ?`;
    params.push(limit);

    const homeworks = await db.query(query, params);

    res.json({ homeworks: homeworks.rows });
  } catch (error) {
    console.error('Error fetching homeworks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-progress/users/:userId/courses/:courseId/llm-context
 * @desc    Получить контекст курса для LLM
 * @access  Private
 */
router.get('/users/:userId/courses/:courseId/llm-context', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Получаем информацию о курсе
    const courseResult = await db.query(
      'SELECT * FROM courses WHERE id = ?',
      [courseId]
    );

    if (courseResult.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult[0];

    // Получаем прогресс пользователя
    const userCourseResult = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    const userCourse = userCourseResult.rows.length > 0 ? userCourseResult.rows[0] : null;

    // Получаем текущий урок
    let currentLesson = null;
    if (userCourse) {
      const lessonResult = await db.query(
        'SELECT * FROM lessons WHERE course_id = ? AND lesson_number = ?',
        [courseId, userCourse.current_lesson_number]
      );
      currentLesson = lessonResult.length > 0 ? lessonResult[0] : null;
    }

    // Получаем предыдущее домашнее задание
    let previousHomework = null;
    if (userCourse && userCourse.current_lesson_number > 1) {
      const prevLessonResult = await db.query(
        'SELECT * FROM lessons WHERE course_id = ? AND lesson_number = ?',
        [courseId, userCourse.current_lesson_number - 1]
      );

      if (prevLessonResult.length > 0) {
        const prevLesson = prevLessonResult[0];
        const homeworkResult = await db.query(
          'SELECT * FROM user_lessons WHERE user_id = ? AND lesson_id = ?',
          [userId, prevLesson.id]
        );

        if (homeworkResult.length > 0) {
          const hw = homeworkResult[0];
          previousHomework = {
            task: prevLesson.homework ? JSON.parse(prevLesson.homework).task : null,
            submitted: hw.homework_submitted === 1,
            feedback: hw.homework_feedback ? JSON.parse(hw.homework_feedback) : null
          };
        }
      }
    }

    // Получаем историю пройденных тем
    const completedLessons = await db.query(
      `SELECT l.title, l.topic, ul.completed_at
       FROM user_lessons ul
       JOIN lessons l ON ul.lesson_id = l.id
       WHERE ul.user_course_id = ? AND ul.status = 'completed'
       ORDER BY l.lesson_number ASC`,
      [userCourse?.id]
    );

    const topicsCovered = completedLessons.map(l => l.topic);

    // Получаем общее количество уроков
    const totalLessonsResult = await db.query(
      'SELECT COUNT(*) as count FROM lessons WHERE course_id = ?',
      [courseId]
    );

    const totalLessons = totalLessonsResult[0].count;

    // Формируем контекст для LLM
    const context = {
      courseTitle: course.title,
      courseDescription: course.description,
      grade: course.grade,
      subject: course.subject,
      currentLessonNumber: userCourse?.current_lesson_number || 1,
      completedLessons: userCourse?.completed_lessons || 0,
      totalLessons,
      progressPercentage: userCourse?.progress_percentage || 0,
      currentLessonTitle: currentLesson?.title,
      currentLessonTopic: currentLesson?.topic,
      currentLessonObjectives: currentLesson?.learning_objectives 
        ? JSON.parse(currentLesson.learning_objectives) 
        : [],
      previousHomework,
      studyHistory: {
        topicsCovered,
        lastStudyDate: userCourse?.last_accessed_at,
        totalStudyTime: userCourse?.total_study_time_minutes || 0
      }
    };

    res.json({ context });
  } catch (error) {
    console.error('Error fetching LLM context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-progress/users/:userId/courses/:courseId/next-lesson
 * @desc    Получить рекомендации для следующего урока
 * @access  Private
 */
router.get('/users/:userId/courses/:courseId/next-lesson', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Получаем прогресс пользователя
    const userCourseResult = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (userCourseResult.rows.length === 0) {
      return res.status(404).json({ error: 'User course not found' });
    }

    const userCourse = userCourseResult.rows[0];

    // Получаем следующий урок
    const nextLessonResult = await db.query(
      'SELECT * FROM lessons WHERE course_id = ? AND lesson_number = ?',
      [courseId, userCourse.current_lesson_number]
    );

    if (nextLessonResult.length === 0) {
      return res.status(404).json({ error: 'No more lessons available' });
    }

    const nextLesson = nextLessonResult[0];

    // Вычисляем готовность (на основе среднего балла и прогресса)
    const readinessScore = Math.min(
      100,
      (userCourse.average_score * 0.6 + userCourse.progress_percentage * 0.4)
    );

    // Генерируем рекомендации
    const recommendations = [];
    if (userCourse.average_score < 70) {
      recommendations.push('Рекомендуется повторить предыдущие темы');
    }
    if (readinessScore >= 80) {
      recommendations.push('Вы готовы к изучению новой темы!');
    }

    res.json({
      nextLesson: {
        id: nextLesson.id,
        title: nextLesson.title,
        topic: nextLesson.topic,
        description: nextLesson.description,
        lessonNumber: nextLesson.lesson_number
      },
      readinessScore,
      recommendations
    });
  } catch (error) {
    console.error('Error fetching next lesson:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning-progress/study-time/update
 * @desc    Обновить время обучения
 * @access  Private
 */
router.post('/study-time/update', async (req, res) => {
  try {
    const { userId, courseId, minutesSpent } = req.body;

    if (!userId || !courseId || !minutesSpent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await db.query(
      `UPDATE user_courses 
       SET total_study_time_minutes = total_study_time_minutes + ?,
           last_accessed_at = datetime('now')
       WHERE user_id = ? AND course_id = ?`,
      [minutesSpent, userId, courseId]
    );

    await db.query(
      `UPDATE users 
       SET total_study_hours = total_study_hours + ?
       WHERE id = ?`,
      [minutesSpent / 60, userId]
    );

    const userCourse = await db.query(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({ userCourse: userCourse.rows[0] });
  } catch (error) {
    console.error('Error updating study time:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning-progress/users/:userId/stats
 * @desc    Получить статистику обучения
 * @access  Private
 */
router.get('/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    // Получаем статистику пользователя
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    // Получаем статистику курсов
    const coursesStats = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         AVG(average_score) as avg_score
       FROM user_courses
       WHERE user_id = ?`,
      [userId]
    );

    const stats = coursesStats[0];

    res.json({
      totalCoursesEnrolled: stats.total || 0,
      activeCourses: stats.active || 0,
      completedCourses: stats.completed || 0,
      totalLessonsCompleted: user.total_lessons_completed || 0,
      totalStudyHours: user.total_study_hours || 0,
      averageScore: stats.avg_score || 0,
      currentStreak: user.current_streak_days || 0,
      longestStreak: user.max_streak_days || 0
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

