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

  // Обработка экзаменационных курсов (ЕГЭ-математика-..., ОГЭ-физика-...)
  if (parts.length >= 3 && (parts[0] === 'ЕГЭ' || parts[0] === 'ОГЭ')) {
    // Для экзаменационных курсов subject - это вторая часть (предмет)
    const examType = parts[0];
    let subject = parts[1];

    // Обработка специальных случаев с пробелами в названии
    if (subject === 'математика' && parts[2] === '(профиль)') {
      subject = 'math'; // Математика (профиль)
    } else if (subject === 'математика' && parts[2] === '(база)') {
      subject = 'math'; // Математика (база)
    } else if (subject === 'русский') {
      subject = 'russian';
    } else if (subject === 'английский') {
      subject = 'english';
    } else if (subject === 'физика') {
      subject = 'physics';
    } else if (subject === 'химия') {
      subject = 'chemistry';
    } else if (subject === 'биология') {
      subject = 'biology';
    } else if (subject === 'история') {
      subject = 'history';
    } else if (subject === 'обществознание') {
      subject = 'social-studies';
    } else if (subject === 'информатика') {
      subject = 'informatics';
    } else if (subject === 'география') {
      subject = 'geography';
    } else if (subject === 'литература') {
      subject = 'literature';
    }

    return { subject, level: 0 }; // Экзаменационные курсы не имеют уровня класса
  }

  // Обработка обычных курсов (english-5, russian-7, etc.)
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