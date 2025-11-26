/**
 * Session Management Routes
 * Handles lesson sessions, chat history, and user state
 * Replaces localStorage functionality
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Helper function to get single row
const getOne = async (sql, params) => {
  const result = await query(sql, params);
  return result.rows?.[0] || null;
};

// Helper function to get all rows
const getAll = async (sql, params) => {
  const result = await query(sql, params);
  return result.rows || [];
};

// =====================================================
// LESSON SESSIONS
// =====================================================

/**
 * @route   GET /api/sessions/lesson/:userId/:courseId
 * @desc    Get lesson session for a user and course
 */
router.get('/lesson/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    
    const session = await getOne(
      `SELECT * FROM lesson_sessions WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );
    
    if (!session) {
      return res.json({ session: null });
    }
    
    // Parse JSON fields
    const parsedSession = {
      ...session,
      completedLessons: JSON.parse(session.completed_lessons || '[]'),
      homeworks: JSON.parse(session.homeworks || '[]'),
      notes: session.notes ? JSON.parse(session.notes) : null,
      lessonNumber: session.lesson_number,
      lastLessonDate: session.last_lesson_date
    };
    
    res.json({ session: parsedSession });
  } catch (error) {
    console.error('Error getting lesson session:', error);
    res.status(500).json({ error: 'Failed to get lesson session' });
  }
});

/**
 * @route   POST /api/sessions/lesson
 * @desc    Create or update lesson session
 */
router.post('/lesson', async (req, res) => {
  try {
    const { userId, courseId, lessonNumber, completedLessons, homeworks, currentTopic, notes } = req.body;
    
    if (!userId || !courseId) {
      return res.status(400).json({ error: 'userId and courseId are required' });
    }
    
    // Check if session exists
    const existing = await getOne(
      `SELECT id FROM lesson_sessions WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );
    
    if (existing) {
      // Update existing session
      await query(
        `UPDATE lesson_sessions SET
          lesson_number = COALESCE(?, lesson_number),
          completed_lessons = COALESCE(?, completed_lessons),
          homeworks = COALESCE(?, homeworks),
          current_topic = COALESCE(?, current_topic),
          notes = COALESCE(?, notes),
          last_lesson_date = datetime('now')
        WHERE user_id = ? AND course_id = ?`,
        [
          lessonNumber,
          completedLessons ? JSON.stringify(completedLessons) : null,
          homeworks ? JSON.stringify(homeworks) : null,
          currentTopic,
          notes ? JSON.stringify(notes) : null,
          userId,
          courseId
        ]
      );
    } else {
      // Create new session
      await query(
        `INSERT INTO lesson_sessions (user_id, course_id, lesson_number, completed_lessons, homeworks, current_topic, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          courseId,
          lessonNumber || 1,
          JSON.stringify(completedLessons || []),
          JSON.stringify(homeworks || []),
          currentTopic || null,
          notes ? JSON.stringify(notes) : null
        ]
      );
    }
    
    // Return updated session
    const session = await getOne(
      `SELECT * FROM lesson_sessions WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );
    
    res.json({
      success: true,
      session: {
        ...session,
        completedLessons: JSON.parse(session.completed_lessons || '[]'),
        homeworks: JSON.parse(session.homeworks || '[]'),
        lessonNumber: session.lesson_number,
        lastLessonDate: session.last_lesson_date
      }
    });
  } catch (error) {
    console.error('Error saving lesson session:', error);
    res.status(500).json({ error: 'Failed to save lesson session' });
  }
});

/**
 * @route   DELETE /api/sessions/lesson/:userId/:courseId
 * @desc    Delete lesson session
 */
