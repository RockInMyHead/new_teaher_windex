import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { PersonalizedLearningPlan } from '@/components/PersonalizedLearningPlan';
import { sessionService } from '@/services/sessionService';

interface LastTopicInputProps {
  level: string;
  levelGrade: number;
  courseId: number;
  onSubmit: (topic: string) => void;
  onBack: () => void;
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
  lessons: any[];
  userDescription: string;
  createdAt: string;
}

export const LastTopicInput: React.FC<LastTopicInputProps> = ({
  level,
  levelGrade,
  courseId,
  onSubmit,
  onBack
}) => {
  // В новой архитектуре этот компонент не используется
  // Персонализация происходит через профиль ученика в чате
  return null;

  // Функция для получения placeholder текста для каждого курса
  const getPlaceholderText = (courseId: number): string => {
    const placeholders: { [key: number]: string } = {
      0: "Например: Я изучал правописание жи-ши, части речи или правила построения предложений...",
      1: "Например: Я изучал Present Simple, как образуются утвердительные предложения или базовый алфавит...",
      2: "Например: Я изучал арабский алфавит, базовые слова или простые фразы для общения...",
      3: "Например: Я изучал основные иероглифы, тоны произношения или простые разговорные фразы...",
      4: "Например: Я изучал сложение и вычитание, умножение и деление или геометрические фигуры...",
      5: "Например: Я изучал механику, электричество или оптику...",
      6: "Например: Я изучал физическую географию, политическую карту мира или климатические зоны...",
      7: "Например: Я изучал древний мир, средние века или историю России...",
      8: "Например: Я изучал социологию, психологию или право..."
    };
    return placeholders[courseId] || "Например: Расскажите о последней изученной теме или понятии...";
  };

  const handleSubmit = async () => {
    if (!topic.trim()) {
      alert('Пожалуйста, опишите последнюю изученную тему');
      return;
    }

    setIsSubmitting(true);

    // Получаем название курса
    const courseNames: Record<number, string> = {
      0: 'Русский язык',
      1: 'Английский язык',
      2: 'Арабский язык',
      3: 'Китайский язык',
      4: 'Математика',
      5: 'Физика',
      6: 'География',
      7: 'История',
      8: 'Обществознание'
    };
    const courseName = courseNames[courseId] || 'Предмет';

    try {
      console.log(`📚 Looking for course: ${courseName}, Grade: ${levelGrade}`);
      
      // Ищем курс в COURSE_PLANS
      const coursePlan = COURSE_PLANS.find(plan => 
        plan.title.toLowerCase().includes(courseName.toLowerCase()) &&
        plan.grade === levelGrade
      );

      if (!coursePlan) {
        throw new Error(`Курс не найден: ${courseName} для ${levelGrade} класса`);
      }

      console.log(`✅ Found course with ${coursePlan.lessons.length} lessons`);

      // Ищем урок с введенной темой
      const matchResult = findLessonByTopic(courseName, levelGrade, topic);

      let startLessonIndex = 0;
      let foundTopicInfo = null;

      if (matchResult) {
        startLessonIndex = matchResult.lessonIndex;
        foundTopicInfo = {
          lessonNumber: matchResult.lesson.number,
          title: matchResult.lesson.title,
          topic: matchResult.lesson.topic
        };
        console.log(`🎯 Found matching topic at lesson ${startLessonIndex + 1}: "${matchResult.lesson.title}"`);
      } else {
        console.log(`⚠️ No matching topic found, starting from the beginning`);
      }

      // Берем уроки начиная с найденного урока
      const plannedLessons = coursePlan.lessons.slice(startLessonIndex);

      // Преобразуем в формат приложения
      const personalizedData = {
        foundTopic: foundTopicInfo,
        courseInfo: {
          courseId,
          title: coursePlan.title,
          grade: coursePlan.grade
        },
        lessons: plannedLessons,
        userDescription: topic,
        createdAt: new Date().toISOString()
      };

      // Save to DB via sessionService
      sessionService.saveUserState({ personalizedCourse: personalizedData });
      setGeneratedPlan(personalizedData);

      // Небольшая задержка для UX
      setTimeout(() => {
        setShowPlan(true);
        setIsSubmitting(false);
      }, 800);
    } catch (error) {
      console.error('❌ Error generating plan:', error);
      alert(`Не удалось создать план обучения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);

    // Получаем название курса
    const courseNames: Record<number, string> = {
      0: 'Русский язык',
      1: 'Английский язык',
      2: 'Арабский язык',
      3: 'Китайский язык',
      4: 'Математика',
      5: 'Физика',
      6: 'География',
      7: 'История',
      8: 'Обществознание'
    };
    const courseName = courseNames[courseId] || 'Предмет';

    try {
      console.log(`📚 Loading full course from COURSE_PLANS: ${courseName}, Grade: ${levelGrade}`);
      
      // Ищем полный курс в COURSE_PLANS
      const coursePlan = COURSE_PLANS.find(plan => 
        plan.title.toLowerCase().includes(courseName.toLowerCase()) &&
        plan.grade === levelGrade
      );

      if (!coursePlan) {
        throw new Error(`Курс не найден: ${courseName} для ${levelGrade} класса`);
    }

      console.log(`✅ Loaded full course with ${coursePlan.lessons.length} lessons`);

      // Преобразуем в формат приложения (без поиска темы, берем весь курс)
    const personalizedData = {
      foundTopic: null,
      courseInfo: {
        courseId,
          title: coursePlan.title,
          grade: coursePlan.grade
      },
        lessons: coursePlan.lessons,
      userDescription: 'Не указано (пропущено)',
      createdAt: new Date().toISOString()
    };

    // Save to DB via sessionService
    sessionService.saveUserState({ personalizedCourse: personalizedData });
    setGeneratedPlan(personalizedData);

    // Небольшая задержка для UX
    setTimeout(() => {
      setShowPlan(true);
      setIsSubmitting(false);
    }, 800);
    } catch (error) {
      console.error('❌ Error loading course:', error);
      alert(`Не удалось загрузить курс: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setIsSubmitting(false);
    }
  };

  const handlePlanBack = () => {
    setShowPlan(false);
    setGeneratedPlan(null);
  };

  const handleStartLearning = () => {
    onSubmit(topic);
    // Будет переходить через PersonalizedLearningPlan на /lesson
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter или Cmd+Enter для отправки
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Show personalized plan if generated
  if (showPlan && generatedPlan) {
    return (
      <PersonalizedLearningPlan
        planData={generatedPlan}
        onBack={handlePlanBack}
        onStartLearning={handleStartLearning}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Button
            onClick={onBack}
            variant="ghost"
            className="mb-4 md:mb-6 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Вернуться к выбору уровня</span>
            <span className="sm:hidden">Назад</span>
          </Button>

          {/* Main Card */}
          <Card className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 border-2 hover:border-primary/50 animate-fade-in-up overflow-hidden bg-gradient-to-br from-card via-card/50 to-card/30">
            <CardHeader className="text-center pb-6 md:pb-8 px-4 md:px-8">

              <CardTitle className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 group-hover:text-primary transition-colors bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                ЧТО ВЫ ПОСЛЕДНЕЕ ИЗУЧАЛИ?
              </CardTitle>

              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto px-2">
                Расскажите нам о последней теме, которую вы изучали, чтобы мы смогли подобрать вам персонализированный план обучения
              </p>
            </CardHeader>

            <CardContent className="space-y-4 md:space-y-6 px-4 md:px-8 pb-6 md:pb-8">
              {/* Textarea Section */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm md:text-base font-semibold text-foreground">
                    Описание темы:
                  </label>
                </div>

                <Textarea
                  placeholder={getPlaceholderText(courseId)}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value.slice(0, 500))}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  className="min-h-32 md:min-h-40 text-sm md:text-base border-2 border-border/50 bg-card/80 hover:border-primary/30 focus:border-primary/50 transition-colors resize-none rounded-lg focus:bg-card"
                />

              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 md:pt-8 border-t border-border/50">
                <Button
                  onClick={onBack}
                  variant="outline"
                  disabled={isSubmitting}
                  className="flex-1 h-10 md:h-12 border-2 hover:border-primary/30 hover:bg-primary/5 transition-all gap-2 order-3 sm:order-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Назад</span>
                  <span className="sm:hidden">К выбору уровня</span>
                </Button>

                <Button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  variant="ghost"
                  className="flex-1 h-10 md:h-12 border-2 border-muted hover:border-muted/50 hover:bg-muted/20 transition-all gap-2 disabled:opacity-50 disabled:cursor-not-allowed order-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Создание...</span>
                    </>
                  ) : (
                    <span>Пропустить</span>
                  )}
                </Button>

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !topic.trim()}
                  className="flex-1 h-10 md:h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold gap-2 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Создание плана...</span>
                    </>
                  ) : (
                    <>
                      <span>Продолжить</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Skip Option */}
              <div className="pt-3 md:pt-4 border-t border-border/30">
                <Button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  variant="link"
                  className="w-full h-8 md:h-10 text-xs md:text-sm text-muted-foreground hover:text-primary transition-colors gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3 md:w-4 h-3 md:h-4 animate-spin" />
                      <span>Создание...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-center">Пропустить и начать с основ</span>
                    </>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Bottom Spacing */}
          <div className="mt-8 md:mt-12 text-center px-4">
            <p className="text-xs md:text-sm text-muted-foreground/50">
              Шаг 2 из 2: Определение уровня и подбор плана
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LastTopicInput;

