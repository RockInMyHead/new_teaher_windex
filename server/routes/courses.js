/**
 * Courses API Routes
 * Handles course catalog from config
 *
 * ВАЖНО: Курсы берутся из конфига, НЕ из БД
 * БД используется только для прогресса пользователя
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getAllCourses, getCourseById, getFullCourseTitle, parseCourseId } = require('../config/courses');

/**
 * Helper function to get icon for subject
 */
function getIconForSubject(subject) {
  const icons = {
    'english': 'Globe',
    'russian': 'BookOpen',
    'math': 'Calculator',
    'physics': 'Atom',
    'chemistry': 'Flask',
    'biology': 'Dna',
    'history': 'Clock',
    'geography': 'Map',
    'informatics': 'Code',
    'literature': 'Book',
    'social': 'Users',
    'arabic': 'Globe'
  };
  return icons[subject] || 'BookOpen';
}

/**
 * @route   GET /api/courses
 * @desc    Get all courses from config (NOT from DB)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { subject } = req.query;
    
    // Получаем курсы из конфига
    let courses = getAllCourses();
    
    // Фильтрация по предмету если указан
    if (subject) {
      courses = courses.filter(c => c.subject === subject);
    }
    
    // Формируем ответ с дополнительными данными для каждого уровня
    const coursesWithLevels = [];
    for (const course of courses) {
      for (const level of course.levels) {
        coursesWithLevels.push({
          id: `${course.id}-${level}`,
          title: getFullCourseTitle(course.id, level),
          subject: course.subject,
          grade: level,
          description: course.description,
          icon_name: getIconForSubject(course.subject),
          is_active: true
        });
      }
    }
    
    console.log(`📚 [Courses API] Returning ${coursesWithLevels.length} courses from config`);
    res.json(coursesWithLevels);
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/courses/subjects
 * @desc    Get list of available subjects
 * @access  Public
 */
router.get('/subjects', (req, res) => {
  const courses = getAllCourses();
  const subjects = courses.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    levels: c.levels
  }));
  res.json(subjects);
});


/**
 * @route   GET /api/courses/:courseId
 * @desc    Get course details from config (NOT from DB)
 * @access  Public
 */
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Парсим courseId для получения предмета и уровня
    const { subject, level } = parseCourseId(courseId);
    const courseConfig = getCourseById(courseId);
    
    if (!courseConfig) {
      console.log(`⚠️ Course not found in config: ${courseId}, creating fallback`);
    }
    
    // Формируем курс из конфига
    const course = {
      id: courseId,
      title: getFullCourseTitle(courseId, level),
      subject: courseConfig?.subject || subject,
      grade: level,
      description: courseConfig?.description || `Курс ${subject} для ${level} класса`,
      icon_name: getIconForSubject(courseConfig?.subject || subject),
      is_active: true,
      levels: courseConfig?.levels || [level]
    };
    
    console.log(`📚 [Courses API] Returning course: "${course.title}"`);
    res.json({ course, lessons: [] }); // Уроки генерируются динамически
  } catch (error) {
    console.error('Error getting course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});






module.exports = router;

