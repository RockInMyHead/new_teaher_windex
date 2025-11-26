import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React, { ReactNode } from "react";
import { Brain, BookOpen, MessageCircle, Award, LogOut, Menu, X, User, Home, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface HeaderWithHeroProps {
  title?: string | ReactNode;
  subtitle?: string;
  showHero?: boolean;
}

const HeaderWithHero = ({ title, subtitle, showHero = true }: HeaderWithHeroProps) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background">
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          {/* Левая часть - Логотип */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-200"
              onClick={() => navigate('/')}
            >
              <Brain className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Центральная часть - Навигация */}
          <div className="flex-1 flex justify-center">
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => navigate('/library')}
              >
                <Home className="w-4 h-4" />
                Библиотека
              </Button>
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => navigate('/available-courses')}
              >
                <BookOpen className="w-4 h-4" />
                Курсы
              </Button>
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => {
                  console.log('🗣️ Chat button clicked, navigating to /chat');
                  navigate('/chat');
                }}
              >
                <MessageCircle className="w-4 h-4" />
                Чат
              </Button>
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => navigate('/achievements')}
              >
                <Award className="w-4 h-4" />
                Достижения
              </Button>
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => navigate('/exams')}
              >
                <GraduationCap className="w-4 h-4" />
                Экзамены
              </Button>
            </nav>
          </div>

          {/* Мобильная навигация */}
          <nav className="md:hidden">
            <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2">
                  <Menu className="w-4 h-4" />
                  <span className="hidden xs:inline">Меню</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/library');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Библиотека
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/available-courses');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
                  Курсы
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    console.log('🗣️ Mobile chat button clicked, navigating to /chat');
                    navigate('/chat');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
                  Чат
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/achievements');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
                  Достижения
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/exams');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4" />
                  Экзамены
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigate('/account');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Аккаунт
                </DropdownMenuItem>
                {isAuthenticated ? (
                  <DropdownMenuItem
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Выход
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/auth');
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
                  >
                    <User className="w-4 h-4" />
                    Войти
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Правая часть - Личный кабинет или Вход */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/account')}
                >
                  Аккаунт
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Выход
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 gap-2 font-semibold"
              >
                <User className="w-4 h-4" />
                Войти
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>

  </div>
  );
};

// Старый компонент Header для обратной совместимости
const Header = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Левая часть - Логотип */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-200"
              onClick={() => navigate('/')}
            >
              <Brain className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Центральная часть - Навигация */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => navigate('/library')}
            >
              <BookOpen className="w-4 h-4" />
              Библиотека
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => navigate('/available-courses')}
            >
              <BookOpen className="w-4 h-4" />
              Курсы
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => navigate('/chat')}
            >
              <MessageCircle className="w-4 h-4" />
              Чат
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => navigate('/achievements')}
            >
              <Award className="w-4 h-4" />
              Достижения
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={() => {
                console.log('🧪 Exams button clicked');
                navigate('/exams');
              }}
            >
              <GraduationCap className="w-4 h-4" />
              Экзамены
            </Button>
          </nav>

          {/* Мобильная навигация */}
          <nav className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2">
                  <Menu className="w-4 h-4" />
                  <span className="hidden xs:inline">Меню</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => navigate('/library')}
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Библиотека
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/available-courses')}
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Курсы
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/chat')}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Чат
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/achievements')}
                  className="flex items-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  Достижения
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    console.log('📱 Mobile Exams button clicked');
                    navigate('/exams');
                  }}
                  className="flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  Экзамены
                </DropdownMenuItem>
                {isAuthenticated ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => navigate('/account')}
                      className="flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Аккаунт
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Выход
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => navigate('/auth')}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
                  >
                    <User className="w-4 h-4" />
                    Войти
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Правая часть - Аккаунт или Вход */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/account')}
                >
                  Аккаунт
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Выход
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 gap-2 font-semibold"
              >
                <User className="w-4 h-4" />
                Войти
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderWithHero;
export { Header, HeaderWithHero };