router.delete('/lesson/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    
    await query(
      `DELETE FROM lesson_sessions WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson session:', error);
    res.status(500).json({ error: 'Failed to delete lesson session' });
  }
});

// =====================================================
// CHAT HISTORY
// =====================================================

/**
 * @route   GET /api/sessions/chat/:userId/:courseId
 * @desc    Get chat history for a user and course
 */
router.get('/chat/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // First, find a chat session
    const session = await getOne(
      `SELECT id FROM chat_sessions 
       WHERE user_id = ? AND (course_id = ? OR (course_id IS NULL AND ? = 'general'))
       ORDER BY started_at DESC LIMIT 1`,
      [userId, courseId === 'general' ? null : courseId, courseId]
    );
    
    if (!session) {
      return res.json({ messages: [] });
    }
    
    // Get messages for this session
    const messages = await getAll(
      `SELECT id, role, content, tts_played, created_at as timestamp
       FROM chat_messages 
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [session.id, limit]
    );
    
    res.json({ messages });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

/**
 * @route   POST /api/sessions/chat
 * @desc    Save chat messages
 */
router.post('/chat', async (req, res) => {
  try {
    const { userId, courseId, messages } = req.body;
    
    if (!userId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'userId and messages array are required' });
    }
    
    // Find or create chat session
    let session = await getOne(
      `SELECT id FROM chat_sessions 
       WHERE user_id = ? AND (course_id = ? OR (course_id IS NULL AND ? = 'general'))
       ORDER BY started_at DESC LIMIT 1`,
      [userId, courseId === 'general' ? null : courseId, courseId]
    );
    
    if (!session) {
      // Create new session
      await query(
        `INSERT INTO chat_sessions (user_id, course_id, session_type)
         VALUES (?, ?, 'interactive')`,
        [userId, courseId === 'general' ? null : courseId]
      );
      
      // Get the created session
      session = await getOne(
        `SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1`,
        [userId]
      );
    }
    
    // Clear existing messages and insert new ones
    await query(`DELETE FROM chat_messages WHERE session_id = ?`, [session.id]);
    
    for (const msg of messages) {
      await query(
        `INSERT INTO chat_messages (session_id, role, content, tts_played, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          session.id,
          msg.role,
          msg.content,
          msg.ttsPlayed ? 1 : 0,
          msg.timestamp || new Date().toISOString()
        ]
      );
    }
    
    res.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

/**
 * @route   DELETE /api/sessions/chat/:userId/:courseId
 * @desc    Clear chat history for a user and course
 */
router.delete('/chat/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    
    // Find session
    const session = await getOne(
      `SELECT id FROM chat_sessions 
       WHERE user_id = ? AND (course_id = ? OR (course_id IS NULL AND ? = 'general'))`,
      [userId, courseId === 'general' ? null : courseId, courseId]
    );
    
    if (session) {
      // Delete messages
      await query(`DELETE FROM chat_messages WHERE session_id = ?`, [session.id]);
      // Delete session
      await query(`DELETE FROM chat_sessions WHERE id = ?`, [session.id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// =====================================================
// USER STATE
// =====================================================

/**
 * @route   GET /api/sessions/state/:userId
 * @desc    Get user state (current course, lesson, etc.)
 */
router.get('/state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const state = await getOne(
      `SELECT * FROM user_state WHERE user_id = ?`,
      [userId]
    );
    
    if (!state) {
      return res.json({ state: null });
    }
    
    res.json({
      state: {
        currentCourseId: state.current_course_id,
        currentLessonData: state.current_lesson_data ? JSON.parse(state.current_lesson_data) : null,
        courseInfo: state.course_info ? JSON.parse(state.course_info) : null,
        lessonIndex: state.lesson_index,
        personalizedCourse: state.personalized_course ? JSON.parse(state.personalized_course) : null,
        selectedCourseData: state.selected_course_data ? JSON.parse(state.selected_course_data) : null
      }
    });
  } catch (error) {
    console.error('Error getting user state:', error);
    res.status(500).json({ error: 'Failed to get user state' });
  }
});

/**
 * @route   POST /api/sessions/state
 * @desc    Update user state
 */
router.post('/state', async (req, res) => {
  try {
    const { 
      userId, 
      currentCourseId, 
      currentLessonData, 
      courseInfo, 
      lessonIndex,
      personalizedCourse,
      selectedCourseData
    } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Check if state exists
    const existing = await getOne(
      `SELECT id FROM user_state WHERE user_id = ?`,
      [userId]
    );
    
    if (existing) {
      // Update existing state
      await query(
        `UPDATE user_state SET
          current_course_id = COALESCE(?, current_course_id),
          current_lesson_data = COALESCE(?, current_lesson_data),
          course_info = COALESCE(?, course_info),
          lesson_index = COALESCE(?, lesson_index),
          personalized_course = COALESCE(?, personalized_course),
          selected_course_data = COALESCE(?, selected_course_data)
        WHERE user_id = ?`,
        [
          currentCourseId,
          currentLessonData ? JSON.stringify(currentLessonData) : null,
          courseInfo ? JSON.stringify(courseInfo) : null,
          lessonIndex,
          personalizedCourse ? JSON.stringify(personalizedCourse) : null,
          selectedCourseData ? JSON.stringify(selectedCourseData) : null,
          userId
        ]
      );
    } else {
      // Create new state
      await query(
        `INSERT INTO user_state (user_id, current_course_id, current_lesson_data, course_info, lesson_index, personalized_course, selected_course_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          currentCourseId || null,
          currentLessonData ? JSON.stringify(currentLessonData) : null,
          courseInfo ? JSON.stringify(courseInfo) : null,
          lessonIndex || 0,
          personalizedCourse ? JSON.stringify(personalizedCourse) : null,
          selectedCourseData ? JSON.stringify(selectedCourseData) : null
        ]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving user state:', error);
    res.status(500).json({ error: 'Failed to save user state' });
  }
});

/**
 * @route   DELETE /api/sessions/state/:userId
 * @desc    Clear user state
 */
router.delete('/state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await query(`DELETE FROM user_state WHERE user_id = ?`, [userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing user state:', error);
    res.status(500).json({ error: 'Failed to clear user state' });
  }
});

