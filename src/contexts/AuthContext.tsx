import React, { createContext, useContext, useState, useEffect } from 'react';
import { sessionService } from '@/services/sessionService';

interface PersonalizedCourse {
  id: string;
  title: string;
  description: string;
  topics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  modules: {
    title: string;
    description: string;
    lessons: string[];
  }[];
  assessmentInsights?: {
    errorPatterns: Array<{
      category: string;
      frequency: number;
      examples: string[];
    }>;
    strengthAreas: string[];
    confidenceLevel: string;
    learningStyle: string;
    timeSpent: number;
    incorrectAnswers: number;
    totalQuestions: number;
  };
}

interface AssessmentResult {
  score: number;
  totalQuestions: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  completedAt: Date;
  weakTopics: string[];
}

interface UserStats {
  activeCourses: number;
  completedModules: number;
  averageProgress: number;
  achievements: number;
  totalLessonsCompleted: number;
  studyTimeHours: number;
  streakDays: number;
}

interface ActiveCourse {
  id: string;
  title: string;
  description: string;
  progress: number;
  level: string;
  students: string;
  color: string;
  modules: number;
  completedModules: number;
  icon: string;
  startedAt: Date;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  maxCourses: number;
  maxFamilyMembers: number;
  voiceEnabled: boolean;
  chatEnabled: boolean;
}

interface FamilyMember {
  id: string;
  name: string;
  age: number;
  courses: string[];
  username: string;
  password: string;
  createdAt: Date;
  isActive: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'learning' | 'activity' | 'social' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: string;
  points: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface AchievementProgress {
  achievementId: string;
  currentProgress: number;
  lastUpdated: Date;
}

interface PerformanceMetrics {
  totalStudyTime: number; // in minutes
  coursesCompleted: number;
  lessonsCompleted: number;
  averageScore: number;
  streakDays: number;
  weeklyProgress: {
    week: string;
    studyTime: number;
    lessonsCompleted: number;
  }[];
  monthlyProgress: {
    month: string;
    studyTime: number;
    lessonsCompleted: number;
  }[];
}

interface User {
  id: string;
  email: string;
  name: string;
  knowledgeLevel?: 'beginner' | 'intermediate' | 'advanced';
  assessmentResult?: AssessmentResult;
  personalizedCourse?: PersonalizedCourse;
  stats?: UserStats;
  completedLessons?: string[];
  activeCourses?: ActiveCourse[];
  achievements?: Achievement[];
  achievementProgress?: AchievementProgress[];
  subscription?: {
    planId: string;
    plan: SubscriptionPlan;
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
    autoRenewal: boolean;
  };
  familyMembers?: FamilyMember[];
  performanceMetrics?: PerformanceMetrics;
  isFamilyHead?: boolean;
  familyId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  updateAssessmentResult: (score: number, totalQuestions: number, weakTopics: string[], assessmentData?: any) => Promise<void>;
  updateUserStats: (updates: Partial<UserStats>) => void;
  completeLesson: (moduleId: number, lessonId: number) => void;
  startCourse: (courseData: Omit<ActiveCourse, 'startedAt'>) => void;
  updateSubscription: (planId: string) => Promise<void>;
  addFamilyMember: (memberData: Omit<FamilyMember, 'id' | 'username' | 'password' | 'createdAt'>) => Promise<void>;
  removeFamilyMember: (memberId: string) => Promise<void>;
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  stopCourse: (courseId: string) => void;
  updateAchievementProgress: (achievementId: string, newProgress: number) => void;
  checkAchievements: () => void;
  setPersonalizedCourse: (course: PersonalizedCourse) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export type { User, AssessmentResult, PersonalizedCourse, UserStats, ActiveCourse, SubscriptionPlan, FamilyMember, PerformanceMetrics, Achievement, AchievementProgress };

// Subscription plans data
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    currency: 'RUB',
    features: [
      '1 курс в месяц',
      'Чат с AI бесплатно',
      'Базовые уроки',
      'Ограниченное время обучения'
    ],
    maxCourses: 1,
    maxFamilyMembers: 1,
    voiceEnabled: false,
    chatEnabled: true
  },
  {
    id: 'standard',
    name: 'Стандарт',
    price: 990,
    currency: 'RUB',
    features: [
      '3 курса в месяц',
      'Голосовое общение',
      'Чат с AI',
      'Расширенные материалы',
      'Прогресс отслеживание'
    ],
    maxCourses: 3,
    maxFamilyMembers: 1,
    voiceEnabled: true,
    chatEnabled: true
  },
  {
    id: 'family',
    name: 'Семейный',
    price: 1999,
    currency: 'RUB',
    features: [
      'Все курсы без ограничений',
      'Голосовое общение',
      'Чат с AI',
      'До 3 человек в семье',
      'Семейная статистика',
      'Родительский контроль'
    ],
    maxCourses: -1, // unlimited
    maxFamilyMembers: 3,
    voiceEnabled: true,
    chatEnabled: true
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        
        // ВАЖНО: Устанавливаем userId в sessionService
        sessionService.setUserId(parsedUser.id);
        console.log('🔐 Restored session for user:', parsedUser.id);
        
        // Миграция: конвертируем старые ID курсов с кириллицей в латиницу
        if (parsedUser.activeCourses && parsedUser.activeCourses.length > 0) {
          const courseIdMapping: { [key: string]: string } = {
            'русский': 'russian',
            'английский': 'english',
            'арабский': 'arabic',
            'китайский': 'chinese',
            'математика': 'math',
            'физика': 'physics',
            'география': 'geography',
            'история': 'history',
            'обществознание': 'social'
          };
          
          let needsUpdate = false;
          parsedUser.activeCourses = parsedUser.activeCourses.map((course: ActiveCourse) => {
            const courseIdParts = course.id.split('-');
            if (courseIdParts.length === 2) {
              const baseId = courseIdParts[0].toLowerCase();
              const grade = courseIdParts[1];
              
              // Проверяем, содержит ли baseId кириллицу
              if (/[а-яё]/i.test(baseId)) {
                const englishId = courseIdMapping[baseId];
                if (englishId) {
                  needsUpdate = true;
                  console.log(`🔄 Migrating course ID: ${course.id} → ${englishId}-${grade}`);
                  return { ...course, id: `${englishId}-${grade}` };
                }
              }
            }
            return course;
          });
          
          if (needsUpdate) {
            console.log('💾 Saving migrated user data to localStorage');
            localStorage.setItem('user', JSON.stringify(parsedUser));
          }
        }
        
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing saved user from localStorage:', error);
        localStorage.removeItem('user');
      }
    }
    // Set loading to false after checking localStorage
    setIsLoading(false);
  }, []);

  const getInitialStats = (): UserStats => ({
    activeCourses: 0,
    completedModules: 0,
    averageProgress: 0,
    achievements: 0,
    totalLessonsCompleted: 0,
    studyTimeHours: 0,
    streakDays: 0
  });

  const getInitialAchievements = (): Achievement[] => [
    // Обучение (Learning)
    {
      id: 'first-lesson',
      title: 'Первый урок',
      description: 'Завершите свой первый урок',
      category: 'learning',
      rarity: 'common',
      requirement: 'Завершить 1 урок',
      points: 10,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'lesson-master',
      title: 'Мастер уроков',
      description: 'Завершите 10 уроков',
      category: 'learning',
      rarity: 'rare',
      requirement: 'Завершить 10 уроков',
      points: 50,
      maxProgress: 10,
      unlocked: false
    },
    {
      id: 'scholar',
      title: 'Ученый',
      description: 'Завершите 50 уроков',
      category: 'learning',
      rarity: 'epic',
      requirement: 'Завершить 50 уроков',
      points: 200,
      maxProgress: 50,
      unlocked: false
    },
    {
      id: 'knowledge-seeker',
      title: 'Искатель знаний',
      description: 'Завершите 100 уроков',
      category: 'learning',
      rarity: 'legendary',
      requirement: 'Завершить 100 уроков',
      points: 500,
      maxProgress: 100,
      unlocked: false
    },
    {
      id: 'perfect-score',
      title: 'Идеальный балл',
      description: 'Получите 100% за тест',
      category: 'learning',
      rarity: 'rare',
      requirement: 'Получить 100% в тесте',
      points: 75,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'consistent-learner',
      title: 'Последовательный ученик',
      description: 'Учитесь 7 дней подряд',
      category: 'learning',
      rarity: 'rare',
      requirement: '7 дней подряд обучения',
      points: 100,
      maxProgress: 7,
      unlocked: false
    },
    {
      id: 'early-bird',
      title: 'Ранняя пташка',
      description: 'Завершите урок до 8 утра',
      category: 'learning',
      rarity: 'common',
      requirement: 'Урок до 8:00',
      points: 25,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'night-owl',
      title: 'Ночная сова',
      description: 'Завершите урок после 22:00',
      category: 'learning',
      rarity: 'common',
      requirement: 'Урок после 22:00',
      points: 25,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'speed-demon',
      title: 'Гонщик',
      description: 'Завершите урок за менее чем 10 минут',
      category: 'learning',
      rarity: 'rare',
      requirement: 'Урок < 10 мин',
      points: 40,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'deep-thinker',
      title: 'Глубокий мыслитель',
      description: 'Проведите 2 часа за одним уроком',
      category: 'learning',
      rarity: 'rare',
      requirement: '2 часа за уроком',
      points: 60,
      maxProgress: 1,
      unlocked: false
    },
    // Активность (Activity)
    {
      id: 'first-login',
      title: 'Добро пожаловать!',
      description: 'Войдите в приложение впервые',
      category: 'activity',
      rarity: 'common',
      requirement: 'Первый вход',
      points: 5,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'week-warrior',
      title: 'Воин недели',
      description: 'Активность в приложении 7 дней',
      category: 'activity',
      rarity: 'common',
      requirement: '7 дней активности',
      points: 30,
      maxProgress: 7,
      unlocked: false
    },
    {
      id: 'month-master',
      title: 'Мастер месяца',
      description: 'Активность в приложении 30 дней',
      category: 'activity',
      rarity: 'epic',
      requirement: '30 дней активности',
      points: 150,
      maxProgress: 30,
      unlocked: false
    },
    {
      id: 'dedicated-student',
      title: 'Преданный ученик',
      description: 'Накопите 10 часов обучения',
      category: 'activity',
      rarity: 'rare',
      requirement: '10 часов обучения',
      points: 80,
      maxProgress: 600, // минуты
      unlocked: false
    },
    {
      id: 'marathon-runner',
      title: 'Марафонец',
      description: 'Накопите 50 часов обучения',
      category: 'activity',
      rarity: 'epic',
      requirement: '50 часов обучения',
      points: 300,
      maxProgress: 3000, // минуты
      unlocked: false
    },
    {
      id: 'centurion',
      title: 'Столп знания',
      description: 'Накопите 100 часов обучения',
      category: 'activity',
      rarity: 'legendary',
      requirement: '100 часов обучения',
      points: 750,
      maxProgress: 6000, // минуты
      unlocked: false
    },
    {
      id: 'chatty-student',
      title: 'Общительный ученик',
      description: 'Задайте 10 вопросов AI преподавателю',
      category: 'activity',
      rarity: 'common',
      requirement: '10 вопросов AI',
      points: 20,
      maxProgress: 10,
      unlocked: false
    },
    {
      id: 'ai-disciple',
      title: 'Ученик AI',
      description: 'Задайте 100 вопросов AI преподавателю',
      category: 'activity',
      rarity: 'epic',
      requirement: '100 вопросов AI',
      points: 250,
      maxProgress: 100,
      unlocked: false
    },
    // Социальные (Social)
    {
      id: 'social-butterfly',
      title: 'Социальная бабочка',
      description: 'Поделитесь достижением в соцсетях',
      category: 'social',
      rarity: 'common',
      requirement: 'Поделиться достижением',
      points: 10,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'ambassador',
      title: 'Посол знаний',
      description: 'Пригласите 5 друзей в приложение',
      category: 'social',
      rarity: 'rare',
      requirement: 'Пригласить 5 друзей',
      points: 100,
      maxProgress: 5,
      unlocked: false
    },
    {
      id: 'community-leader',
      title: 'Лидер сообщества',
      description: 'Пригласите 20 друзей в приложение',
      category: 'social',
      rarity: 'epic',
      requirement: 'Пригласить 20 друзей',
      points: 400,
      maxProgress: 20,
      unlocked: false
    },
    // Специальные (Special)
    {
      id: 'first-victory',
      title: 'Первая победа',
      description: 'Получите первое достижение',
      category: 'special',
      rarity: 'common',
      requirement: 'Любое достижение',
      points: 15,
      maxProgress: 1,
      unlocked: false
    },
    {
      id: 'achievement-hunter',
      title: 'Охотник за достижениями',
      description: 'Получите 10 достижений',
      category: 'special',
      rarity: 'rare',
      requirement: '10 достижений',
      points: 100,
      maxProgress: 10,
      unlocked: false
    },
    {
      id: 'legend',
      title: 'Легенда',
      description: 'Получите 25 достижений',
      category: 'special',
      rarity: 'epic',
      requirement: '25 достижений',
      points: 500,
      maxProgress: 25,
      unlocked: false
    },
    {
      id: 'ultimate-scholar',
      title: 'Высший ученый',
      description: 'Получите все достижения',
      category: 'special',
      rarity: 'legendary',
      requirement: 'Все достижения',
      points: 2000,
      maxProgress: 50,
      unlocked: false
    }
  ];

  const getInitialPerformanceMetrics = (): PerformanceMetrics => ({
    totalStudyTime: 0,
    coursesCompleted: 0,
    lessonsCompleted: 0,
    averageScore: 0,
    streakDays: 0,
    weeklyProgress: [],
    monthlyProgress: []
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    // Mock authentication - in real app, this would call an API
    if (email && password) {
      const existingUser = localStorage.getItem('user');
      if (existingUser) {
        const parsedUser = JSON.parse(existingUser);
        // Ensure achievements exist for existing users
        if (!parsedUser.achievements) {
          parsedUser.achievements = getInitialAchievements();
        }
        if (!parsedUser.achievementProgress) {
          parsedUser.achievementProgress = [];
        }
        if (!parsedUser.performanceMetrics) {
          parsedUser.performanceMetrics = getInitialPerformanceMetrics();
        }
        if (!parsedUser.stats) {
          parsedUser.stats = getInitialStats();
        }
        setUser(parsedUser);
        // ВАЖНО: Устанавливаем userId в sessionService
        sessionService.setUserId(parsedUser.id);
        console.log('🔐 Login: userId set to:', parsedUser.id);
        setIsLoading(false);
        // Check achievements on login to unlock initial achievements
        setTimeout(() => {
          checkAchievements();
        }, 100);
      } else {
        const mockUser: User = {
          id: Date.now().toString(),
          email,
          name: email.split('@')[0],
          stats: getInitialStats(),
          subscription: {
            planId: 'free',
            plan: SUBSCRIPTION_PLANS[0],
            startDate: new Date(),
            isActive: true,
            autoRenewal: false
          },
          performanceMetrics: getInitialPerformanceMetrics(),
          isFamilyHead: true,
          familyMembers: []
        };
        setUser(mockUser);
        // ВАЖНО: Устанавливаем userId в sessionService для нового пользователя
        sessionService.setUserId(mockUser.id);
        console.log('🔐 Login (new user): userId set to:', mockUser.id);
        setIsLoading(false);
        localStorage.setItem('user', JSON.stringify(mockUser));
      }
      return true;
    }
    return false;
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    // Mock registration - in real app, this would call an API
    if (name && email && password) {
        const mockUser: User = {
          id: Date.now().toString(),
          email,
          name,
          stats: getInitialStats(),
          achievements: getInitialAchievements(),
          achievementProgress: [],
          subscription: {
            planId: 'free',
            plan: SUBSCRIPTION_PLANS[0],
            startDate: new Date(),
            isActive: true,
            autoRenewal: false
          },
          performanceMetrics: getInitialPerformanceMetrics(),
          isFamilyHead: true,
          familyMembers: []
        };
      setUser(mockUser);
      // ВАЖНО: Устанавливаем userId в sessionService для нового пользователя
      sessionService.setUserId(mockUser.id);
      console.log('🔐 Register: userId set to:', mockUser.id);
      setIsLoading(false);
      localStorage.setItem('user', JSON.stringify(mockUser));
      // Check achievements for new user
      setTimeout(() => checkAchievements(), 100);
      return true;
    }
    return false;
  };

  /**
   * Generates a fully personalized course with AI-powered modules and lessons
   * Analyzes user's assessment results to create targeted learning paths
   */
  const generatePersonalizedCourse = async (
    weakTopics: string[],
    level: 'beginner' | 'intermediate' | 'advanced',
    assessmentData?: any
  ): Promise<PersonalizedCourse> => {
    try {
      console.log('🎯 Generating personalized course for topics:', weakTopics);
      console.log('📊 User level:', level, `(percentage: ${assessmentData ? Math.round((assessmentData.score / assessmentData.totalQuestions) * 100) : 'N/A'}%)`);

      // Analyze assessment data to understand learning patterns
      const learningAnalysis = analyzeAssessmentData(assessmentData);

      // Generate course title and description
      const courseTitle = generateCourseTitle(weakTopics, level, learningAnalysis);
      const courseDescription = generateCourseDescription(weakTopics, level, learningAnalysis);

      // Generate modules with AI-powered personalized lessons
      console.log('🤖 Generating AI-powered lessons for each module...');
      const modules = await Promise.all(
        weakTopics.map(async (topic, moduleIndex) => {
          const lessons = await generateModuleLessons(topic, level, {
            ...learningAnalysis,
            moduleIndex,
            assessmentData
          });

          return {
            title: `Модуль ${moduleIndex + 1}: ${topic}`,
            description: `Персонализированное изучение темы "${topic}" с учетом ваших результатов тестирования и индивидуальных особенностей обучения.`,
            lessons
          };
        })
      );

      const course: PersonalizedCourse = {
        id: `personalized-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: courseTitle,
        description: courseDescription,
        topics: weakTopics,
        difficulty: level,
        estimatedHours: calculateEstimatedHours(weakTopics.length, level, learningAnalysis),
        modules,
        assessmentInsights: learningAnalysis
      };

      console.log('✅ Successfully generated personalized course:', course.title);
      return course;

    } catch (error) {
      console.error('❌ Error generating personalized course:', error);
      return generateFallbackCourse(weakTopics, level);
    }
  };

  const updateAssessmentResult = async (score: number, totalQuestions: number, weakTopics: string[], assessmentData?: any) => {
    if (!user) return;

    const percentage = Math.round((score / totalQuestions) * 100);
    const level: 'beginner' | 'intermediate' | 'advanced' =
      percentage >= 80 ? 'advanced' :
      percentage >= 60 ? 'intermediate' : 'beginner';

    const assessmentResult: AssessmentResult = {
      score,
      totalQuestions,
      level,
      completedAt: new Date(),
      weakTopics
    };

    const updatedUser = {
      ...user,
      knowledgeLevel: level,
      assessmentResult
    };

    // Generate personalized course based on weak topics and detailed assessment data
    const personalizedCourse = await generatePersonalizedCourse(weakTopics, level, assessmentData);

    updatedUser.personalizedCourse = personalizedCourse;

    // Add personalized course to active courses if not already there
    const activeCourses = updatedUser.activeCourses || [];
    const existingPersonalizedCourse = activeCourses.find(course => course.id === 'personalized');

    if (!existingPersonalizedCourse) {
      activeCourses.push({
        id: 'personalized',
        title: personalizedCourse.title,
        description: personalizedCourse.description,
        progress: 0,
        level: level === 'beginner' ? 'Начинающий' : level === 'intermediate' ? 'Средний' : 'Продвинутый',
        students: 'Персональный',
        color: 'from-purple-500 to-pink-600',
        modules: personalizedCourse.modules.length,
        completedModules: 0,
        icon: 'Brain',
        startedAt: new Date()
      });
    }

    updatedUser.activeCourses = activeCourses;

    // Update user statistics
    updatedUser.stats = {
      ...(updatedUser.stats || getInitialStats()),
      activeCourses: activeCourses.length,
      achievements: Math.max(updatedUser.stats?.achievements || 0, 1), // At least 1 achievement for completing assessment
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  /**
   * Analyzes assessment data to extract learning patterns and insights
   */
  const analyzeAssessmentData = (assessmentData?: any) => {
    if (!assessmentData) {
      return {
        errorPatterns: [],
        strengthAreas: [],
        confidenceLevel: 'medium',
        learningStyle: 'balanced',
        timeSpent: 0
      };
    }

    const analysis = {
      errorPatterns: [] as Array<{category: string, frequency: number, examples: string[]}>,
      strengthAreas: [] as string[],
      confidenceLevel: assessmentData.confidence || 'medium',
      learningStyle: assessmentData.learningStyle || 'balanced',
      timeSpent: assessmentData.timeSpent || 0,
      incorrectAnswers: 0,
      totalQuestions: assessmentData.totalQuestions || 0
    };

    // Analyze incorrect answers
    if (assessmentData.questions && assessmentData.userAnswers) {
      const incorrectQuestions = assessmentData.questions.filter((q: any, index: number) => {
        const userAnswer = assessmentData.userAnswers[index];
        return userAnswer !== undefined && userAnswer !== q.correctAnswer;
      });

      analysis.incorrectAnswers = incorrectQuestions.length;

      // Categorize errors by topic/difficulty
      const errorCategories: {[key: string]: {count: number, examples: string[]}} = {};

      incorrectQuestions.forEach((q: any) => {
        const category = q.difficulty || 'general';
        if (!errorCategories[category]) {
          errorCategories[category] = { count: 0, examples: [] };
        }
        errorCategories[category].count++;
        if (errorCategories[category].examples.length < 3) {
          errorCategories[category].examples.push(q.question.substring(0, 100) + '...');
        }
      });

      analysis.errorPatterns = Object.entries(errorCategories).map(([category, data]) => ({
        category,
        frequency: data.count,
        examples: data.examples
      }));

      // Identify strength areas (topics with high correct answer rate)
      const correctQuestions = assessmentData.questions.filter((q: any, index: number) =>
        assessmentData.userAnswers[index] === q.correctAnswer
      );

      if (correctQuestions.length > analysis.totalQuestions * 0.7) {
        analysis.strengthAreas = ['general_knowledge'];
      }
    }

    return analysis;
  };

  /**
   * Generates intelligent course title based on topics and analysis
   */
  const generateCourseTitle = (topics: string[], level: string, analysis: any): string => {
    const levelNames = {
      beginner: 'Базовый уровень',
      intermediate: 'Средний уровень',
      advanced: 'Продвинутый уровень'
    };

    if (topics.length === 1) {
      return `${levelNames[level as keyof typeof levelNames]}: ${topics[0]}`;
    } else if (topics.length === 2) {
      return `${levelNames[level as keyof typeof levelNames]}: ${topics[0]} и ${topics[1]}`;
    } else {
      return `${levelNames[level as keyof typeof levelNames]}: Комплексное изучение`;
    }
  };

  /**
   * Generates detailed course description with personalized insights
   */
  const generateCourseDescription = (topics: string[], level: string, analysis: any): string => {
    let description = `Персонализированная программа обучения для уровня "${level}". `;

    if (analysis.incorrectAnswers > 0) {
      const accuracy = Math.round(((analysis.totalQuestions - analysis.incorrectAnswers) / analysis.totalQuestions) * 100);
      description += `Ваш результат в тестировании: ${accuracy}% правильных ответов. `;
    }

    description += `Курс фокусируется на углубленном изучении: ${topics.join(', ')}. `;

    if (analysis.errorPatterns.length > 0) {
      description += `Особое внимание уделено исправлению ошибок в темах: ${analysis.errorPatterns.map(p => p.category).join(', ')}. `;
    }

    description += `Программа адаптирована под ваш стиль обучения и индивидуальные потребности.`;

    return description;
  };

  /**
   * Calculates estimated hours based on topics, level, and learning analysis
   */
  const calculateEstimatedHours = (topicCount: number, level: string, analysis: any): number => {
    const baseHoursPerTopic = {
      beginner: 6,
      intermediate: 8,
      advanced: 10
    };

    const baseHours = topicCount * (baseHoursPerTopic[level as keyof typeof baseHoursPerTopic] || 8);

    // Adjust based on error patterns (more errors = more time needed)
    const errorMultiplier = analysis.incorrectAnswers > 0 ?
      1 + (analysis.incorrectAnswers / analysis.totalQuestions) * 0.5 : 1;

    return Math.round(baseHours * errorMultiplier);
  };

  /**
   * Generates personalized lessons for a specific module using AI
   */
  const generateModuleLessons = async (
    topic: string,
    level: string,
    context: any
  ): Promise<string[]> => {
    try {
      // Build comprehensive context for lesson generation
      const lessonContext = buildLessonGenerationContext(topic, level, context);

      console.log(`🎯 Generating lessons for topic "${topic}" at level "${level}"`);

      const generationPrompt = `Ты - ведущий эксперт-педагог с 20+ годами опыта в персонализированном обучении русского языка как иностранного.

ВАЖНО: Создай 15 уроков ТОЛЬКО для указанного уровня сложности. НЕ смешивай уровни!

КОНТЕКСТ ОБУЧЕНИЯ:
${lessonContext}

СТРОГИЕ ТРЕБОВАНИЯ К УРОКАМ:
1. Строго адаптировать ВСЕ уроки под уровень ученика - проверь каждый урок!
2. Для НАЧИНАЮЩИХ (A1-A2): Только основы алфавита, фонетики, простых слов, базовых конструкций
3. Для СРЕДНЕГО уровня (B1-B2): Грамматика, сложные предложения, расширение словаря, исправление ошибок
4. Для ПРОДВИНУТЫХ (C1-C2): Нюансы, идиомы, стилистика, профессиональная лексика, литературный анализ

СТРУКТУРА УРОКА:
"Урок N: Название урока - Подробное описание содержания, целей и методов обучения."

ФОРМАТ ОТВЕТА: Только JSON массив строк, без дополнительного текста:
["Урок 1: Название - Описание", "Урок 2: Название - Описание", ...]

ПРОВЕРЬ ПЕРЕД ОТВЕТОМ: Все ли уроки соответствуют уровню ${level}?`;

      const apiUrl = `${window.location.origin}/api/chat/completions`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [
            {
              role: 'system',
              content: 'Ты - эксперт в создании персонализированных образовательных программ. Фокусируйся на индивидуальных потребностях учеников и их ошибках.'
            },
            { role: 'user', content: generationPrompt }
          ],
          max_completion_tokens: 3000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI lesson generation failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      try {
        const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
        const lessons = JSON.parse(cleanContent);

        if (Array.isArray(lessons) && lessons.length >= 10) {
          console.log(`✅ Generated ${lessons.length} AI lessons for topic: ${topic}`);
          return lessons;
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse AI lessons for ${topic}:`, parseError);
      }

      // Fallback to template-based lessons
      return generateTemplateLessons(topic, level, context);

    } catch (error) {
      console.error(`❌ Error generating lessons for ${topic}:`, error);
      return generateTemplateLessons(topic, level, context);
    }
  };

  /**
   * Builds comprehensive context for lesson generation
   */
  const buildLessonGenerationContext = (topic: string, level: string, context: any): string => {
    // Convert level to detailed description
    const levelDescriptions = {
      beginner: 'АБСОЛЮТНЫЙ НАЧИНАЮЩИЙ (A1-A2): Знает базовый алфавит, может читать простые слова, но не понимает грамматику, не может составить простое предложение. Нужны самые основы: алфавит, фонетика, базовые слова.',
      intermediate: 'СРЕДНИЙ УРОВЕНЬ (B1-B2): Может читать и понимать простые тексты, знает базовую грамматику, может составить простые предложения, но делает ошибки в сложных конструкциях. Нужны углубленные знания грамматики, расширение словарного запаса.',
      advanced: 'ПРОДВИНУТЫЙ УРОВЕНЬ (C1-C2): Хорошо владеет языком, может читать сложные тексты, знает сложную грамматику, но может делать стилистические ошибки или не знать идиом. Нужны нюансы, идиомы, профессиональная лексика.'
    };

    const levelDescription = levelDescriptions[level as keyof typeof levelDescriptions] || levelDescriptions.intermediate;

    let promptContext = `Тема для изучения: ${topic}

УРОВЕНЬ УЧЕНИКА: ${levelDescription}
СТИЛЬ ОБУЧЕНИЯ: ${context.learningStyle || 'balanced'}
УРОВЕНЬ УВЕРЕННОСТИ: ${context.confidenceLevel || 'medium'}

КРИТИЧНО ВАЖНО: Адаптируй ВСЕ уроки строго под указанный уровень! Не давай базовые знания продвинутому ученику и наоборот.`;

    if (context.errorPatterns && context.errorPatterns.length > 0) {
      promptContext += `\n\nКОНКРЕТНЫЕ ОШИБКИ УЧЕНИКА:
${context.errorPatterns.map((pattern: any) =>
  `- ${pattern.category}: ${pattern.frequency} ошибок`
).join('\n')}

Примеры вопросов, в которых ученик ошибся:
${context.errorPatterns.flatMap((pattern: any) => pattern.examples).slice(0, 5).join('\n')}

ФОКУС: Исправить именно эти ошибки, не отвлекаться на другие темы!`;
    }

    if (context.strengthAreas && context.strengthAreas.length > 0) {
      promptContext += `\n\nСИЛЬНЫЕ СТОРОНЫ (можно не повторять основы): ${context.strengthAreas.join(', ')}`;
    }

    if (context.timeSpent) {
      promptContext += `\nВРЕМЯ НА ТЕСТИРОВАНИЕ: ${Math.round(context.timeSpent / 60)} минут`;
    }

    promptContext += `\n\nТРЕБОВАНИЕ: Уроки должны соответствовать уровню ${level}. Проверь каждый урок на соответствие уровню перед финальным ответом!`;

    return promptContext;
  };

  /**
   * Generates template-based lessons when AI fails
   */
  const generateTemplateLessons = (topic: string, level: string, context?: any): string[] => {
    const templates = {
      beginner: [
        `Урок 1: Введение в тему "${topic}" - Основные понятия и определения`,
        `Урок 2: Базовые концепции - Ключевые термины и определения`,
        `Урок 3: Простые примеры - Анализ элементарных случаев`,
        `Урок 4: Основные правила - Изучение базовых принципов`,
        `Урок 5: Практические упражнения - Закрепление изученного материала`,
        `Урок 6: Распространенные ошибки - Анализ типичных ошибок`,
        `Урок 7: Первые исключения - Знакомство с исключениями из правил`,
        `Урок 8: Повторение материала - Закрепление основных понятий`,
        `Урок 9: Самостоятельная работа - Выполнение заданий без помощи`,
        `Урок 10: Проверка понимания - Тест на усвоение основ`,
        `Урок 11: Расширение словаря - Изучение дополнительной лексики`,
        `Урок 12: Комплексные упражнения - Задания на все изученные темы`,
        `Урок 13: Анализ ошибок - Работа над индивидуальными ошибками`,
        `Урок 14: Подготовка к тестированию - Повторение сложных тем`,
        `Урок 15: Итоговое тестирование - Полная проверка базовых знаний`
      ],
      intermediate: [
        `Урок 1: Обзор темы "${topic}" - Основные концепции и понятия`,
        `Урок 2: Теоретические основы - Детальное изучение ключевых принципов`,
        `Урок 3: Практическое применение - Примеры использования в речи`,
        `Урок 4: Анализ случаев - Разбор типичных и сложных ситуаций`,
        `Урок 5: Сравнение подходов - Изучение разных способов применения`,
        `Урок 6: Исключения и нюансы - Особые случаи и исключения`,
        `Урок 7: Стилистические особенности - Разные стили и регистры речи`,
        `Урок 8: Контекстуальное употребление - Использование в разных ситуациях`,
        `Урок 9: Распространенные ошибки - Анализ ошибок среднего уровня`,
        `Урок 10: Продвинутые конструкции - Сложные грамматические структуры`,
        `Урок 11: Анализ текстов - Работа с художественными текстами`,
        `Урок 12: Творческие задания - Создание собственных примеров`,
        `Урок 13: Самостоятельный анализ - Критическое мышление и анализ`,
        `Урок 14: Подготовка к продвинутому уровню - Переход к сложным темам`,
        `Урок 15: Комплексное тестирование - Полная проверка среднего уровня`
      ],
      advanced: [
        `Урок 1: Экспертный анализ темы "${topic}" - Глубокий анализ с экспертной точки зрения`,
        `Урок 2: Исторический контекст - Развитие и эволюция концепций`,
        `Урок 3: Современные тенденции - Актуальные изменения и нововведения`,
        `Урок 4: Сравнительный анализ - Сопоставление с другими языками`,
        `Урок 5: Стилистические нюансы - Тонкие различия в употреблении`,
        `Урок 6: Профессиональное применение - Использование в специальных областях`,
        `Урок 7: Литературный анализ - Работа с классическими произведениями`,
        `Урок 8: Лингвистические исследования - Научный подход к изучению`,
        `Урок 9: Креативное использование - Нешаблонные подходы и техники`,
        `Урок 10: Критический анализ - Оценка и интерпретация сложных текстов`,
        `Урок 11: Междисциплинарные связи - Связь с другими областями знания`,
        `Урок 12: Исследовательские проекты - Самостоятельная исследовательская работа`,
        `Урок 13: Экспертная дискуссия - Обсуждение сложных тем на экспертном уровне`,
        `Урок 14: Инновационные подходы - Современные методики и техники`,
        `Урок 15: Финальная экспертиза - Комплексная оценка экспертного уровня`
      ]
    };

    const levelKey = level as keyof typeof templates;
    const template = templates[levelKey] || templates.intermediate;

    // Customize lessons based on context
    return template.map(lesson => {
      if (context?.learningStyle === 'visual') {
        return lesson.replace('урок', 'урок с визуальными материалами');
      }
      return lesson;
    });
  };

  /**
   * Generates fallback course when AI generation completely fails
   */
  const generateFallbackCourse = (
    weakTopics: string[],
    level: 'beginner' | 'intermediate' | 'advanced'
  ): PersonalizedCourse => {
    console.log('🔄 Generating fallback course due to AI failure');

      return {
      id: `fallback-${Date.now()}`,
      title: `Курс изучения русского языка - ${level}`,
      description: `Базовая программа обучения для уровня ${level} с фокусом на темы: ${weakTopics.join(', ')}`,
        topics: weakTopics,
        difficulty: level,
      estimatedHours: weakTopics.length * 8,
        modules: weakTopics.map((topic, index) => ({
          title: `Модуль ${index + 1}: ${topic}`,
        description: `Изучение темы "${topic}" с практическими упражнениями`,
        lessons: [
          `Урок 1: Введение в тему "${topic}"`,
          `Урок 2: Основные понятия`,
          `Урок 3: Практические примеры`,
          `Урок 4: Распространенные ошибки`,
          `Урок 5: Закрепление материала`,
          `Урок 6: Самостоятельная практика`,
          `Урок 7: Анализ сложных случаев`,
          `Урок 8: Творческие задания`,
          `Урок 9: Подготовка к тестированию`,
          `Урок 10: Итоговое тестирование`
        ]
        }))
      };
  };

  const logout = () => {
    setUser(null);
    setIsLoading(false);
    localStorage.removeItem('user');
  };

  const updateUserStats = (updates: Partial<UserStats>) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      stats: {
        ...(user.stats || getInitialStats()),
        ...updates
      } as UserStats
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const completeLesson = (moduleId: number, lessonId: number) => {
    if (!user) return;

    const lessonKey = `${moduleId}-${lessonId}`;
    const currentCompletedLessons = user.completedLessons || [];

    if (!currentCompletedLessons.includes(lessonKey)) {
      const updatedUser = {
        ...user,
        completedLessons: [...currentCompletedLessons, lessonKey],
        stats: {
          ...(user.stats || getInitialStats()),
          totalLessonsCompleted: (user.stats?.totalLessonsCompleted || 0) + 1,
          averageProgress: user.personalizedCourse ?
            Math.round((((user.stats?.totalLessonsCompleted || 0) + 1) /
              user.personalizedCourse.modules.reduce((acc, mod) => acc + mod.lessons.length, 0)) * 100) :
            (user.stats?.averageProgress || 0)
        },
        performanceMetrics: {
          ...(user.performanceMetrics || getInitialPerformanceMetrics()),
          lessonsCompleted: (user.performanceMetrics?.lessonsCompleted || 0) + 1
        }
      };

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Check for achievement unlocks
      checkAchievements();
    }
  };

  const startCourse = (courseData: Omit<ActiveCourse, 'startedAt'>) => {
    if (!user) return;

    // Ensure course ID is a string
    const courseId = typeof courseData.id === 'number' ? courseData.id.toString() : courseData.id;
    const normalizedCourseData = { ...courseData, id: courseId };

    const currentActiveCourses = user.activeCourses || [];
    const existingCourseIndex = currentActiveCourses.findIndex(course => course.id === courseId);

    if (existingCourseIndex === -1) {
      // Add new course
      const newCourse: ActiveCourse = {
        ...normalizedCourseData,
        startedAt: new Date()
      };

      const updatedUser = {
        ...user,
        activeCourses: [...currentActiveCourses, newCourse],
        stats: {
          ...(user.stats || getInitialStats()),
          activeCourses: (user.stats?.activeCourses || 0) + 1
        }
      };

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const updateSubscription = async (planId: string): Promise<void> => {
    if (!user) return;

    const selectedPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
    if (!selectedPlan) return;

    const updatedUser = {
      ...user,
      subscription: {
        planId,
        plan: selectedPlan,
        startDate: new Date(),
        isActive: true,
        autoRenewal: true
      }
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const addFamilyMember = async (memberData: Omit<FamilyMember, 'id' | 'username' | 'password' | 'createdAt'>): Promise<void> => {
    if (!user || !user.isFamilyHead) return;

    const currentMembers = user.familyMembers || [];
    const maxMembers = user.subscription?.plan.maxFamilyMembers || 1;

    if (currentMembers.length >= maxMembers) {
      alert(`Превышен лимит членов семьи для вашего тарифа (${maxMembers})`);
      return;
    }

    // Generate username and password
    const username = `${memberData.name.toLowerCase().replace(/\s+/g, '')}${Date.now().toString().slice(-4)}`;
    const password = Math.random().toString(36).slice(-8);

    const newMember: FamilyMember = {
      ...memberData,
      id: Date.now().toString(),
      username,
      password,
      createdAt: new Date(),
      isActive: true
    };

    const updatedUser = {
      ...user,
      familyMembers: [...currentMembers, newMember]
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    alert(`Член семьи добавлен!\nЛогин: ${username}\nПароль: ${password}`);
  };

  const removeFamilyMember = async (memberId: string): Promise<void> => {
    if (!user || !user.isFamilyHead) return;

    const updatedUser = {
      ...user,
      familyMembers: user.familyMembers?.filter(member => member.id !== memberId) || []
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updatePerformanceMetrics = (metrics: Partial<PerformanceMetrics>): void => {
    if (!user) return;

    const updatedUser = {
      ...user,
      performanceMetrics: {
        ...(user.performanceMetrics || getInitialPerformanceMetrics()),
        ...metrics
      }
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const stopCourse = (courseId: string): void => {
    if (!user) return;

    const updatedUser = {
      ...user,
      activeCourses: user.activeCourses?.filter(course => course.id !== courseId) || [],
      stats: {
        ...(user.stats || getInitialStats()),
        activeCourses: Math.max(0, (user.stats?.activeCourses || 0) - 1)
      }
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updateAchievementProgress = (achievementId: string, newProgress: number): void => {
    if (!user) return;

    const currentProgress = user.achievementProgress || [];
    const existingProgressIndex = currentProgress.findIndex(p => p.achievementId === achievementId);

    if (existingProgressIndex >= 0) {
      currentProgress[existingProgressIndex] = {
        ...currentProgress[existingProgressIndex],
        currentProgress: Math.max(currentProgress[existingProgressIndex].currentProgress, newProgress),
        lastUpdated: new Date()
      };
    } else {
      currentProgress.push({
        achievementId,
        currentProgress: newProgress,
        lastUpdated: new Date()
      });
    }

    const updatedUser = {
      ...user,
      achievementProgress: currentProgress
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    // Check if achievement should be unlocked
    checkAchievements();
  };

  const setPersonalizedCourse = (course: PersonalizedCourse): void => {
    if (!user) return;

    const updatedUser = {
      ...user,
      personalizedCourse: course
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const checkAchievements = (): void => {
    if (!user) return;

    const achievements = user.achievements || [];
    const achievementProgress = user.achievementProgress || [];
    const stats = user.stats || getInitialStats();
    const performanceMetrics = user.performanceMetrics || getInitialPerformanceMetrics();

    let achievementsUnlocked = false;
    let totalPoints = 0;

    const updatedAchievements = achievements.map(achievement => {
      const progress = achievementProgress.find(p => p.achievementId === achievement.id);
      const currentProgress = progress ? progress.currentProgress : 0;

      let shouldUnlock = false;

      switch (achievement.id) {
        case 'first-lesson':
          shouldUnlock = stats.totalLessonsCompleted >= 1;
          break;
        case 'lesson-master':
          shouldUnlock = stats.totalLessonsCompleted >= 10;
          break;
        case 'scholar':
          shouldUnlock = stats.totalLessonsCompleted >= 50;
          break;
        case 'knowledge-seeker':
          shouldUnlock = stats.totalLessonsCompleted >= 100;
          break;
        case 'consistent-learner':
          shouldUnlock = performanceMetrics.streakDays >= 7;
          break;
        case 'first-login':
          shouldUnlock = true; // Always unlocked for logged in users
          break;
        case 'week-warrior':
          shouldUnlock = performanceMetrics.streakDays >= 7;
          break;
        case 'month-master':
          shouldUnlock = performanceMetrics.streakDays >= 30;
          break;
        case 'dedicated-student':
          shouldUnlock = performanceMetrics.totalStudyTime >= 600; // 10 hours in minutes
          break;
        case 'marathon-runner':
          shouldUnlock = performanceMetrics.totalStudyTime >= 3000; // 50 hours in minutes
          break;
        case 'centurion':
          shouldUnlock = performanceMetrics.totalStudyTime >= 6000; // 100 hours in minutes
          break;
        case 'first-victory':
          shouldUnlock = achievements.some(a => a.unlocked && a.id !== 'first-victory');
          break;
        case 'achievement-hunter':
          shouldUnlock = achievements.filter(a => a.unlocked).length >= 10;
          break;
        case 'legend':
          shouldUnlock = achievements.filter(a => a.unlocked).length >= 25;
          break;
        case 'ultimate-scholar':
          shouldUnlock = achievements.filter(a => a.unlocked).length >= achievements.length - 1; // All except this one
          break;
        default:
          shouldUnlock = currentProgress >= achievement.maxProgress;
      }

      if (shouldUnlock && !achievement.unlocked) {
        achievementsUnlocked = true;
        totalPoints += achievement.points;
        return {
          ...achievement,
          unlocked: true,
          unlockedAt: new Date()
        };
      }

      return achievement;
    });

    if (achievementsUnlocked) {
      const unlockedCount = updatedAchievements.filter(a => a.unlocked).length;
      const totalPointsEarned = updatedAchievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0);

      const updatedUser = {
        ...user,
        achievements: updatedAchievements,
        stats: {
          ...stats,
          achievements: unlockedCount
        }
      };

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value = {
    user,
    login,
    register,
    updateAssessmentResult,
    updateUserStats,
    completeLesson,
    startCourse,
    updateSubscription,
    addFamilyMember,
    removeFamilyMember,
    updatePerformanceMetrics,
    stopCourse,
    updateAchievementProgress,
    checkAchievements,
    setPersonalizedCourse,
    logout,
    isAuthenticated: !!user,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
