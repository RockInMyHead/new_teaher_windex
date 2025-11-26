import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { courseService } from '@/services/courseService';
import { sessionService } from '@/services/sessionService';
import { HeaderWithHero } from '@/components/Header';

interface Subject {
  id: string;
  title: string;
  description: string;
  levels: number[];
}

const AvailableCourses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showCustomGradeModal, setShowCustomGradeModal] = useState(false);
  const [customGrade, setCustomGrade] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const response = await courseService.getSubjects();
        setSubjects(response.subjects || response);
      } catch (err) {
        console.error('Error loading subjects:', err);
        setError('Не удалось загрузить курсы');
      } finally {
        setLoading(false);
      }
    };

    loadSubjects();
  }, []);

  const handleStartLearning = (subject: Subject) => {
    setSelectedSubject(subject);
    setShowGradeModal(true);
  };

  const handleSelectGrade = async (grade: number | string) => {
    if (!selectedSubject) return;

    // Handle custom grades (could be text like A1, B2 or numbers like 12)
    const gradeValue = typeof grade === 'string' ? grade : grade;
    const courseId = `${selectedSubject.id}-${gradeValue}`;
    const courseTitle = typeof grade === 'string'
      ? `${selectedSubject.title} (${gradeValue} уровень)`
      : `${selectedSubject.title} для ${grade} класса`;

    // Сохраняем курс в библиотеку пользователя
    const userId = user?.id || 'default_user';
    const courseData = {
      courseId,
      subject: selectedSubject.id,
      grade: gradeValue,
      title: courseTitle,
      description: selectedSubject.description
    };

    try {
      // Добавляем курс в библиотеку
      await sessionService.addCourseToLibrary(courseData);

      // Также сохраняем в user state для текущего контекста
      await sessionService.saveUserState(userId, {
        currentCourseId: courseId,
        currentLessonData: {
          id: courseId,
          title: courseTitle,
          subject: selectedSubject.id,
          grade: gradeValue,
          description: selectedSubject.description,
          addedAt: new Date().toISOString()
        },
        courseInfo: {
          id: courseId,
          title: courseTitle,
          subject: selectedSubject.id,
          grade: gradeValue,
          description: selectedSubject.description
        },
        selectedCourseData: {
          id: courseId,
          title: courseTitle,
          subject: selectedSubject.id,
          grade: gradeValue,
          description: selectedSubject.description,
          addedAt: new Date().toISOString()
        }
      });

      console.log('📚 Course added to library:', courseData);

      // Закрываем модалку и переходим к выбору режима
      setShowGradeModal(false);
      setSelectedSubject(null);

      // Навигация к странице выбора режима (чат или голос)
      navigate(`/course/${courseId}/select-mode`);
    } catch (err) {
      console.error('Error saving course:', err);
      // Всё равно переходим, даже если сохранение не удалось
      setShowGradeModal(false);
      navigate(`/course/${courseId}/select-mode`);
    }
  };

  const closeModal = () => {
    setShowGradeModal(false);
    setSelectedSubject(null);
  };

  const handleCustomGradeSelect = () => {
    setShowGradeModal(false);
    setShowCustomGradeModal(true);
  };

  const handleCustomGradeSubmit = () => {
    if (customGrade.trim()) {
      // Try to parse as number, otherwise use as string
      const grade = parseInt(customGrade.trim());
      const gradeValue = isNaN(grade) ? customGrade.trim() : grade;
      handleSelectGrade(gradeValue);
      setShowCustomGradeModal(false);
      setCustomGrade('');
      setSelectedSubject(null);
    }
  };

  const closeCustomModal = () => {
    setShowCustomGradeModal(false);
    setCustomGrade('');
    setShowGradeModal(true); // Return to grade selection
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-foreground">Загрузка курсов...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-xl text-destructive mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Попробовать снова
          </button>
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
            Выберите предмет для изучения
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            9 предметов • Персонализированное обучение • Все классы с 1 по 11
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Интерактивные уроки</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>ИИ преподаватель</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Голосовое общение</span>
            </div>
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-glow cursor-pointer"
            >
              {/* Title */}
              <h3 className="text-3xl font-bold text-foreground mb-4 text-center group-hover:text-primary transition-colors">
                {subject.title}
              </h3>

              {/* Description */}
              <p className="text-muted-foreground text-sm mb-6 text-center leading-relaxed">
                {subject.description}
              </p>

              {/* Available grades */}
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-secondary rounded-full text-xs text-secondary-foreground">
                  Классы: {subject.levels[0]} - {subject.levels[subject.levels.length - 1]}
                </span>
              </div>

              {/* Start Learning Button */}
              <button
                onClick={() => handleStartLearning(subject)}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg transform hover:scale-105"
                >
                Начать обучение
              </button>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-3xl p-8 border border-primary/20">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Готовы начать обучение?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Выберите предмет и класс выше, чтобы начать персонализированный урок с ИИ-преподавателем
            </p>
            <button
              onClick={() => navigate('/library')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg"
            >
              Перейти в библиотеку курсов →
            </button>
          </div>
                    </div>
                  </div>

      {/* Grade Selection Modal */}
      {showGradeModal && selectedSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl p-8 max-w-lg w-full border border-border shadow-glow">
            {/* Modal Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">
                {selectedSubject.title}
              </h2>
              <p className="text-muted-foreground text-lg">
                Выберите класс для начала обучения
              </p>
        </div>

            {/* Grade Buttons Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {selectedSubject.levels.map((grade) => (
                <button
                  key={grade}
                  onClick={() => handleSelectGrade(grade)}
                  className="bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary hover:to-accent text-foreground hover:text-primary-foreground font-bold py-5 px-3 rounded-xl transition-all duration-300 border border-primary/30 hover:border-primary hover:scale-105 hover:shadow-glow"
                >
                  {grade}
                  <br />
                  <span className="text-xs opacity-75">класс</span>
                </button>
              ))}
              {/* Custom Grade Button */}
              <button
                onClick={handleCustomGradeSelect}
                className="bg-gradient-to-r from-secondary/20 to-secondary/30 hover:from-secondary hover:to-secondary/40 text-foreground hover:text-secondary-foreground font-bold py-5 px-3 rounded-xl transition-all duration-300 border border-secondary/30 hover:border-secondary hover:scale-105 hover:shadow-glow"
              >
                Другое
                <br />
                <span className="text-xs opacity-75">уровень</span>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={closeModal}
              className="w-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground py-4 px-6 rounded-xl transition-colors font-medium"
            >
              Отмена
            </button>
            </div>
      </div>
      )}

      {/* Custom Grade Selection Modal */}
      {showCustomGradeModal && selectedSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl p-8 max-w-lg w-full border border-border shadow-glow">
            {/* Modal Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">
                {selectedSubject.title}
              </h2>
              <p className="text-muted-foreground text-lg">
                Укажите уровень обучения
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Например: 12, A1, B2, или любой другой уровень
              </p>
            </div>

            {/* Custom Grade Input */}
            <div className="mb-8">
              <input
                type="text"
                value={customGrade}
                onChange={(e) => setCustomGrade(e.target.value)}
                placeholder="Введите уровень (например: 12, A1, B2)"
                className="w-full px-4 py-4 text-lg border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customGrade.trim()) {
                    handleCustomGradeSubmit();
                  }
                }}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleCustomGradeSubmit}
                disabled={!customGrade.trim()}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-glow hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Начать обучение
              </button>
              <button
                onClick={closeCustomModal}
                className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground py-4 px-6 rounded-xl transition-colors font-medium"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableCourses;