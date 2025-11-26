-- =====================================================
-- MIGRATION: REMOVE UNUSED TABLES
-- Run this to clean up existing database
-- =====================================================

-- Drop tables in correct order (considering foreign key constraints)

-- Drop user_lessons first (references lessons and user_courses)
DROP TABLE IF EXISTS user_lessons;

-- Drop learning_plans (references courses)
DROP TABLE IF EXISTS learning_plans;

-- Drop lesson_sessions
DROP TABLE IF EXISTS lesson_sessions;

-- Drop lessons (referenced by user_lessons)
DROP TABLE IF EXISTS lessons;

-- Drop user_courses (referenced by user_lessons)
DROP TABLE IF EXISTS user_courses;

-- Drop courses last (referenced by many tables)
DROP TABLE IF EXISTS courses;

-- Verify cleanup
SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'courses',
    'lessons',
    'user_courses',
    'user_lessons',
    'learning_plans',
    'lesson_sessions'
);
