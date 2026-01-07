import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'jlpt.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Chapters (e.g., Chapter 1-5 from textbook)
  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0
  );

  -- Question types (grammar, reading, vocabulary, etc.)
  CREATE TABLE IF NOT EXISTS question_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ja TEXT,
    description TEXT
  );

  -- Reading passages (for grouping reading questions)
  CREATE TABLE IF NOT EXISTS reading_passages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
  );

  -- Questions
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    type_id INTEGER NOT NULL,
    passage_id INTEGER,
    content TEXT NOT NULL,
    order_in_passage INTEGER DEFAULT 0,
    explanation TEXT,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (type_id) REFERENCES question_types(id),
    FOREIGN KEY (passage_id) REFERENCES reading_passages(id)
  );

  -- Answer options
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  -- Training sessions
  CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    type_filter TEXT,
    chapter_filter TEXT,
    total_questions INTEGER NOT NULL,
    current_index INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0
  );

  -- Session questions (stores shuffled order and user answers)
  CREATE TABLE IF NOT EXISTS session_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    shuffled_answer_order TEXT NOT NULL,
    user_answer_id INTEGER,
    is_correct INTEGER,
    answered_at TEXT,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (user_answer_id) REFERENCES answers(id)
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type_id);
  CREATE INDEX IF NOT EXISTS idx_questions_passage ON questions(passage_id);
  CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id);
`);

export default db;
