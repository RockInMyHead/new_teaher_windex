-- =====================================================
-- TEACHER PLATFORM DATABASE SCHEMA - SQLite Version
-- Professional-grade database design for SQLite
-- =====================================================

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    
    -- User stats
    total_lessons_completed INTEGER DEFAULT 0,
    total_study_hours REAL DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    max_streak_days INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- =====================================================
-- COURSES REMOVED - NOW STORED IN CONFIG
-- =====================================================

-- =====================================================
-- USER LEARNING PROGRESS
-- =====================================================

-- =====================================================
-- LEARNING PLANS REMOVED - NOW DYNAMIC
-- =====================================================

-- =====================================================
-- CHAT & MESSAGING
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT, -- No foreign key - courses stored in config
    lesson_id TEXT, -- No foreign key - lessons are dynamic
    
    session_type TEXT DEFAULT 'interactive' CHECK (session_type IN ('lesson', 'interactive', 'voice', 'exam_prep')),
    
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_minutes INTEGER,
    
    context_data TEXT -- JSON
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_course_id ON chat_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at ON chat_sessions(started_at);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    tts_played INTEGER DEFAULT 0,
    tts_audio_url TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- =====================================================
-- EXAM PREPARATION
-- =====================================================

CREATE TABLE IF NOT EXISTS exam_courses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    exam_type TEXT NOT NULL CHECK (exam_type IN ('ЕГЭ', 'ОГЭ')),
    subject TEXT NOT NULL,
    
    progress_percentage REAL DEFAULT 0,
    topics_completed INTEGER DEFAULT 0,
    total_topics INTEGER DEFAULT 50,
    
    created_at TEXT DEFAULT (datetime('now')),
    last_studied_at TEXT,
    
    UNIQUE (user_id, exam_type, subject)
);

CREATE INDEX IF NOT EXISTS idx_exam_courses_user_id ON exam_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_courses_exam_type ON exam_courses(exam_type);

-- =====================================================
-- ACHIEVEMENTS & GAMIFICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    name TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    
    criteria_type TEXT,
    criteria_value INTEGER,
    
    points_reward INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    
    unlocked_at TEXT DEFAULT (datetime('now')),
    seen INTEGER DEFAULT 0,
    
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);

-- =====================================================
-- USER PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'ru',
    notifications_enabled INTEGER DEFAULT 1,
    
    preferred_lesson_duration INTEGER DEFAULT 30,
    study_reminders_time TEXT,
    
    tts_voice TEXT DEFAULT 'julia',
    tts_speed REAL DEFAULT 1.0,
    
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'friends', 'private')),
    
    other_settings TEXT DEFAULT '{}', -- JSON
    
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- TRIGGERS FOR REMOVED TABLES DELETED

CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
AFTER UPDATE ON user_preferences
BEGIN
    UPDATE user_preferences SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =====================================================
-- LESSON SESSIONS REMOVED - NOW USE PROFILES
-- =====================================================

-- =====================================================
-- USER STATE (replaces localStorage currentCourse, currentLesson, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_state (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL,
    
    current_course_id TEXT,
    current_lesson_data TEXT, -- JSON
    course_info TEXT, -- JSON
    lesson_index INTEGER DEFAULT 0,
    
    -- Other state data
    personalized_course TEXT, -- JSON
    selected_course_data TEXT, -- JSON
    
    updated_at TEXT DEFAULT (datetime('now'))
);

-- User Library - stores all user's selected courses
CREATE TABLE IF NOT EXISTS user_library (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL, -- No foreign key - user may not exist in users table

    course_id TEXT NOT NULL, -- e.g., 'english-11'
    subject TEXT NOT NULL, -- e.g., 'english'
    grade INTEGER NOT NULL, -- e.g., 11
    title TEXT NOT NULL, -- e.g., 'Английский язык для 11 класса'
    description TEXT,

    added_at TEXT DEFAULT (datetime('now')),
    last_accessed_at TEXT DEFAULT (datetime('now')),

    UNIQUE(user_id, course_id) -- Prevent duplicate courses
);

CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_course_id ON user_library(course_id);

CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);

-- Lesson Assessments - stores LLM evaluations of completed lessons
CREATE TABLE IF NOT EXISTS lesson_assessments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    lesson_id TEXT, -- Can be null for voice lessons
    lesson_title TEXT NOT NULL,
    lesson_topic TEXT,
    lesson_date TEXT DEFAULT (datetime('now')),
    duration_minutes INTEGER,
    grade INTEGER CHECK (grade BETWEEN 2 AND 5), -- Russian 5-point scale
    llm_feedback TEXT,
    strengths TEXT, -- JSON array of strengths
    improvements TEXT, -- JSON array of improvements
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lesson_assessments_user_id ON lesson_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assessments_course_id ON lesson_assessments(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assessments_date ON lesson_assessments(lesson_date);

CREATE TRIGGER IF NOT EXISTS update_lesson_assessments_timestamp
AFTER UPDATE ON lesson_assessments
BEGIN
    UPDATE lesson_assessments SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_state_timestamp 
AFTER UPDATE ON user_state
BEGIN
    UPDATE user_state SET updated_at = datetime('now') WHERE id = NEW.id;
END;

