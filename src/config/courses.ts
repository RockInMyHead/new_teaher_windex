export const COURSES_CONFIG = [
  {
    id: 'english',
    title: 'Английский язык',
    subject: 'english',
    description: 'Изучение английского языка с нуля до продвинутого уровня. Грамматика, лексика, разговорная практика.',
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'russian',
    title: 'Русский язык',
    subject: 'russian',
    description: 'Грамматика, орфография, пунктуация и развитие связной речи. Литературное чтение и анализ текстов.',
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'math',
    title: 'Математика',
    subject: 'math',
    description: 'Арифметика, алгебра, геометрия и математический анализ. Решение задач и развитие логического мышления.',
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'physics',
    title: 'Физика',
    subject: 'physics',
    description: 'Основы физики: механика, электричество, оптика, термодинамика. Эксперименты и практические задачи.',
    levels: [7, 8, 9, 10, 11],
  },
  {
    id: 'history',
    title: 'История',
    subject: 'history',
    description: 'История России и мира. Важные события, личности и культурные достижения.',
    levels: [5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'geography',
    title: 'География',
    subject: 'geography',
    description: 'Физическая и экономическая география. Изучение планеты Земля и ее народов.',
    levels: [5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'social-studies',
    title: 'Обществознание',
    subject: 'social-studies',
    description: 'Основы общественных наук: право, экономика, социология, политология.',
    levels: [5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'arabic',
    title: 'Арабский язык',
    subject: 'arabic',
    description: 'Изучение арабского языка: алфавит, грамматика, лексика и разговорная практика. Культура арабских стран.',
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  {
    id: 'chinese',
    title: 'Китайский язык',
    subject: 'chinese',
    description: 'Изучение китайского языка: иероглифы, грамматика, лексика и разговорная практика. Культура Китая.',
    levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
];

export function getFullCourseTitle(courseId: string, level: number): string {
  const course = COURSES_CONFIG.find(c => c.id === courseId.split('-')[0]);
  if (course) {
    return `${course.title} для ${level} класса`;
  }
  return `Курс ${courseId} для ${level} класса`;
}

export function parseCourseId(courseId: string): { subject: string; level: number } {
  const parts = courseId.split('-');
  if (parts.length === 2) {
    return { subject: parts[0], level: parseInt(parts[1]) };
  }
  return { subject: courseId, level: 0 }; // Fallback
}

export function getCourseById(courseId: string) {
  const { subject } = parseCourseId(courseId);
  return COURSES_CONFIG.find(c => c.id === subject);
}

export function getAvailableCourses(): typeof COURSES_CONFIG {
  return COURSES_CONFIG;
}