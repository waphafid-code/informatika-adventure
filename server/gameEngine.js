import crypto from 'node:crypto';
import { db, withTransaction } from './db.js';
import { generateSessionCode } from './seed.js';

export const BOARD_SIZE = 100;

export const LADDERS = {
  4: 25,
  13: 46,
  33: 49,
  42: 63,
  50: 69,
  62: 81,
  74: 92,
};

export const SNAKES = {
  27: 5,
  40: 3,
  43: 18,
  54: 31,
  66: 45,
  76: 58,
  89: 53,
  99: 41,
};

export function createGameSession({ classId, teacherId }) {
  const cls = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(classId);
  if (!cls) {
    throw Object.assign(new Error('Kelas tidak ditemukan.'), { status: 404 });
  }

  const sessionId = crypto.randomUUID();
  let sessionCode = generateSessionCode();
  while (db.prepare('SELECT id FROM game_sessions WHERE session_code = ?').get(sessionCode)) {
    sessionCode = generateSessionCode();
  }

  withTransaction(() => {
    db.prepare(`
      INSERT INTO game_sessions (id, session_code, class_id, teacher_id, status)
      VALUES (?, ?, ?, ?, 'WAITING')
    `).run(sessionId, sessionCode, classId, teacherId);

    db.prepare(`
      INSERT INTO game_state (session_id, active_team, team1_pos, team2_pos, team1_xp, team2_xp, turn_number, answer_status)
      VALUES (?, 1, 1, 1, 0, 0, 0, 'IDLE')
    `).run(sessionId);
  });

  return getSessionSnapshot(sessionId, { includeSecrets: true });
}

