/**
 * Course Service
 * Handles course catalog from config
 *
 * IMPORTANT: Courses come from config, NOT from database
 * Database is used only for user progress
 */

import api from './api';

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: number;
  iconName?: string;
  isActive: boolean;
}



class CourseService {
  /**
   * Get all courses
   */
  async getCourses(filters?: {
    grade?: number;
    examType?: string;
    subject?: string;
  }): Promise<{ courses: Course[] }> {
    return api.get('/courses', { params: filters as any });
  }

  /**
   * Get course details from config
   */
  async getCourse(courseId: string): Promise<{ course: Course; lessons: any[] }> {
    return api.get(`/courses/${courseId}`);
  }

  /**
   * Get subjects list
   */
  async getSubjects(): Promise<{ subjects: any[] }> {
    return api.get('/courses/subjects');
  }

}

export const courseService = new CourseService();
export default courseService;

