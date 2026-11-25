-- ============================================================================
-- INFORMATIKA ADVENTURE — SUPABASE POSTGRESQL SCHEMA, RLS & ATOMIC RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  grade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nisn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, full_name)
);

-- 3. Teacher Accounts (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS teacher_accounts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Game Sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code CHAR(6) NOT NULL UNIQUE,
  class_id UUID NOT NULL REFERENCES classes(id),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  status TEXT NOT NULL CHECK (status IN ('WAITING','REGISTRATION','TEAM_ASSIGNMENT','LOBBY','PLAYING','FINISHED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- 5. Session Participants
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 6. Team Assignments
CREATE TABLE IF NOT EXISTS team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  team_number SMALLINT NOT NULL CHECK (team_number IN (1, 2)),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 7. Question Bank
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json JSONB NOT NULL,
  correct_option CHAR(1) NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 20,
  explanation TEXT NOT NULL
);

-- 8. Game State
CREATE TABLE IF NOT EXISTS game_state (
  session_id UUID PRIMARY KEY REFERENCES game_sessions(id) ON DELETE CASCADE,
  active_team SMALLINT NOT NULL DEFAULT 1 CHECK (active_team IN (1, 2)),
  team1_pos INTEGER NOT NULL DEFAULT 1,
  team2_pos INTEGER NOT NULL DEFAULT 1,
  team1_xp INTEGER NOT NULL DEFAULT 0,
  team2_xp INTEGER NOT NULL DEFAULT 0,
  turn_number INTEGER NOT NULL DEFAULT 0,
  last_dice SMALLINT,
  last_move_note TEXT,
  current_question_id UUID REFERENCES question_bank(id),
  answer_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (answer_status IN ('IDLE','READY_TO_ROLL','AWAITING_ANSWER','ANSWERED','FINISHED')),
  proposed_answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_answer_team SMALLINT,
  final_answer_option CHAR(1),
  final_answer_correct BOOLEAN,
  winner_team SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Game Turns
CREATE TABLE IF NOT EXISTS game_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  team_number SMALLINT NOT NULL CHECK (team_number IN (1, 2)),
  dice_result SMALLINT NOT NULL,
  from_pos INTEGER NOT NULL,
  to_pos INTEGER NOT NULL,
  ladder_or_snake_to INTEGER,
  question_id UUID REFERENCES question_bank(id),
  submitted_by_student_id UUID REFERENCES students(id),
  selected_option CHAR(1),
  is_correct BOOLEAN,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Game Results
CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE CASCADE,
  winner_team SMALLINT NOT NULL CHECK (winner_team IN (0, 1, 2)),
  team1_final_pos INTEGER NOT NULL,
  team2_final_pos INTEGER NOT NULL,
  team1_xp INTEGER NOT NULL,
  team2_xp INTEGER NOT NULL,
  total_turns INTEGER NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ATOMIC SERVER-SIDE GACHA RPC (PostgreSQL Advisory Lock / Row Lock)
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_team_gacha(p_session_id UUID, p_student_id UUID)
RETURNS TABLE (team_number SMALLINT, is_captain BOOLEAN, already_assigned BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
  v_existing SMALLINT;
  v_t1 INTEGER;
  v_t2 INTEGER;
  v_chosen SMALLINT;
  v_has_captain BOOLEAN;
  v_is_captain BOOLEAN := false;
BEGIN
  -- Serialize Gacha per session to guarantee balanced teams under concurrent load
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  SELECT status INTO v_status FROM game_sessions WHERE id = p_session_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT ta.team_number INTO v_existing
  FROM team_assignments ta
  WHERE ta.session_id = p_session_id AND ta.student_id = p_student_id;

  IF v_existing IS NOT NULL THEN
    SELECT sp.is_captain INTO v_is_captain
    FROM session_participants sp
    WHERE sp.session_id = p_session_id AND sp.student_id = p_student_id;
    RETURN QUERY SELECT v_existing, COALESCE(v_is_captain, false), true;
    RETURN;
  END IF;

  IF v_status IN ('PLAYING', 'FINISHED') THEN
    RAISE EXCEPTION 'Team assignment is locked after game starts';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE ta.team_number = 1),
    COUNT(*) FILTER (WHERE ta.team_number = 2)
  INTO v_t1, v_t2
  FROM team_assignments ta
  WHERE ta.session_id = p_session_id;

  IF v_t1 < v_t2 THEN
    v_chosen := 1;
  ELSIF v_t2 < v_t1 THEN
    v_chosen := 2;
  ELSE
    v_chosen := CASE WHEN random() < 0.5 THEN 1 ELSE 2 END;
  END IF;

  INSERT INTO team_assignments (session_id, student_id, team_number)
  VALUES (p_session_id, p_student_id, v_chosen);

  SELECT EXISTS (
    SELECT 1
    FROM session_participants sp
    JOIN team_assignments ta ON ta.session_id = sp.session_id AND ta.student_id = sp.student_id
    WHERE sp.session_id = p_session_id AND ta.team_number = v_chosen AND sp.is_captain = true
  ) INTO v_has_captain;

  IF NOT v_has_captain THEN
    UPDATE session_participants
    SET is_captain = true
    WHERE session_id = p_session_id AND student_id = p_student_id;
    v_is_captain := true;
  END IF;

  RETURN QUERY SELECT v_chosen, v_is_captain, false;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Teachers manage their own sessions
CREATE POLICY teacher_manage_sessions ON game_sessions
  FOR ALL USING (auth.uid() = teacher_id);

-- Students can only read the session matching their JWT claim session_id
CREATE POLICY student_read_own_session ON game_sessions
  FOR SELECT USING (id::text = current_setting('request.jwt.claims', true)::jsonb->>'session_id');

CREATE POLICY student_read_own_state ON game_state
  FOR SELECT USING (session_id::text = current_setting('request.jwt.claims', true)::jsonb->>'session_id');

CREATE POLICY student_read_own_teams ON team_assignments
  FOR SELECT USING (session_id::text = current_setting('request.jwt.claims', true)::jsonb->>'session_id');

-- Enable Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions, session_participants, team_assignments, game_state, game_results;