export function assignTeamGachaAtomic(sessionId, studentId) {
  return withTransaction(() => {
    const session = db.prepare('SELECT id, status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      throw Object.assign(new Error('Sesi tidak ditemukan.'), { status: 404 });
    }

    const participant = db
      .prepare('SELECT id, is_captain FROM session_participants WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);
    if (!participant) {
      throw Object.assign(new Error('Siswa belum terdaftar dalam sesi ini.'), { status: 403 });
    }

    // 3. Check if already assigned -> return exact same result (idempotent on refresh/duplicate)
    const existing = db
      .prepare('SELECT team_number, assigned_at FROM team_assignments WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);

    if (existing) {
      return {
        teamNumber: existing.team_number,
        isCaptain: Boolean(participant.is_captain),
        alreadyAssigned: true,
      };
    }

    // Prevent team changes once game has started
    if (session.status === 'PLAYING' || session.status === 'FINISHED') {
      throw Object.assign(new Error('Permainan sudah dimulai, penempatan kelompok terkunci.'), { status: 409 });
    }

    // 6. Count members per team
    const counts = db
      .prepare(`
        SELECT
          SUM(CASE WHEN team_number = 1 THEN 1 ELSE 0 END) AS team1_count,
          SUM(CASE WHEN team_number = 2 THEN 1 ELSE 0 END) AS team2_count
        FROM team_assignments
        WHERE session_id = ?
      `)
      .get(sessionId);

    const t1 = counts?.team1_count ?? 0;
    const t2 = counts?.team2_count ?? 0;

    let chosenTeam;
    if (t1 < t2) {
      chosenTeam = 1;
    } else if (t2 < t1) {
      chosenTeam = 2;
    } else {
      chosenTeam = crypto.randomInt(1, 3); // 1 or 2
    }

    // 8. Save permanently for this session
    db.prepare(`
      INSERT INTO team_assignments (id, session_id, student_id, team_number)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), sessionId, studentId, chosenTeam);

    // Ensure the team has a captain if none yet
    const existingCaptain = db
      .prepare(`
        SELECT sp.id
        FROM session_participants sp
        JOIN team_assignments ta ON ta.session_id = sp.session_id AND ta.student_id = sp.student_id
        WHERE sp.session_id = ? AND ta.team_number = ? AND sp.is_captain = 1
      `)
      .get(sessionId, chosenTeam);

    let isCaptain = Boolean(participant.is_captain);
    if (!existingCaptain) {
      db.prepare('UPDATE session_participants SET is_captain = 1 WHERE id = ?').run(participant.id);
      isCaptain = true;
    }

    return {
      teamNumber: chosenTeam,
      isCaptain,
      alreadyAssigned: false,
    };
  });
}

export function setSessionStatus(sessionId, newStatus) {
  const validStatuses = ['WAITING', 'REGISTRATION', 'TEAM_ASSIGNMENT', 'LOBBY', 'PLAYING', 'FINISHED'];
  if (!validStatuses.includes(newStatus)) {
    throw Object.assign(new Error('Status sesi tidak valid.'), { status: 400 });
  }

  return withTransaction(() => {
    const session = db.prepare('SELECT id, status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      throw Object.assign(new Error('Sesi tidak ditemukan.'), { status: 404 });
    }

    if (newStatus === 'PLAYING') {
      const counts = db
        .prepare(`
          SELECT
            SUM(CASE WHEN team_number = 1 THEN 1 ELSE 0 END) AS t1,
            SUM(CASE WHEN team_number = 2 THEN 1 ELSE 0 END) AS t2
          FROM team_assignments WHERE session_id = ?
        `)
        .get(sessionId);

      if ((counts?.t1 ?? 0) === 0 && (counts?.t2 ?? 0) === 0) {
        throw Object.assign(new Error('Minimal ada peserta di kelompok sebelum memulai permainan.'), { status: 400 });
      }

      db.prepare(`UPDATE game_sessions SET status = 'PLAYING', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?`).run(sessionId);
      db.prepare(`
        UPDATE game_state
        SET active_team = 1,
            turn_number = CASE WHEN turn_number = 0 THEN 1 ELSE turn_number END,
            answer_status = CASE WHEN answer_status = 'IDLE' THEN 'READY_TO_ROLL' ELSE answer_status END,
            updated_at = datetime('now')
        WHERE session_id = ?
      `).run(sessionId);
    } else if (newStatus === 'FINISHED') {
      finalizeSession(sessionId);
    } else {
      db.prepare('UPDATE game_sessions SET status = ? WHERE id = ?').run(newStatus, sessionId);
    }

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function reassignTeamOrCaptain(sessionId, studentId, { teamNumber, makeCaptain }) {
  return withTransaction(() => {
    const session = db.prepare('SELECT status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session) throw Object.assign(new Error('Sesi tidak ditemukan.'), { status: 404 });
    if (session.status === 'PLAYING' || session.status === 'FINISHED') {
      throw Object.assign(new Error('Tidak dapat mengubah kelompok setelah permainan dimulai.'), { status: 409 });
    }

    const participant = db
      .prepare('SELECT id FROM session_participants WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);
    if (!participant) throw Object.assign(new Error('Peserta tidak ditemukan.'), { status: 404 });

    if (teamNumber === 1 || teamNumber === 2) {
      db.prepare(`
        INSERT INTO team_assignments (id, session_id, student_id, team_number)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id, student_id) DO UPDATE SET team_number = excluded.team_number
      `).run(crypto.randomUUID(), sessionId, studentId, teamNumber);
      // Clear captain flag if moved
      db.prepare('UPDATE session_participants SET is_captain = 0 WHERE id = ?').run(participant.id);
    }

    if (makeCaptain) {
      const assignment = db
        .prepare('SELECT team_number FROM team_assignments WHERE session_id = ? AND student_id = ?')
        .get(sessionId, studentId);
      if (!assignment) {
        throw Object.assign(new Error('Siswa belum memiliki kelompok.'), { status: 400 });
      }
      // Remove captain from other members of same team
      db.prepare(`
        UPDATE session_participants
        SET is_captain = 0
        WHERE session_id = ? AND student_id IN (
          SELECT student_id FROM team_assignments WHERE session_id = ? AND team_number = ?
        )
      `).run(sessionId, sessionId, assignment.team_number);

      db.prepare('UPDATE session_participants SET is_captain = 1 WHERE id = ?').run(participant.id);
    }

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function rollDiceAndDrawQuestion(sessionId) {
  return withTransaction(() => {
    const session = db.prepare('SELECT status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session) throw Object.assign(new Error('Sesi tidak ditemukan.'), { status: 404 });
    if (session.status !== 'PLAYING') {
      throw Object.assign(new Error('Permainan belum dimulai atau sudah selesai.'), { status: 409 });
    }

    const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
    if (state.answer_status !== 'READY_TO_ROLL') {
      throw Object.assign(new Error('Tidak dapat melempar dadu saat ini.'), { status: 409 });
    }

    const dice = crypto.randomInt(1, 7);
    const activeTeam = state.active_team;
    const fromPos = activeTeam === 1 ? state.team1_pos : state.team2_pos;
    const steppedPos = Math.min(BOARD_SIZE, fromPos + dice);

    let finalPos = steppedPos;
    let moveNote = `Tim ${activeTeam} melempar dadu ${dice} (${fromPos} → ${steppedPos})`;

    if (LADDERS[steppedPos]) {
      finalPos = LADDERS[steppedPos];
      moveNote = `Tim ${activeTeam} dadu ${dice} → Tangga! Naik ${steppedPos} → ${finalPos}`;
    } else if (SNAKES[steppedPos]) {
      finalPos = SNAKES[steppedPos];
      moveNote = `Tim ${activeTeam} dadu ${dice} → Ular! Turun ${steppedPos} → ${finalPos}`;
    }

    // Pick a question not yet used in this session if possible
    const unusedQuestions = db
      .prepare(`
        SELECT id FROM question_bank
        WHERE id NOT IN (SELECT question_id FROM game_turns WHERE session_id = ? AND question_id IS NOT NULL)
      `)
      .all(sessionId);

    const pool = unusedQuestions.length > 0
      ? unusedQuestions
      : db.prepare('SELECT id FROM question_bank').all();

    const chosenQuestion = pool[crypto.randomInt(0, pool.length)];

    const newT1Pos = activeTeam === 1 ? finalPos : state.team1_pos;
    const newT2Pos = activeTeam === 2 ? finalPos : state.team2_pos;

    db.prepare(`
      UPDATE game_state
      SET team1_pos = ?,
          team2_pos = ?,
          last_dice = ?,
          last_move_note = ?,
          current_question_id = ?,
          answer_status = 'AWAITING_ANSWER',
          proposed_answers_json = '{}',
          final_answer_team = NULL,
          final_answer_option = NULL,
          final_answer_correct = NULL,
          updated_at = datetime('now')
      WHERE session_id = ?
    `).run(newT1Pos, newT2Pos, dice, moveNote, chosenQuestion.id, sessionId);

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function proposeAnswer(sessionId, studentId, option) {
  if (!['A', 'B', 'C', 'D', 'E'].includes(option)) {
    throw Object.assign(new Error('Pilihan jawaban tidak valid.'), { status: 400 });
  }

  return withTransaction(() => {
    const session = db.prepare('SELECT status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session || session.status !== 'PLAYING') {
      throw Object.assign(new Error('Permainan tidak sedang berlangsung.'), { status: 409 });
    }

    const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
    if (state.answer_status !== 'AWAITING_ANSWER') {
      throw Object.assign(new Error('Pertanyaan belum aktif atau sudah dijawab.'), { status: 409 });
    }

    const assignment = db
      .prepare('SELECT team_number FROM team_assignments WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);
    if (!assignment || assignment.team_number !== state.active_team) {
      throw Object.assign(new Error('Bukan giliran kelompok Anda.'), { status: 403 });
    }

    const student = db.prepare('SELECT full_name FROM students WHERE id = ?').get(studentId);
    const proposals = JSON.parse(state.proposed_answers_json || '{}');
    proposals[studentId] = {
      studentId,
      fullName: student?.full_name || 'Siswa',
      option,
      proposedAt: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE game_state SET proposed_answers_json = ?, updated_at = datetime('now') WHERE session_id = ?
    `).run(JSON.stringify(proposals), sessionId);

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function submitFinalAnswerAtomic(sessionId, studentId, option) {
  if (!['A', 'B', 'C', 'D', 'E'].includes(option)) {
    throw Object.assign(new Error('Pilihan jawaban tidak valid.'), { status: 400 });
  }

  return withTransaction(() => {
    const session = db.prepare('SELECT status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session || session.status !== 'PLAYING') {
      throw Object.assign(new Error('Permainan tidak sedang berlangsung.'), { status: 409 });
    }

    const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
    if (state.answer_status !== 'AWAITING_ANSWER') {
      throw Object.assign(new Error('Jawaban sudah dikirim atau pertanyaan belum aktif.'), { status: 409 });
    }

    const participant = db
      .prepare('SELECT is_captain FROM session_participants WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);
    const assignment = db
      .prepare('SELECT team_number FROM team_assignments WHERE session_id = ? AND student_id = ?')
      .get(sessionId, studentId);

    if (!assignment || assignment.team_number !== state.active_team) {
      throw Object.assign(new Error('Dilarang: bukan giliran kelompok Anda.'), { status: 403 });
    }
    if (!participant || !participant.is_captain) {
      throw Object.assign(new Error('Hanya Kapten kelompok yang dapat mengirim jawaban final.'), { status: 403 });
    }

    const question = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(state.current_question_id);
    if (!question) {
      throw Object.assign(new Error('Pertanyaan tidak ditemukan.'), { status: 404 });
    }

    const isCorrect = option === question.correct_option;
    const xpDelta = isCorrect ? question.xp_reward : 0;
    const newT1Xp = state.active_team === 1 ? state.team1_xp + xpDelta : state.team1_xp;
    const newT2Xp = state.active_team === 2 ? state.team2_xp + xpDelta : state.team2_xp;

    const activePos = state.active_team === 1 ? state.team1_pos : state.team2_pos;
    const reachedFinish = activePos >= BOARD_SIZE;

    db.prepare(`
      INSERT INTO game_turns (
        id, session_id, turn_number, team_number, dice_result, from_pos, to_pos,
        ladder_or_snake_to, question_id, submitted_by_student_id, selected_option, is_correct, xp_delta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      sessionId,
      state.turn_number,
      state.active_team,
      state.last_dice || 0,
      activePos,
      activePos,
      null,
      question.id,
      studentId,
      option,
      isCorrect ? 1 : 0,
      xpDelta
    );

    if (reachedFinish) {
      db.prepare(`
        UPDATE game_state
        SET team1_xp = ?,
            team2_xp = ?,
            answer_status = 'FINISHED',
            final_answer_team = ?,
            final_answer_option = ?,
            final_answer_correct = ?,
            winner_team = ?,
            updated_at = datetime('now')
        WHERE session_id = ?
      `).run(newT1Xp, newT2Xp, state.active_team, option, isCorrect ? 1 : 0, state.active_team, sessionId);

      finalizeSession(sessionId, state.active_team);
    } else {
      db.prepare(`
        UPDATE game_state
        SET team1_xp = ?,
            team2_xp = ?,
            answer_status = 'ANSWERED',
            final_answer_team = ?,
            final_answer_option = ?,
            final_answer_correct = ?,
            updated_at = datetime('now')
        WHERE session_id = ?
      `).run(newT1Xp, newT2Xp, state.active_team, option, isCorrect ? 1 : 0, sessionId);
    }

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function advanceToNextTurn(sessionId) {
  return withTransaction(() => {
    const session = db.prepare('SELECT status FROM game_sessions WHERE id = ?').get(sessionId);
    if (!session || session.status !== 'PLAYING') {
      throw Object.assign(new Error('Permainan tidak sedang berlangsung.'), { status: 409 });
    }

    const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
    if (state.answer_status !== 'ANSWERED') {
      throw Object.assign(new Error('Selesaikan giliran saat ini sebelum berpindah giliran.'), { status: 409 });
    }

    const nextTeam = state.active_team === 1 ? 2 : 1;
    db.prepare(`
      UPDATE game_state
      SET active_team = ?,
          turn_number = turn_number + 1,
          last_dice = NULL,
          last_move_note = NULL,
          current_question_id = NULL,
          answer_status = 'READY_TO_ROLL',
          proposed_answers_json = '{}',
          final_answer_team = NULL,
          final_answer_option = NULL,
          final_answer_correct = NULL,
          updated_at = datetime('now')
      WHERE session_id = ?
    `).run(nextTeam, sessionId);

    return getSessionSnapshot(sessionId, { includeSecrets: true });
  });
}

export function finalizeSession(sessionId, explicitWinner = null) {
  const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
  if (!state) return;

  let winner = explicitWinner;
  if (winner == null) {
    if (state.team1_pos > state.team2_pos) winner = 1;
    else if (state.team2_pos > state.team1_pos) winner = 2;
    else if (state.team1_xp > state.team2_xp) winner = 1;
    else if (state.team2_xp > state.team1_xp) winner = 2;
    else winner = 0; // draw
  }

  db.prepare(`
    UPDATE game_sessions SET status = 'FINISHED', finished_at = COALESCE(finished_at, datetime('now')) WHERE id = ?
  `).run(sessionId);

  db.prepare(`
    UPDATE game_state SET answer_status = 'FINISHED', winner_team = ?, updated_at = datetime('now') WHERE session_id = ?
  `).run(winner, sessionId);

  db.prepare(`
    INSERT INTO game_results (id, session_id, winner_team, team1_final_pos, team2_final_pos, team1_xp, team2_xp, total_turns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      winner_team = excluded.winner_team,
      team1_final_pos = excluded.team1_final_pos,
      team2_final_pos = excluded.team2_final_pos,
      team1_xp = excluded.team1_xp,
      team2_xp = excluded.team2_xp,
      total_turns = excluded.total_turns,
      finished_at = datetime('now')
  `).run(
    crypto.randomUUID(),
    sessionId,
    winner,
    state.team1_pos,
    state.team2_pos,
    state.team1_xp,
    state.team2_xp,
    state.turn_number
  );
}

export function getSessionSnapshot(sessionId, { includeSecrets = false } = {}) {
  const session = db
    .prepare(`
      SELECT gs.*, c.name AS class_name, ta.display_name AS teacher_name
      FROM game_sessions gs
      JOIN classes c ON c.id = gs.class_id
      JOIN teacher_accounts ta ON ta.id = gs.teacher_id
      WHERE gs.id = ?
    `)
    .get(sessionId);

  if (!session) return null;

  const participants = db
    .prepare(`
      SELECT sp.id AS participant_id, sp.student_id, sp.is_captain, sp.is_connected, sp.joined_at,
             s.full_name, s.nisn, ta.team_number
      FROM session_participants sp
      JOIN students s ON s.id = sp.student_id
      LEFT JOIN team_assignments ta ON ta.session_id = sp.session_id AND ta.student_id = sp.student_id
      WHERE sp.session_id = ?
      ORDER BY sp.joined_at ASC
    `)
    .all(sessionId)
    .map((p) => ({
      ...p,
      is_captain: Boolean(p.is_captain),
      is_connected: Boolean(p.is_connected),
    }));

  const state = db.prepare('SELECT * FROM game_state WHERE session_id = ?').get(sessionId);
  let currentQuestion = null;
  if (state?.current_question_id) {
    const q = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(state.current_question_id);
    if (q) {
      const revealAnswer = includeSecrets || state.answer_status === 'ANSWERED' || state.answer_status === 'FINISHED';
      currentQuestion = {
        id: q.id,
        topic: q.topic,
        difficulty: q.difficulty,
        question_text: q.question_text,
        options: JSON.parse(q.options_json),
        xp_reward: q.xp_reward,
        ...(revealAnswer ? { correct_option: q.correct_option, explanation: q.explanation } : {}),
      };
    }
  }

  const turns = db
    .prepare(`
      SELECT gt.*, s.full_name AS submitted_by_name
      FROM game_turns gt
      LEFT JOIN students s ON s.id = gt.submitted_by_student_id
      WHERE gt.session_id = ?
      ORDER BY gt.turn_number DESC, gt.created_at DESC
      LIMIT 20
    `)
    .all(sessionId);

  const result = db.prepare('SELECT * FROM game_results WHERE session_id = ?').get(sessionId) || null;

  const team1Members = participants.filter((p) => p.team_number === 1);
  const team2Members = participants.filter((p) => p.team_number === 2);
  const unassignedMembers = participants.filter((p) => p.team_number == null);

  return {
    session,
    teams: {
      team1: team1Members,
      team2: team2Members,
      unassigned: unassignedMembers,
      team1Count: team1Members.length,
      team2Count: team2Members.length,
    },
    participants,
    gameState: state
      ? {
        ...state,
        proposed_answers: JSON.parse(state.proposed_answers_json || '{}'),
        final_answer_correct: state.final_answer_correct == null ? null : Boolean(state.final_answer_correct),
      }
      : null,
    currentQuestion,
    turns,
    result,
    board: {
      size: BOARD_SIZE,
      ladders: LADDERS,
      snakes: SNAKES,
    },
  };
}
