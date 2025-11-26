/**
 * Course Naming Utility
 * Генерация человеко-читаемых названий курсов на основе предмета и класса
 */

export interface CourseInfo {
  subject: string;
  grade?: number;
  exam_type?: string;
}

/**
 * Словарь названий предметов на русском языке
 */
const subjectNames: Record<string, string> = {
  'math': 'Математика',
  'russian': 'Русский язык',
  'english': 'Английский язык',
  'physics': 'Физика',
  'chemistry': 'Химия',
  'biology': 'Биология',
  'history': 'История',
  'geography': 'География',
  'literature': 'Литература',
  'social_studies': 'Обществознание',
  'informatics': 'Информатика',
  'music': 'Музыка',
  'art': 'Изобразительное искусство',
  'physical_education': 'Физическая культура',
  'technology': 'Технология'
};

/**
 * Словарь типов экзаменов
 */
const examTypeNames: Record<string, string> = {
  'ЕГЭ': 'ЕГЭ',
  'ОГЭ': 'ОГЭ',
  'ВПР': 'ВПР'
};

/**
 * Генерирует человеко-читаемое название курса
 */
export function generateCourseTitle(course: CourseInfo): string {
  // Для экзаменационных курсов
  if (course.exam_type) {
    const subjectName = subjectNames[course.subject] || course.subject;
    const examName = examTypeNames[course.exam_type] || course.exam_type;
    return `${subjectName} (${examName})`;
  }

  // Для обычных школьных курсов
  if (course.grade) {
    const subjectName = subjectNames[course.subject] || capitalizeFirstLetter(course.subject);
    return `${subjectName} для ${course.grade} класса`;
  }

  // Для курсов без класса (общие курсы)
  const subjectName = subjectNames[course.subject] || capitalizeFirstLetter(course.subject);
  return subjectName;
}

/**
 * Генерирует краткое название курса (для интерфейса)
 */
export function generateCourseShortTitle(course: CourseInfo): string {
  if (course.exam_type) {
    const subjectName = subjectNames[course.subject] || course.subject;
    const examName = examTypeNames[course.exam_type] || course.exam_type;
    return `${subjectName} ${examName}`;
  }

  if (course.grade) {
    const subjectName = subjectNames[course.subject] || course.subject;
    return `${subjectName} ${course.grade}`;
  }

  return subjectNames[course.subject] || capitalizeFirstLetter(course.subject);
}

/**
 * Преобразует course ID в читаемое название
 * Например: "math-5" -> "Математика для 5 класса"
 */
export function courseIdToTitle(courseId: string): string {
  // Разбираем courseId
  const parts = courseId.split('-');
  if (parts.length < 2) return capitalizeFirstLetter(courseId);

  const subject = parts[0];
  const gradeOrType = parts.slice(1).join('-');

  // Проверяем, является ли вторая часть числом (класс)
  const grade = parseInt(gradeOrType);
  if (!isNaN(grade)) {
    return generateCourseTitle({ subject, grade });
  }

  // Проверяем на экзаменационный тип
  if (gradeOrType.toLowerCase().includes('ege')) {
    return generateCourseTitle({ subject, exam_type: 'ЕГЭ' });
  }
  if (gradeOrType.toLowerCase().includes('oge')) {
    return generateCourseTitle({ subject, exam_type: 'ОГЭ' });
  }

  // Общий случай
  return generateCourseTitle({ subject });
}

/**
 * Вспомогательная функция для капитализации первой буквы
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Получить информацию о курсе из объекта
 */
export function getCourseInfo(course: any): CourseInfo {
  return {
    subject: course.subject,
    grade: course.grade,
    exam_type: course.exam_type
  };
}

/**
 * Генерирует полное описание курса для LLM
 */
export function generateCourseDescriptionForLLM(course: any): string {
  const title = generateCourseTitle(getCourseInfo(course));
  const grade = course.grade ? `${course.grade} класс` : 'общего уровня';
  const subject = subjectNames[course.subject] || course.subject;

  return `${title} - курс ${subject.toLowerCase()} для учащихся ${grade}. ${course.description || ''}`;
}

/**
 * Генерирует приветствие для начала урока
 */
export function generateLessonGreeting(course: any, studentName?: string): string {
  const title = generateCourseTitle(getCourseInfo(course));
  const greeting = studentName
    ? `Привет, ${studentName}! Сегодня мы продолжим изучение курса "${title}".`
    : `Привет! Сегодня мы продолжим изучение курса "${title}".`;

  return greeting;
}
