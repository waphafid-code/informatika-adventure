export type SessionStatus =
  | 'WAITING'
  | 'REGISTRATION'
  | 'TEAM_ASSIGNMENT'
  | 'LOBBY'
  | 'PLAYING'
  | 'FINISHED';

export type AnswerStatus = 'IDLE' | 'READY_TO_ROLL' | 'AWAITING_ANSWER' | 'ANSWERED' | 'FINISHED';

export interface ClassItem {
  id: string;
  name: string;
  grade: string;
  is_unlocked?: boolean;
  active_session_id?: string | null;
  active_session_code?: string | null;
  active_status?: SessionStatus | null;
  participant_count?: number;
}

export interface StudentItem {
  id: string;
  class_id: string;
  full_name: string;
  nisn: string;
}

export interface Participant {
  participant_id: string;
  student_id: string;
  is_captain: boolean;
  is_connected: boolean;
  joined_at: string;
  full_name: string;
  nisn: string;
  team_number: 1 | 2 | null;
}

export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ProposedAnswer {
  studentId: string;
  fullName: string;
  option: OptionKey;
  proposedAt: string;
}

export interface Question {
  id: string;
  topic: string;
  difficulty: string;
  question_text: string;
  options: Record<string, string>;
  xp_reward: number;
  correct_option?: OptionKey;
  explanation?: string;
}

export interface GameState {
  session_id: string;
  active_team: 1 | 2;
  team1_pos: number;
  team2_pos: number;
  team1_xp: number;
  team2_xp: number;
  turn_number: number;
  last_dice: number | null;
  last_move_note: string | null;
  current_question_id: string | null;
  answer_status: AnswerStatus;
  proposed_answers: Record<string, ProposedAnswer>;
  final_answer_team: 1 | 2 | null;
  final_answer_option: OptionKey | null;
  final_answer_correct: boolean | null;
  winner_team: 0 | 1 | 2 | null;
  updated_at: string;
}

export interface GameTurn {
  id: string;
  turn_number: number;
  team_number: 1 | 2;
  dice_result: number;
  from_pos: number;
  to_pos: number;
  selected_option: string | null;
  is_correct: number | null;
  xp_delta: number;
  submitted_by_name?: string;
}

export interface GameResult {
  id: string;
  session_id: string;
  winner_team: 0 | 1 | 2;
  team1_final_pos: number;
  team2_final_pos: number;
  team1_xp: number;
  team2_xp: number;
  total_turns: number;
  finished_at: string;
}

export interface SessionSnapshot {
  session: {
    id: string;
    session_code: string;
    class_id: string;
    class_name: string;
    teacher_id: string;
    teacher_name: string;
    status: SessionStatus;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
  };
  teams: {
    team1: Participant[];
    team2: Participant[];
    unassigned: Participant[];
    team1Count: number;
    team2Count: number;
  };
  participants: Participant[];
  gameState: GameState | null;
  currentQuestion: Question | null;
  turns: GameTurn[];
  result: GameResult | null;
  board: {
    size: number;
    ladders: Record<number, number>;
    snakes: Record<number, number>;
  };
}
