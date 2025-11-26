import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Header } from '@/components/Header';
import { ArrowLeft, CheckCircle2, BookOpen, Clock, Target, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

interface LessonPlan {
  number: number;
  title: string;
  topic: string;
  aspects?: string;
  description?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
}

interface PersonalizedPlanData {
  courseInfo: {
    courseId: number;
    title: string;
    grade: number;
  };
  foundTopic?: {
    lessonNumber: number;
    title: string;
    topic: string;
  };
  lessons: LessonPlan[];
  userDescription: string;
  createdAt: string;
}

interface PersonalizedLearningPlanProps {
  planData: PersonalizedPlanData;
  onBack: () => void;
  onStartLearning?: () => void;
}

export const PersonalizedLearningPlan: React.FC<PersonalizedLearningPlanProps> = ({
  planData,
  onBack,
  onStartLearning,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedLesson, setExpandedLesson] = useState<number | null>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const lessonsPerPage = 5;
  const totalPages = Math.ceil(planData.lessons.length / lessonsPerPage);
  const startIndex = currentPage * lessonsPerPage;
  const endIndex = startIndex + lessonsPerPage;
  const currentLessons = planData.lessons.slice(startIndex, endIndex);

  const savePlanToDatabase = async () => {
    if (!user?.id) {
      console.warn('⚠️ User not authenticated, skipping database save');
      return;
    }

    try {
      setIsSaving(true);
      console.log('💾 Saving learning plan to database...');

      // Prepare request body
      console.log('🔍 Preparing request body...', {
        user_id: user?.id,
        planData_keys: Object.keys(planData),
        courseInfo: planData?.courseInfo
      });

      const requestBody = {
        user_id: user.id,
        course_id: planData.courseInfo.courseId,
        subject_name: planData.courseInfo.title,
        grade: planData.courseInfo.grade,
        plan_data: planData
      };

      console.log('📋 Request body prepared:', {
        user_id: requestBody.user_id,
        course_id: requestBody.course_id,
        subject_name: requestBody.subject_name,
        grade: requestBody.grade,
        plan_data_keys: Object.keys(requestBody.plan_data || {})
      });

      // Log size of data being sent
      const bodyStr = JSON.stringify(requestBody);
      const sizeInKB = Math.round(bodyStr.length / 1024);
      console.log(`📦 Request size: ${sizeInKB}KB`);
      
      if (sizeInKB > 5000) {
        console.warn(`⚠️ Plan data is very large (${sizeInKB}KB), this may cause issues`);
      }

      const response = await fetch('/api/learning-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyStr
      });

      console.log(`📡 Save response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ Server error details:`, errorData);
        throw new Error(`Failed to save plan: ${response.status} - ${errorData?.message || 'Unknown'}`);
      }

      const data = await response.json();
      console.log('✅ Learning plan saved to database:', data);
    } catch (error) {
      console.error('❌ Error saving learning plan to database:', error);
      // Не прерываем процесс, продолжаем работу
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLearning = async () => {
    // Сохраняем план в БД
    await savePlanToDatabase();

    // Вызываем пользовательский обработчик если он есть
    if (onStartLearning) {
      onStartLearning();
    }

    // Перенаправляем в Библиотеку курсов, где пользователь сможет выбрать курс
    navigate('/courses');
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-600 bg-green-50';
      case 'intermediate':
        return 'text-blue-600 bg-blue-50';
      case 'advanced':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getDifficultyLabel = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'Основной';
      case 'intermediate':
        return 'Средний';
      case 'advanced':
        return 'Продвинутый';
      default:
        return 'Общий';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            onClick={onBack}
            variant="ghost"
            className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться
          </Button>


          {/* Learning Plan */}
          <Card className="group border-2 border-border/60 bg-card/80 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-500 rounded-3xl overflow-hidden mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  План обучения
                </CardTitle>
                <span className="text-sm font-medium text-muted-foreground">
                  Страница {currentPage + 1} из {totalPages}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Lessons List */}
              <ScrollArea className="h-auto">
                <div className="space-y-3 pr-4">
                  {currentLessons.map((lesson, index) => {
                    const globalIndex = startIndex + index;
                    const isExpanded = expandedLesson === globalIndex;

                    return (
                      <div
                        key={lesson.number}
                        className="group/item border-2 border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-all"
                      >
                        <button
                          onClick={() => setExpandedLesson(isExpanded ? null : globalIndex)}
                          className="w-full p-4 bg-gradient-to-r from-card/50 to-card/30 hover:from-primary/5 hover:to-accent/5 transition-all text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {/* Lesson Number */}
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                                  {lesson.number}
                                </div>
                              </div>

                              {/* Lesson Info */}
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground group-hover/item:text-primary transition-colors">
                                  {lesson.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {lesson.topic}
                                </p>
                              </div>

                              {/* Difficulty Badge */}
                              {lesson.difficulty && (
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                                    lesson.difficulty
                                  )}`}
                                >
                                  {getDifficultyLabel(lesson.difficulty)}
                                </span>
                              )}
                            </div>

                            {/* Expand Icon */}
                            <div
                              className={`ml-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              <svg
                                className="w-5 h-5 text-muted-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-border/50 p-4 bg-card/50 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground mb-2">
                                Темы и аспекты обучения:
                              </p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {lesson.aspects || lesson.description || 'Описание содержания урока'}
                              </p>
                            </div>

                            {lesson.prerequisites && lesson.prerequisites.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-foreground mb-2">
                                  Предварительные знания:
                                </p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {lesson.prerequisites.map((prereq, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <span className="w-1 h-1 bg-primary rounded-full"></span>
                                      {prereq}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/50">
                  <Button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    variant="outline"
                    className="w-full sm:w-auto border-2 text-sm sm:text-base"
                  >
                    ← Предыдущая
                  </Button>

                  <div className="flex gap-2 order-first sm:order-none">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg font-medium transition-all text-sm sm:text-base ${
                          currentPage === i
                            ? 'bg-gradient-to-r from-primary to-accent text-white'
                            : 'border-2 border-border/50 hover:border-primary/30'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage === totalPages - 1}
                    variant="outline"
                    className="w-full sm:w-auto border-2 text-sm sm:text-base"
                  >
                    Следующая →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-12">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 h-12 sm:h-14 border-2 text-sm sm:text-base font-semibold hover:border-primary/30 hover:bg-primary/5 transition-all"
            >
              ← Вернуться и изменить
            </Button>

            <Button
              onClick={handleStartLearning}
              disabled={isSaving}
              className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-sm sm:text-base gap-2 disabled:opacity-50"
            >
              {isSaving ? 'Сохранение плана...' : 'Начать обучение →'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PersonalizedLearningPlan;

