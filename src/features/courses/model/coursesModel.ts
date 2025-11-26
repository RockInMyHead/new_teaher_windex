/**
 * Courses Model Module
 * State management and business logic for courses
 * @module features/courses/model/coursesModel
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  CoursePlan,
  LessonPlan,
  CourseFilter,
  CourseProgress,
  LessonCompletionResult
} from '../types';
import {
  getAllCourses,
  getCourseByGrade,
  getLesson,
  searchCourses,
  getAvailableGrades,
  validateLessonAccess
} from '../api/coursesApi';

/**
 * Custom hook for managing courses list
 */
export function useCoursesModel() {
  const [courses, setCourses] = useState<CoursePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CourseFilter>({});

  /**
   * Load all courses
   */
  const loadCourses = useCallback(async (newFilter?: CourseFilter) => {
    setIsLoading(true);
    setError(null);

    try {
      const filterToUse = newFilter || filter;
      const loadedCourses = await getAllCourses(filterToUse);
      setCourses(loadedCourses);
      if (newFilter) {
        setFilter(newFilter);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
      console.error('Failed to load courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  /**
   * Search courses by query
   */
  const search = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await searchCourses(query);
      setCourses(results);
      setFilter({ ...filter, searchQuery: query });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  /**
   * Filter by grade
   */
  const filterByGrade = useCallback((grade: number) => {
    loadCourses({ ...filter, grade });
  }, [filter, loadCourses]);

  /**
   * Filter by subject
   */
  const filterBySubject = useCallback((subject: string) => {
    loadCourses({ ...filter, subject });
  }, [filter, loadCourses]);

  /**
   * Clear filters
   */
  const clearFilters = useCallback(() => {
    setFilter({});
    loadCourses({});
  }, [loadCourses]);

  return {
    courses,
    isLoading,
    error,
    filter,
    loadCourses,
    search,
    filterByGrade,
    filterBySubject,
    clearFilters
  };
}

/**
 * Custom hook for managing single course
 */
export function useCourseModel(grade: number) {
  const [course, setCourse] = useState<CoursePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load course data
   */
  const loadCourse = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedCourse = await getCourseByGrade(grade);
      setCourse(loadedCourse || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load course');
      console.error('Failed to load course:', err);
    } finally {
      setIsLoading(false);
    }
  }, [grade]);

  /**
   * Get lesson by number
   */
  const getLessonByNumber = useCallback((lessonNumber: number): LessonPlan | undefined => {
    return course?.lessons.find(l => l.number === lessonNumber);
  }, [course]);

  /**
   * Get lessons by difficulty
   */
  const getLessonsByDifficulty = useCallback(
    (difficulty: 'beginner' | 'intermediate' | 'advanced'): LessonPlan[] => {
      return course?.lessons.filter(l => l.difficulty === difficulty) || [];
    },
    [course]
  );

  useEffect(() => {
    if (grade) {
      loadCourse();
    }
  }, [grade, loadCourse]);

  return {
    course,
    isLoading,
    error,
    loadCourse,
    getLessonByNumber,
    getLessonsByDifficulty
  };
}

/**
 * Custom hook for managing lesson
 */
export function useLessonModel(grade: number, lessonNumber: number) {
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load lesson data
   */
  const loadLesson = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedLesson = await getLesson(grade, lessonNumber);
      setLesson(loadedLesson || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
      console.error('Failed to load lesson:', err);
    } finally {
      setIsLoading(false);
    }
  }, [grade, lessonNumber]);

  useEffect(() => {
    if (grade && lessonNumber) {
      loadLesson();
    }
  }, [grade, lessonNumber, loadLesson]);

  return {
    lesson,
    isLoading,
    error,
    loadLesson
  };
}

/**
 * Custom hook for managing course progress
 */
export function useCourseProgress(courseId: number, grade: number) {
  const [progress, setProgress] = useState<CourseProgress>({
    courseId,
    grade,
    completedLessons: [],
    overallProgress: 0,
    startedAt: new Date(),
    lastAccessedAt: new Date()
  });

  /**
   * Mark lesson as completed
   */
  const completeLesson = useCallback((result: LessonCompletionResult) => {
    setProgress(prev => {
      const newCompleted = [...prev.completedLessons];
      if (!newCompleted.includes(result.lessonId)) {
        newCompleted.push(result.lessonId);
      }

      // Calculate new progress (assuming we know total lessons)
      const overallProgress = Math.round((newCompleted.length / 100) * 100); // Placeholder calculation

      return {
        ...prev,
        completedLessons: newCompleted,
        currentLesson: result.lessonId + 1,
        overallProgress,
        lastAccessedAt: new Date()
      };
    });
  }, []);

  /**
   * Set current lesson
   */
  const setCurrentLesson = useCallback((lessonNumber: number) => {
    setProgress(prev => ({
      ...prev,
      currentLesson: lessonNumber,
      lastAccessedAt: new Date()
    }));
  }, []);

  /**
   * Check if lesson can be started
   */
  const canStartLesson = useCallback(async (lessonNumber: number): Promise<boolean> => {
    return validateLessonAccess(grade, lessonNumber, progress.completedLessons);
  }, [grade, progress.completedLessons]);

  /**
   * Reset progress
   */
  const resetProgress = useCallback(() => {
    setProgress({
      courseId,
      grade,
      completedLessons: [],
      overallProgress: 0,
      startedAt: new Date(),
      lastAccessedAt: new Date()
    });
  }, [courseId, grade]);

  // Progress is now managed via sessionService and DB - no localStorage needed

  return {
    progress,
    completeLesson,
    setCurrentLesson,
    canStartLesson,
    resetProgress
  };
}

/**
 * Custom hook for available grades
 */
export function useAvailableGrades() {
  const [grades, setGrades] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadGrades = async () => {
      setIsLoading(true);
      try {
        const availableGrades = await getAvailableGrades();
        setGrades(availableGrades);
      } catch (err) {
        console.error('Failed to load grades:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGrades();
  }, []);

  return { grades, isLoading };
}





