/**
 * Exam Service
 * Handles ЕГЭ and ОГЭ exam courses
 */

import api from './api';

export interface ExamCourse {
  id: string;
  userId: string;
  examType: 'ЕГЭ' | 'ОГЭ';
  subject: string;
  progressPercentage: number;
  topicsCompleted: number;
  totalTopics: number;
  createdAt: string;
  lastStudiedAt?: string;
}

class ExamService {
  /**
   * Get user's exam courses
   */
  async getUserExamCourses(userId: string, examType?: string): Promise<{ examCourses: ExamCourse[] }> {
    return api.get(`/exams/user/${userId}`, {
      params: examType ? { examType } : undefined,
    });
  }

  /**
   * Add exam course
   */
  async addExamCourse(data: {
    userId: string;
    examType: string;
    subject: string;
    totalTopics?: number;
  }): Promise<{ examCourse: ExamCourse }> {
    return api.post('/exams', data);
  }

  /**
   * Add multiple exam courses
   */
  async addBulkExamCourses(
    userId: string,
    courses: Array<{
      examType: string;
      subject: string;
      totalTopics?: number;
    }>
  ): Promise<{ examCourses: ExamCourse[] }> {
    return api.post('/exams/bulk', { userId, examCourses: courses });
  }

  /**
   * Update exam course progress
   */
  async updateExamCourse(
    examCourseId: string,
    data: {
      progressPercentage?: number;
      topicsCompleted?: number;
      lastStudiedAt?: string;
    }
  ): Promise<{ examCourse: ExamCourse }> {
    return api.put(`/exams/${examCourseId}`, data);
  }

  /**
   * Delete exam course
   */
  async deleteExamCourse(userId: string, examCourseId: string): Promise<{ message: string }> {
    return api.delete(`/exams/${examCourseId}`);
  }

  /**
   * Get specific exam course
   */
  async getExamCourse(
    userId: string,
    examType: string,
    subject: string
  ): Promise<{ examCourse: ExamCourse }> {
    return api.get(`/exams/${userId}/${examType}/${subject}`);
  }

}

export const examService = new ExamService();
export default examService;

