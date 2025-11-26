import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/Header';
import { GraduationCap, BookOpen, Plus, Check } from 'lucide-react';
import { examService } from '@/services';

interface Subject {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const EGE_SUBJECTS: Subject[] = [
  { id: 'math-profile', name: 'Математика (профиль)', icon: '📐', description: 'Углубленный уровень для технических специальностей' },
  { id: 'math-base', name: 'Математика (база)', icon: '🔢', description: 'Базовый уровень' },
  { id: 'russian', name: 'Русский язык', icon: '📝', description: 'Обязательный экзамен' },
  { id: 'physics', name: 'Физика', icon: '⚛️', description: 'Для технических и естественнонаучных направлений' },
  { id: 'chemistry', name: 'Химия', icon: '🧪', description: 'Для медицинских и химических специальностей' },
  { id: 'biology', name: 'Биология', icon: '🧬', description: 'Для медицинских и биологических направлений' },
  { id: 'history', name: 'История', icon: '📜', description: 'Для гуманитарных направлений' },
  { id: 'social', name: 'Обществознание', icon: '👥', description: 'Для социальных и гуманитарных специальностей' },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', description: 'Иностранный язык' },
  { id: 'literature', name: 'Литература', icon: '📚', description: 'Для филологических направлений' },
  { id: 'informatics', name: 'Информатика', icon: '💻', description: 'Для IT-специальностей' },
  { id: 'geography', name: 'География', icon: '🌍', description: 'Для географических и экологических направлений' },
];

const OGE_SUBJECTS: Subject[] = [
  { id: 'math', name: 'Математика', icon: '🔢', description: 'Обязательный экзамен' },
  { id: 'russian', name: 'Русский язык', icon: '📝', description: 'Обязательный экзамен' },
  { id: 'physics', name: 'Физика', icon: '⚛️', description: 'Предмет по выбору' },
  { id: 'chemistry', name: 'Химия', icon: '🧪', description: 'Предмет по выбору' },
  { id: 'biology', name: 'Биология', icon: '🧬', description: 'Предмет по выбору' },
  { id: 'history', name: 'История', icon: '📜', description: 'Предмет по выбору' },
  { id: 'social', name: 'Обществознание', icon: '👥', description: 'Предмет по выбору' },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', description: 'Предмет по выбору' },
  { id: 'literature', name: 'Литература', icon: '📚', description: 'Предмет по выбору' },
  { id: 'informatics', name: 'Информатика', icon: '💻', description: 'Предмет по выбору' },
  { id: 'geography', name: 'География', icon: '🌍', description: 'Предмет по выбору' },
];

const ExamAddCourse: React.FC = () => {
  const navigate = useNavigate();
  const { examType } = useParams<{ examType: string }>();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const isEGE = examType?.toLowerCase() === 'егэ';
  const subjects = isEGE ? EGE_SUBJECTS : OGE_SUBJECTS;
  const examTypeName = isEGE ? 'ЕГЭ' : 'ОГЭ';

  const handleToggleSubject = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  const handleAddCourses = async () => {
    try {
      // Get current user (default for now)
      const userId = 'default_user';

      // Create new courses
      const newCourses = selectedSubjects.map(subjectId => {
        const subject = subjects.find(s => s.id === subjectId);
        return {
          examType: examTypeName,
          subject: subject?.name || subjectId,
          totalTopics: 50, // Default value
        };
      });

      // Add courses via API
      const result = await examService.addBulkExamCourses(userId, newCourses);

      console.log('Added exam courses:', result.examCourses);

      // Navigate back to exams page to show the added courses
      navigate('/exams');
    } catch (error) {
      console.error('Failed to add exam courses:', error);
      // Fallback to exams page on error
      navigate('/exams');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/exams')}
            className="mb-4"
          >
            ← Назад к экзаменам
          </Button>

          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${
                isEGE
                  ? 'from-green-500 to-emerald-600'
                  : 'from-green-500 to-emerald-600'
              } rounded-full mb-6`}
            >
              {isEGE ? (
                <GraduationCap className="w-10 h-10 text-white" />
              ) : (
                <BookOpen className="w-10 h-10 text-white" />
              )}
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Добавить предметы для {examTypeName}
            </h1>
            <p className="text-xl text-gray-600">
              Выберите предметы, которые хотите подготовить
            </p>
          </div>
        </div>

        {/* Selected Count */}
        {selectedSubjects.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  Выбрано предметов: {selectedSubjects.length}
                </p>
                <p className="text-sm text-gray-600">
                  {subjects
                    .filter(s => selectedSubjects.includes(s.id))
                    .map(s => s.name)
                    .join(', ')}
                </p>
              </div>
              <Button
                onClick={handleAddCourses}
                className={`bg-gradient-to-r ${
                  isEGE
                  ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                } gap-2`}
              >
                <Plus className="w-4 h-4" />
                Добавить курсы
              </Button>
            </div>
          </div>
        )}

        {/* Subjects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id);
            return (
              <Card
                key={subject.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-300 ${
                  isSelected
                    ? isEGE
                      ? 'border-2 border-green-500 bg-green-50'
                      : 'border-2 border-green-500 bg-green-50'
                    : 'border-2 border-transparent hover:border-gray-300'
                }`}
                onClick={() => handleToggleSubject(subject.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{subject.icon}</div>
                    {isSelected && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isEGE
                            ? 'bg-green-500'
                            : 'bg-green-500'
                        }`}
                      >
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {subject.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {subject.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Action Button */}
        {selectedSubjects.length > 0 && (
          <div className="mt-8 text-center">
            <Button
              onClick={handleAddCourses}
              size="lg"
              className={`bg-gradient-to-r ${
                isEGE
                  ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  : 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              } gap-2 px-12 py-6 text-lg`}
            >
              <Plus className="w-5 h-5" />
              Добавить выбранные курсы ({selectedSubjects.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamAddCourse;