/**
 * @route   POST /api/sessions/state/clear-course
 * @desc    Clear course-related state (when starting new course)
 */
router.post('/state/clear-course', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    await query(
      `UPDATE user_state SET
        current_course_id = NULL,
        current_lesson_data = NULL,
        course_info = NULL,
        lesson_index = 0,
        personalized_course = NULL,
        selected_course_data = NULL
      WHERE user_id = ?`,
      [userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing course state:', error);
    res.status(500).json({ error: 'Failed to clear course state' });
  }
});

// =====================================================
// USER LIBRARY
// =====================================================

/**
 * @route   POST /api/sessions/library
 * @desc    Add course to user's library
 */
router.post('/library', async (req, res) => {
  try {
    const { userId, courseId, subject, grade, title, description } = req.body;

    if (!userId || !courseId || !subject || !grade || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if course already exists in library
    const existing = await getOne(
      `SELECT id FROM user_library WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );

    if (existing) {
      // Update last accessed time
      await query(
        `UPDATE user_library SET last_accessed_at = datetime('now') WHERE id = ?`,
        [existing.id]
      );
    } else {
      // Add new course to library
      await query(
        `INSERT INTO user_library (user_id, course_id, subject, grade, title, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, courseId, subject, grade, title, description]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding course to library:', error);
    res.status(500).json({ error: 'Failed to add course to library' });
  }
});

/**
 * @route   GET /api/sessions/library/:userId
 * @desc    Get user's library
 */
router.get('/library/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const courses = await getAll(
      `SELECT id, course_id as courseId, subject, grade, title, description,
              added_at as addedAt, last_accessed_at as lastAccessedAt
       FROM user_library
       WHERE user_id = ?
       ORDER BY last_accessed_at DESC`,
      [userId]
    );

    res.json({ courses });
  } catch (error) {
    console.error('Error getting user library:', error);
    res.status(500).json({ error: 'Failed to get user library' });
  }
});

/**
 * @route   DELETE /api/sessions/library/:userId/:courseId
 * @desc    Remove course from user's library
 */
router.delete('/library/:userId/:courseId', async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    await query(
      `DELETE FROM user_library WHERE user_id = ? AND course_id = ?`,
      [userId, courseId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing course from library:', error);
    res.status(500).json({ error: 'Failed to remove course from library' });
  }
});

module.exports = router;
