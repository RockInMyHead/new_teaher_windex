-- =====================================================
-- DATABASE INITIALIZATION WITH SEED DATA - SQLite
-- Run this after schema.sqlite.sql to populate initial data
-- =====================================================

-- Courses are now stored in config files, not database

-- Lessons are now dynamic and stored in config, not database

-- Insert default achievements
INSERT OR IGNORE INTO achievements (name, title, description, icon_name, criteria_type, criteria_value, points_reward)
VALUES
  ('first-lesson', 'Первый урок', 'Завершите первый урок', 'GraduationCap', 'lessons_completed', 1, 10),
  ('week-streak', 'Недельная серия', 'Занимайтесь 7 дней подряд', 'Flame', 'streak_days', 7, 50),
  ('ten-lessons', '10 уроков', 'Завершите 10 уроков', 'BookOpen', 'lessons_completed', 10, 100),
  ('month-streak', 'Месячная серия', 'Занимайтесь 30 дней подряд', 'Trophy', 'streak_days', 30, 200);

