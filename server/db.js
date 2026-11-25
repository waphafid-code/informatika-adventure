import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'informatika.db');
if (process.env.RESET_DB_ON_START === '1') {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) {
      fs.unlinkSync(dbPath + suffix);
    }
  }
}
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      grade TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      nisn TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, full_name)
    );

    CREATE TABLE IF NOT EXISTS teacher_accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teacher_webauthn_credentials (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL DEFAULT 'Perangkat Guru',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL UNIQUE,
      class_id TEXT NOT NULL REFERENCES classes(id),
      teacher_id TEXT NOT NULL REFERENCES teacher_accounts(id),
      status TEXT NOT NULL CHECK (status IN ('WAITING','REGISTRATION','TEAM_ASSIGNMENT','LOBBY','PLAYING','FINISHED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      participant_token TEXT NOT NULL UNIQUE,
      is_captain INTEGER NOT NULL DEFAULT 0,
      is_connected INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS team_assignments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      team_number INTEGER NOT NULL CHECK (team_number IN (1, 2)),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      xp_reward INTEGER NOT NULL DEFAULT 20,
      explanation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_state (
      session_id TEXT PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
      active_team INTEGER NOT NULL DEFAULT 1 CHECK (active_team IN (1, 2)),
      team1_pos INTEGER NOT NULL DEFAULT 1,
      team2_pos INTEGER NOT NULL DEFAULT 1,
      team1_xp INTEGER NOT NULL DEFAULT 0,
      team2_xp INTEGER NOT NULL DEFAULT 0,
      turn_number INTEGER NOT NULL DEFAULT 0,
      last_dice INTEGER,
      last_move_note TEXT,
      current_question_id TEXT REFERENCES question_bank(id),
      answer_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (answer_status IN ('IDLE','READY_TO_ROLL','AWAITING_ANSWER','ANSWERED','FINISHED')),
      proposed_answers_json TEXT NOT NULL DEFAULT '{}',
      final_answer_team INTEGER,
      final_answer_option TEXT,
      final_answer_correct INTEGER,
      winner_team INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      turn_number INTEGER NOT NULL,
      team_number INTEGER NOT NULL CHECK (team_number IN (1, 2)),
      dice_result INTEGER NOT NULL,
      from_pos INTEGER NOT NULL,
      to_pos INTEGER NOT NULL,
      ladder_or_snake_to INTEGER,
      question_id TEXT REFERENCES question_bank(id),
      submitted_by_student_id TEXT REFERENCES students(id),
      selected_option TEXT,
      is_correct INTEGER,
      xp_delta INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
      winner_team INTEGER NOT NULL CHECK (winner_team IN (0, 1, 2)),
      team1_final_pos INTEGER NOT NULL,
      team2_final_pos INTEGER NOT NULL,
      team1_xp INTEGER NOT NULL,
      team2_xp INTEGER NOT NULL,
      total_turns INTEGER NOT NULL,
      finished_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Execute a callback inside an IMMEDIATE SQLite transaction for atomic concurrency control.
 */
export function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}
