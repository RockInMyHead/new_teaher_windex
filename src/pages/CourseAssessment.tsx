import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { sessionService } from '@/services/sessionService';
import { learningProfileService } from '@/services/learningProfileService';
import { HeaderWithHero } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Star, Clock } from 'lucide-react';

interface LessonRecord {
  id: string;
  title: string;
  topic: string;
  date: string;
  duration: number;
  llmFeedback: string;
  grade: 2 | 3 | 4 | 5;
  strengths: string[];
  improvements: string[];
}


const CourseAssessment = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssessmentData = async () => {
      if (!user?.id || !courseId) {
        setLoading(false);
        return;
      }

      try {
        console.log('📊 Loading real assessment data for:', { userId: user.id, courseId });

        // Load real lesson assessments
        const assessmentsData = await learningProfileService.getLessonAssessments(user.id, courseId);
        console.log('📊 Loaded assessments data:', assessmentsData);

        // Validate response
        if (!assessmentsData || typeof assessmentsData !== 'object') {
          console.error('❌ Invalid assessments data:', assessmentsData);
          throw new Error('Invalid assessments data received');
        }

        console.log('📊 Loaded assessments:', assessmentsData.totalAssessments);

        // Convert to component format
        const lessonRecords: LessonRecord[] = assessmentsData.assessments.map(assessment => ({
          id: assessment.id,
          title: assessment.lessonTitle,
          topic: assessment.lessonTopic || '',
          date: assessment.lessonDate,
          duration: assessment.durationMinutes || 0,
          llmFeedback: assessment.llmFeedback || '',
          grade: assessment.grade,
          strengths: assessment.strengths,
          improvements: assessment.improvements
        }));

        setLessons(lessonRecords);

      } catch (error) {
        console.error('❌ Error loading assessment data:', error);
        // Set empty data on error
        setLessons([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssessmentData();
  }, [courseId, user?.id]);

  const getGradeColor = (grade: number) => {
    switch (grade) {
      case 5: return 'text-green-600 bg-green-100';    // Отлично
      case 4: return 'text-blue-600 bg-blue-100';     // Хорошо
      case 3: return 'text-yellow-600 bg-yellow-100';  // Удовлетворительно
      case 2: return 'text-red-600 bg-red-100';        // Неудовлетворительно
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}мин`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HeaderWithHero />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-xl text-foreground">Загрузка оценки курса...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <HeaderWithHero />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/library')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад в библиотеку
          </Button>
        </div>

        {/* Course Title - removed text */}

        {/* Statistics Cards removed */}

        {/* Lessons Table */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            {/* History title removed */}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Дата</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Тема урока</th>
                    <th className="text-center py-3 px-4 font-semibold text-foreground">Оценка</th>
                    <th className="text-center py-3 px-4 font-semibold text-foreground">Время</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => (
                    <tr key={lesson.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4 text-muted-foreground">
                        {new Date(lesson.date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-foreground">{lesson.title}</div>
                          <div className="text-sm text-muted-foreground">{lesson.topic}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getGradeColor(lesson.grade)}`}>
                          {lesson.grade}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center text-muted-foreground">
                        {formatDuration(lesson.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Continue Learning */}
        <div className="text-center mt-8">
          <Button
            onClick={() => navigate(`/course/${courseId}/select-mode`)}
            size="lg"
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 px-8 py-4 text-lg"
          >
            Продолжить обучение
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CourseAssessment;
