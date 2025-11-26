/**
 * Course Registry
 * Central registry for all available courses
 * This file serves as an index, actual course data is in separate files
 * @module features/courses/data/courseRegistry
 */

import type { CoursePlan, Subject } from '../types';

/**
 * Course metadata for registry
 */
export interface CourseRegistryEntry {
  id: number;
  title: string;
  subject: Subject | string;
  grades: number[];
  description: string;
  totalLessons: number;
  dataPath: string; // Path to the actual course data
}

/**
 * Main course registry
 * Maps course IDs to their metadata
 */
export const COURSE_REGISTRY: CourseRegistryEntry[] = [
  {
    id: 1,
    title: 'Английский язык',
    subject: 'english',
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Полный курс английского языка для школьников',
    totalLessons: 200, // Приблизительно
    dataPath: 'english'
  },
  {
    id: 2,
    title: 'Математика',
    subject: 'mathematics',
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Математика от базовых операций до высшей математики',
    totalLessons: 180,
    dataPath: 'mathematics'
  },
  {
    id: 3,
    title: 'Русский язык',
    subject: 'russian',
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Изучение русского языка и грамматики',
    totalLessons: 160,
    dataPath: 'russian'
  },
  {
    id: 4,
    title: 'Арабский язык',
    subject: 'arabic',
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Изучение арабского языка: алфавит, грамматика, разговорная практика',
    totalLessons: 150,
    dataPath: 'arabic'
  },
  {
    id: 5,
    title: 'Китайский язык',
    subject: 'chinese',
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Изучение китайского языка: иероглифы, грамматика, разговорная практика',
    totalLessons: 150,
    dataPath: 'chinese'
  },
  // Дополнительные курсы будут добавлены по мере миграции данных
];

/**
 * Get course registry entry by ID
 */
export function getCourseRegistryEntry(courseId: number): CourseRegistryEntry | undefined {
  return COURSE_REGISTRY.find(entry => entry.id === courseId);
}

/**
 * Get all courses for a specific grade
 */
export function getCoursesByGrade(grade: number): CourseRegistryEntry[] {
  return COURSE_REGISTRY.filter(entry => entry.grades.includes(grade));
}

/**
 * Get all courses for a specific subject
 */
export function getCoursesBySubject(subject: string): CourseRegistryEntry[] {
  return COURSE_REGISTRY.filter(entry => entry.subject === subject);
}

/**
 * Search courses by title or description
 */
export function searchCourses(query: string): CourseRegistryEntry[] {
  const lowerQuery = query.toLowerCase();
  return COURSE_REGISTRY.filter(entry =>
    entry.title.toLowerCase().includes(lowerQuery) ||
    entry.description.toLowerCase().includes(lowerQuery)
  );
}





