import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { sessionService } from '@/services/sessionService';
import { HeaderWithHero } from '@/components/Header';

interface CourseData {
  id: string;
  courseId: string;
  title: string;
  subject: string;
  grade: number;
  description: string;
  addedAt: string;
}

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    try {
      // Проверяем, что пользователь загружен
      if (!user?.id) {
        console.log('⏳ Waiting for user to load...');
        return;
      }
      
      console.log('📚 Loading library data for user:', user.id);
      const userCourses = await sessionService.getUserLibrary();
      console.log('📚 Library data loaded:', userCourses.length, 'courses');
      setCourses(userCourses);
    } catch (err) {
      console.error('Error loading library:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // Загружаем только когда пользователь загружен
    if (user?.id) {
      loadLibrary();
    }

    // Обновляем данные при возвращении в приложение (focus event)
    const handleFocus = () => {
      if (user?.id) {
        console.log('📚 Library page focused, reloading data...');
        loadLibrary();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadLibrary, user?.id]);

  const handleContinueCourse = (course: CourseData) => {
    navigate(`/course/${course.courseId}/select-mode`);
  };

  const handleViewAssessment = (course: CourseData) => {
    navigate(`/course-assessment/${course.courseId}`);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-foreground">Загрузка библиотеки...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Header */}
      <HeaderWithHero />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-6">
            Моя библиотека курсов
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {courses.length > 0
              ? `${courses.length} ${courses.length === 1 ? 'курс' : courses.length < 5 ? 'курса' : 'курсов'} для изучения`
              : 'Ваша персональная коллекция курсов'
            }
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <div className="text-6xl">📚</div>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ваша библиотека пуста
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Добавьте курсы на странице "Курсы", чтобы начать персонализированное обучение
            </p>
            <button
              onClick={() => navigate('/available-courses')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg transform hover:scale-105"
            >
              <span>🎓</span>
              Выбрать курсы
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {courses.map((course) => (
              <div
                key={course.id || course.courseId}
                className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-glow"
              >
                {/* Title */}
                <h3 className="text-3xl font-bold text-foreground mb-4 text-center group-hover:text-primary transition-colors">
                  {course.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-sm mb-6 text-center leading-relaxed">
                  {course.description}
                </p>

                {/* Added date */}
                <div className="text-center mb-6">
                  <span className="inline-block px-3 py-1 bg-secondary rounded-full text-xs text-secondary-foreground">
                    Добавлен: {new Date(course.addedAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleContinueCourse(course)}
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg transform hover:scale-105 text-sm"
                  >
                    Продолжить обучение
                  </button>
                  {/* Кнопка оценки закомментирована
                  <button
                    onClick={() => handleViewAssessment(course)}
                    className="flex-1 bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-secondary-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-border hover:border-primary/50 text-sm"
                  >
                    📊 Оценка
                  </button>
                  */}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-3xl p-8 border border-primary/20">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Хотите изучить новый предмет?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Добавьте больше курсов в свою библиотеку для разнообразного обучения
            </p>
            <button
              onClick={() => navigate('/available-courses')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg"
            >
              <span>➕</span>
              Выбрать новые курсы
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Library;
