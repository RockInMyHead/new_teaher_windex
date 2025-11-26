import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { GraduationCap, BookOpen, Plus, Trash2, ChevronRight, Award } from 'lucide-react';
import { examService } from '@/services';

interface ExamCourse {
  id: string;
  examType: 'ЕГЭ' | 'ОГЭ';
  subject: string;
  progress: number;
  totalTopics: number;
  completedTopics: number;
  lastStudied?: string;
}

const Exams: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [examCourses, setExamCourses] = useState<ExamCourse[]>([]);
  const [selectedExamType, setSelectedExamType] = useState<'ЕГЭ' | 'ОГЭ' | null>(null);

  useEffect(() => {
    const loadExamCourses = async () => {
      try {
        const userId = 'default_user';
        const response = await examService.getUserExamCourses(userId);
        setExamCourses(response.examCourses || []);
      } catch (error) {
        console.error('Failed to load exam courses:', error);
        // No fallback - exam courses are only stored in DB
        setExamCourses([]);
      }
    };

    // Load courses when component mounts or when returning to /exams page
    if (location.pathname === '/exams') {
      loadExamCourses();
    }
  }, [location.pathname]);

  const handleSelectExamType = (type: 'ЕГЭ' | 'ОГЭ') => {
    setSelectedExamType(type);
  };

  const handleAddCourse = () => {
    if (!selectedExamType) return;
    navigate(`/exams/${selectedExamType.toLowerCase()}/add`);
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const userId = 'default_user';
      await examService.deleteExamCourse(userId, courseId);
      // Reload courses after deletion
      const response = await examService.getUserExamCourses(userId);
      setExamCourses(response.examCourses || []);
    } catch (error) {
      console.error('Failed to delete exam course:', error);
      // Update local state even if API fails
      const updatedCourses = examCourses.filter(course => course.id !== courseId);
      setExamCourses(updatedCourses);
    }
  };

  const filteredCourses = selectedExamType
    ? examCourses.filter(course => course.examType === selectedExamType)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Подготовка к экзаменам
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Выберите тип экзамена для подготовки
          </p>
        </div>

        {/* Exam Type Selection */}
        {!selectedExamType ? (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* ЕГЭ Card */}
            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-green-300 group"
              onClick={() => handleSelectExamType('ЕГЭ')}
            >
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">ЕГЭ</h2>
                  <p className="text-gray-600 mb-6">
                    Единый Государственный Экзамен
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>11 класс</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Поступление в ВУЗ</span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectExamType('ЕГЭ');
                    }}
                  >
                    Выбрать ЕГЭ
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ОГЭ Card */}
            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-green-300 group"
              onClick={() => handleSelectExamType('ОГЭ')}
            >
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <BookOpen className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">ОГЭ</h2>
                  <p className="text-gray-600 mb-6">
                    Основной Государственный Экзамен
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>9 класс</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Аттестат об основном образовании</span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectExamType('ОГЭ');
                    }}
                  >
                    Выбрать ОГЭ
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => setSelectedExamType(null)}
                className="gap-2"
              >
                ← Назад к выбору экзамена
              </Button>
            </div>

            {/* Selected Exam Type Header */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 bg-gradient-to-br ${
                      selectedExamType === 'ЕГЭ'
                        ? 'from-green-500 to-emerald-600'
                        : 'from-green-500 to-emerald-600'
                    } rounded-full flex items-center justify-center`}
                  >
                    {selectedExamType === 'ЕГЭ' ? (
                      <Award className="w-8 h-8 text-white" />
                    ) : (
                      <BookOpen className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Подготовка к {selectedExamType}
                    </h2>
                    <p className="text-gray-600">
                      {filteredCourses.length}{' '}
                      {filteredCourses.length === 1
                        ? 'курс'
                        : filteredCourses.length < 5
                        ? 'курса'
                        : 'курсов'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddCourse}
                  className={`bg-gradient-to-r ${
                    selectedExamType === 'ЕГЭ'
                      ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                      : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  } gap-2`}
                >
                  <Plus className="w-4 h-4" />
                  Добавить предмет
                </Button>
              </div>
            </div>

            {/* Exam Courses List */}
            {filteredCourses.length === 0 ? (
              <Card className="bg-white/50 border-dashed border-2">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Курсов пока нет
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Добавьте предмет для подготовки к {selectedExamType}
                  </p>
                  <Button
                    onClick={handleAddCourse}
                    className={`bg-gradient-to-r ${
                      selectedExamType === 'ЕГЭ'
                        ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                        : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    } gap-2`}
                  >
                    <Plus className="w-4 h-4" />
                    Добавить первый предмет
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="hover:shadow-lg transition-all duration-300 cursor-pointer"
                    onClick={() => navigate(`/course/${course.id}/select-mode`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {course.subject}
                          </h3>
                          <Badge
                            className={
                              course.examType === 'ЕГЭ'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-green-100 text-green-700'
                            }
                          >
                            {course.examType}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(course.id);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">Прогресс</span>
                            <span className="font-medium text-gray-900">
                              {course.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                course.examType === 'ЕГЭ'
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-600'
                              }`}
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Темы:</span>
                          <span className="font-medium text-gray-900">
                            {course.completedTopics} / {course.totalTopics}
                          </span>
                        </div>

                        {course.lastStudied && (
                          <div className="text-xs text-gray-500 pt-2 border-t">
                            Последнее занятие: {course.lastStudied}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Exams;

