import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import QRCode from 'qrcode';
import { db, initSchema, withTransaction } from './db.js';
import { seedDatabase } from './seed.js';
import {
  verifyPassword,
  createTeacherToken,
  createParticipantToken,
  verifyToken,
  requireTeacher,
  requireParticipant,
} from './auth.js';
import {
  createGameSession,
  assignTeamGachaAtomic,
  setSessionStatus,
  reassignTeamOrCaptain,
  rollDiceAndDrawQuestion,
  proposeAnswer,
  submitFinalAnswerAtomic,
  advanceToNextTurn,
  getSessionSnapshot,
} from './gameEngine.js';

initSchema();
seedDatabase();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

function broadcastSession(sessionId) {
  const teacherSnap = getSessionSnapshot(sessionId, { includeSecrets: true });
  const studentSnap = getSessionSnapshot(sessionId, { includeSecrets: false });
  if (teacherSnap) {
    io.to(`teacher:${sessionId}`).emit('session:update', teacherSnap);
  }
  if (studentSnap) {
    io.to(`student:${sessionId}`).emit('session:update', studentSnap);
  }
}

// ==========================================
// PUBLIC / DISCOVERY ENDPOINTS
// ==========================================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

function getClassesWithStatus() {
  return db
    .prepare(`
      SELECT c.id, c.name, c.grade,
             gs.id AS active_session_id,
             gs.session_code AS active_session_code,
             gs.status AS active_status,
             (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = gs.id) AS participant_count
      FROM classes c
      LEFT JOIN game_sessions gs ON gs.id = (
        SELECT id FROM game_sessions
        WHERE class_id = c.id AND status != 'FINISHED'
        ORDER BY created_at DESC
        LIMIT 1
      )
      ORDER BY c.name ASC
    `)
    .all()
    .map((c) => ({
      ...c,
      is_unlocked: c.active_status === 'REGISTRATION',
      participant_count: c.participant_count ?? 0,
    }));
}

app.get('/api/classes', (_req, res) => {
  res.json({ classes: getClassesWithStatus() });
});

app.get('/api/classes/:classId/students', (req, res) => {
  const students = db
    .prepare('SELECT id, class_id, full_name, nisn FROM students WHERE class_id = ? ORDER BY full_name ASC')
    .all(req.params.classId);
  res.json({ students });
});

app.get('/api/sessions/lookup/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const session = db
    .prepare(`
      SELECT gs.id, gs.session_code, gs.class_id, gs.status, gs.created_at, c.name AS class_name
      FROM game_sessions gs
      JOIN classes c ON c.id = gs.class_id
      WHERE gs.session_code = ?
    `)
    .get(code);

  if (!session) {
    return res.status(404).json({ error: 'Kode sesi tidak ditemukan.' });
  }
  res.json({ session });
});

// ==========================================
// TEACHER AUTH & CONTROL ENDPOINTS
// ==========================================

// ==========================================
// TEACHER AUTH (PIN & WEBAUTHN BIOMETRIC)
// ==========================================

const TEACHER_PIN = process.env.TEACHER_PIN || '020305';

app.post('/api/teacher/pin-login', (req, res) => {
  const inputPin = String(req.body?.pin || '').trim();
  const a = Buffer.from(inputPin);
  const b = Buffer.from(TEACHER_PIN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'PIN Guru salah.' });
  }

  const teacher = db.prepare('SELECT id, username, display_name FROM teacher_accounts WHERE username = ?').get('guru');
  if (!teacher) {
    return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
  }

  const token = createTeacherToken(teacher);
  res.json({
    token,
    teacher: { id: teacher.id, username: teacher.username, displayName: teacher.display_name },
  });
});

app.get('/api/teacher/webauthn/status', (_req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM teacher_webauthn_credentials').get();
  res.json({ hasRegisteredBiometric: (row?.cnt ?? 0) > 0 });
});

app.post('/api/teacher/webauthn/register', requireTeacher, (req, res) => {
  const credentialId = String(req.body?.credentialId || '').trim();
  if (!credentialId) {
    return res.status(400).json({ error: 'Credential ID sidik jari tidak valid.' });
  }
  db.prepare(`
    INSERT INTO teacher_webauthn_credentials (id, teacher_id, credential_id)
    VALUES (?, ?, ?)
    ON CONFLICT(credential_id) DO NOTHING
  `).run(crypto.randomUUID(), req.teacher.teacherId, credentialId);
  res.json({ ok: true });
});

app.post('/api/teacher/webauthn/login', (req, res) => {
  const credentialId = String(req.body?.credentialId || '').trim();
  if (!credentialId) {
    return res.status(400).json({ error: 'Credential sidik jari tidak ditemukan.' });
  }
  const cred = db
    .prepare(`
      SELECT ta.id, ta.username, ta.display_name
      FROM teacher_webauthn_credentials twc
      JOIN teacher_accounts ta ON ta.id = twc.teacher_id
      WHERE twc.credential_id = ?
    `)
    .get(credentialId);

  if (!cred) {
    return res.status(401).json({ error: 'Sidik jari belum terdaftar. Masuk menggunakan PIN terlebih dahulu.' });
  }

  const token = createTeacherToken(cred);
  res.json({
    token,
    teacher: { id: cred.id, username: cred.username, displayName: cred.display_name },
  });
});

app.post('/api/teacher/login', (req, res) => {
  const { username, password } = req.body || {};
  const teacher = db
    .prepare('SELECT id, username, password_hash, display_name FROM teacher_accounts WHERE username = ?')
    .get(String(username || '').trim());

  if (!teacher || !verifyPassword(String(password || ''), teacher.password_hash)) {
    return res.status(401).json({ error: 'Username atau password guru salah.' });
  }

  const token = createTeacherToken(teacher);
  res.json({
    token,
    teacher: { id: teacher.id, username: teacher.username, displayName: teacher.display_name },
  });
});

app.get('/api/teacher/sessions', requireTeacher, (req, res) => {
  const sessions = db
    .prepare(`
      SELECT gs.*, c.name AS class_name,
             (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = gs.id) AS participant_count,
             gr.winner_team, gr.team1_final_pos, gr.team2_final_pos, gr.team1_xp, gr.team2_xp, gr.total_turns
      FROM game_sessions gs
      JOIN classes c ON c.id = gs.class_id
      LEFT JOIN game_results gr ON gr.session_id = gs.id
      WHERE gs.teacher_id = ?
      ORDER BY gs.created_at DESC
      LIMIT 30
    `)
    .all(req.teacher.teacherId);
  res.json({ sessions });
});

app.post('/api/teacher/students', requireTeacher, (req, res) => {
  const { classId, fullName, nisn } = req.body || {};
  if (!classId || !fullName || !String(fullName).trim()) {
    return res.status(400).json({ error: 'Kelas dan nama lengkap siswa wajib diisi.' });
  }
  const id = `stu-${crypto.randomUUID().slice(0, 8)}`;
  try {
    db.prepare('INSERT INTO students (id, class_id, full_name, nisn) VALUES (?, ?, ?, ?)').run(
      id,
      classId,
      String(fullName).trim(),
      String(nisn || '').trim() || null
    );
    const student = db.prepare('SELECT id, class_id, full_name, nisn FROM students WHERE id = ?').get(id);
    res.status(201).json({ student });
  } catch (err) {
    res.status(409).json({ error: 'Siswa dengan nama tersebut sudah ada di kelas ini.' });
  }
});

app.post('/api/teacher/classes/:classId/toggle-lock', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const cls = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(classId);
    if (!cls) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });

    const activeSession = db
      .prepare(`SELECT * FROM game_sessions WHERE class_id = ? AND status != 'FINISHED' ORDER BY created_at DESC LIMIT 1`)
      .get(classId);

    let sessionId;
    if (!activeSession) {
      // Create a new session and unlock it immediately
      const created = createGameSession({ classId, teacherId: req.teacher.teacherId });
      sessionId = created.session.id;
      setSessionStatus(sessionId, 'REGISTRATION');
    } else if (activeSession.status === 'REGISTRATION') {
      // Lock it
      const count = db
        .prepare('SELECT COUNT(*) AS cnt FROM session_participants WHERE session_id = ?')
        .get(activeSession.id)?.cnt ?? 0;
      sessionId = activeSession.id;
      setSessionStatus(sessionId, count > 0 ? 'LOBBY' : 'WAITING');
    } else if (activeSession.status === 'PLAYING') {
      return res.status(409).json({ error: 'Permainan sedang berlangsung, akhiri dulu sebelum mengubah kunci kelas.' });
    } else {
      // Unlock existing WAITING / LOBBY / TEAM_ASSIGNMENT session
      sessionId = activeSession.id;
      setSessionStatus(sessionId, 'REGISTRATION');
    }

    broadcastSession(sessionId);
    const snapshot = getSessionSnapshot(sessionId, { includeSecrets: true });
    const origin = req.body?.baseUrl || `${req.protocol}://${req.get('host')}`;
    const joinUrl = `${origin}/join?code=${snapshot.session.session_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });

    res.json({ classes: getClassesWithStatus(), snapshot, joinUrl, qrDataUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/teacher/sessions', requireTeacher, async (req, res) => {
  try {
    const { classId, baseUrl } = req.body || {};
    const snapshot = createGameSession({ classId, teacherId: req.teacher.teacherId });
    const origin = baseUrl || `${req.protocol}://${req.get('host')}`;
    const joinUrl = `${origin}/join?code=${snapshot.session.session_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
    res.status(201).json({ snapshot, joinUrl, qrDataUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/teacher/sessions/:sessionId', requireTeacher, async (req, res) => {
  const snapshot = getSessionSnapshot(req.params.sessionId, { includeSecrets: true });
  if (!snapshot) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const origin = req.query.baseUrl || `${req.protocol}://${req.get('host')}`;
  const joinUrl = `${origin}/join?code=${snapshot.session.session_code}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
  res.json({ snapshot, joinUrl, qrDataUrl });
});

app.post('/api/teacher/sessions/:sessionId/status', requireTeacher, (req, res) => {
  try {
    const snapshot = setSessionStatus(req.params.sessionId, req.body?.status);
    broadcastSession(req.params.sessionId);
    res.json({ snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/teacher/sessions/:sessionId/reassign', requireTeacher, (req, res) => {
  try {
    const { studentId, teamNumber, makeCaptain } = req.body || {};
    const snapshot = reassignTeamOrCaptain(req.params.sessionId, studentId, { teamNumber, makeCaptain });
    broadcastSession(req.params.sessionId);
    res.json({ snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/teacher/sessions/:sessionId/roll-dice', requireTeacher, (req, res) => {
  try {
    const snapshot = rollDiceAndDrawQuestion(req.params.sessionId);
    broadcastSession(req.params.sessionId);
    res.json({ snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/teacher/sessions/:sessionId/next-turn', requireTeacher, (req, res) => {
  try {
    const snapshot = advanceToNextTurn(req.params.sessionId);
    broadcastSession(req.params.sessionId);
    res.json({ snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ==========================================
// DEMO MODE ENDPOINTS (TEACHER SOLO TESTING)
// ==========================================

app.post('/api/teacher/demo/seed', requireTeacher, async (req, res) => {
  try {
    const classId = req.body?.classId || 'cls-xi-f8';
    const created = createGameSession({ classId, teacherId: req.teacher.teacherId });
    const sessionId = created.session.id;

    const demoStudents = db
      .prepare('SELECT id FROM students WHERE class_id = ? ORDER BY full_name ASC LIMIT 6')
      .all(classId);

    withTransaction(() => {
      db.prepare(`UPDATE game_sessions SET status = 'LOBBY' WHERE id = ?`).run(sessionId);
      demoStudents.forEach((stu, idx) => {
        const participantId = crypto.randomUUID();
        const token = createParticipantToken(sessionId, stu.id, participantId);
        const teamNum = idx % 2 === 0 ? 1 : 2;
        const isCap = idx < 2 ? 1 : 0;
        db.prepare(`
          INSERT INTO session_participants (id, session_id, student_id, participant_token, is_captain, is_connected)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(participantId, sessionId, stu.id, token, isCap);
        db.prepare(`
          INSERT INTO team_assignments (id, session_id, student_id, team_number)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), sessionId, stu.id, teamNum);
      });
    });

    broadcastSession(sessionId);
    const snapshot = getSessionSnapshot(sessionId, { includeSecrets: true });
    const origin = req.body?.baseUrl || `${req.protocol}://${req.get('host')}`;
    const joinUrl = `${origin}/join?code=${snapshot.session.session_code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });

    res.json({ classes: getClassesWithStatus(), snapshot, joinUrl, qrDataUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/teacher/sessions/:sessionId/demo-answer', requireTeacher, (req, res) => {
  try {
    const { sessionId } = req.params;
    const state = db.prepare('SELECT active_team, current_question_id FROM game_state WHERE session_id = ?').get(sessionId);
    if (!state) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

    const captain = db
      .prepare(`
        SELECT sp.student_id
        FROM session_participants sp
        JOIN team_assignments ta ON ta.session_id = sp.session_id AND ta.student_id = sp.student_id
        WHERE sp.session_id = ? AND ta.team_number = ? AND sp.is_captain = 1
        LIMIT 1
      `)
      .get(sessionId, state.active_team);

    if (!captain) {
      return res.status(400).json({ error: 'Kapten tim aktif tidak ditemukan.' });
    }

    let chosenOption = req.body?.option;
    if (!chosenOption && state.current_question_id) {
      const q = db.prepare('SELECT options_json FROM question_bank WHERE id = ?').get(state.current_question_id);
      const keys = q ? Object.keys(JSON.parse(q.options_json)) : ['A'];
      chosenOption = keys[crypto.randomInt(0, keys.length)];
    }

    submitFinalAnswerAtomic(sessionId, captain.student_id, chosenOption);
    broadcastSession(sessionId);
    const snapshot = getSessionSnapshot(sessionId, { includeSecrets: true });
    res.json({ snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ==========================================
// STUDENT JOIN, GACHA & PLAY ENDPOINTS
// ==========================================

app.post('/api/sessions/join', (req, res) => {
  try {
    const { sessionCode, classId, studentId } = req.body || {};
    const code = String(sessionCode || '').trim().toUpperCase();

    const result = withTransaction(() => {
      let session;
      if (code) {
        session = db.prepare('SELECT * FROM game_sessions WHERE session_code = ?').get(code);
      } else if (classId) {
        session = db
          .prepare(`SELECT * FROM game_sessions WHERE class_id = ? AND status != 'FINISHED' ORDER BY created_at DESC LIMIT 1`)
          .get(classId);
      }

      if (!session) {
        throw Object.assign(new Error('Kelas ini belum dibuka oleh Guru.'), { status: 404 });
      }
      if (session.status === 'WAITING' || session.status === 'LOBBY' || session.status === 'TEAM_ASSIGNMENT') {
        if (session.status !== 'REGISTRATION') {
          throw Object.assign(new Error('Kelas ini sedang dikunci oleh Guru.'), { status: 409 });
        }
      }
      if (session.status === 'PLAYING' || session.status === 'FINISHED') {
        throw Object.assign(new Error('Pendaftaran sudah ditutup karena permainan sedang/sudah berjalan.'), { status: 409 });
      }
      if (classId && session.class_id !== classId) {
        throw Object.assign(new Error('Kelas yang dipilih tidak sesuai dengan kelas sesi ini.'), { status: 400 });
      }

      const student = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?').get(studentId, session.class_id);
      if (!student) {
        throw Object.assign(new Error('Identitas siswa tidak ditemukan pada kelas sesi ini.'), { status: 404 });
      }

      const existing = db
        .prepare('SELECT id FROM session_participants WHERE session_id = ? AND student_id = ?')
        .get(session.id, student.id);
      if (existing) {
        throw Object.assign(new Error('Siswa ini sudah bergabung ke sesi. Satu identitas hanya boleh bergabung satu kali.'), { status: 409 });
      }

      const participantId = crypto.randomUUID();
      const token = createParticipantToken(session.id, student.id, participantId);

      db.prepare(`
        INSERT INTO session_participants (id, session_id, student_id, participant_token, is_captain, is_connected)
        VALUES (?, ?, ?, ?, 0, 1)
      `).run(participantId, session.id, student.id, token);

      return {
        token,
        sessionId: session.id,
        student: { id: student.id, fullName: student.full_name, nisn: student.nisn, classId: student.class_id },
      };
    });

    broadcastSession(result.sessionId);
    const snapshot = getSessionSnapshot(result.sessionId, { includeSecrets: false });
    res.status(201).json({ ...result, snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/sessions/:sessionId/me', requireParticipant, (req, res) => {
  const { sessionId, studentId } = req.participant;
  const student = db.prepare('SELECT id, class_id, full_name, nisn FROM students WHERE id = ?').get(studentId);
  const participant = db
    .prepare('SELECT id, is_captain, is_connected FROM session_participants WHERE session_id = ? AND student_id = ?')
    .get(sessionId, studentId);
  const assignment = db
    .prepare('SELECT team_number FROM team_assignments WHERE session_id = ? AND student_id = ?')
    .get(sessionId, studentId);

  const snapshot = getSessionSnapshot(sessionId, { includeSecrets: false });
  if (!snapshot || !participant) {
    return res.status(404).json({ error: 'Sesi atau peserta tidak ditemukan.' });
  }

  res.json({
    student: { id: student.id, fullName: student.full_name, nisn: student.nisn, classId: student.class_id },
    teamNumber: assignment?.team_number ?? null,
    isCaptain: Boolean(participant.is_captain),
    snapshot,
  });
});

app.post('/api/sessions/:sessionId/gacha', requireParticipant, (req, res) => {
  try {
    const { sessionId, studentId } = req.participant;
    const gachaResult = assignTeamGachaAtomic(sessionId, studentId);
    broadcastSession(sessionId);
    const snapshot = getSessionSnapshot(sessionId, { includeSecrets: false });
    res.json({ ...gachaResult, snapshot });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/sessions/:sessionId/propose-answer', requireParticipant, (req, res) => {
  try {
    const { sessionId, studentId } = req.participant;
    const snapshot = proposeAnswer(sessionId, studentId, req.body?.option);
    broadcastSession(sessionId);
    res.json({ ok: true, snapshot: getSessionSnapshot(sessionId, { includeSecrets: false }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/sessions/:sessionId/submit-answer', requireParticipant, (req, res) => {
  try {
    const { sessionId, studentId } = req.participant;
    submitFinalAnswerAtomic(sessionId, studentId, req.body?.option);
    broadcastSession(sessionId);
    res.json({ ok: true, snapshot: getSessionSnapshot(sessionId, { includeSecrets: false }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ==========================================
// SOCKET.IO REALTIME SYNCHRONIZATION
// ==========================================

io.on('connection', (socket) => {
  const { token, sessionId } = socket.handshake.auth || {};
  const payload = verifyToken(token);

  if (!payload) {
    socket.emit('auth:error', { error: 'Token tidak valid.' });
    socket.disconnect(true);
    return;
  }

  if (payload.role === 'teacher' && sessionId) {
    socket.join(`teacher:${sessionId}`);
    const snap = getSessionSnapshot(sessionId, { includeSecrets: true });
    if (snap) socket.emit('session:update', snap);
  } else if (payload.role === 'student') {
    if (sessionId && sessionId !== payload.sessionId) {
      socket.emit('auth:error', { error: 'Siswa tidak dapat mengakses sesi lain.' });
      socket.disconnect(true);
      return;
    }
    const sid = payload.sessionId;
    socket.join(`student:${sid}`);
    db.prepare(`UPDATE session_participants SET is_connected = 1, last_seen_at = datetime('now') WHERE id = ?`).run(
      payload.participantId
    );
    broadcastSession(sid);

    socket.on('disconnect', () => {
      db.prepare(`UPDATE session_participants SET is_connected = 0, last_seen_at = datetime('now') WHERE id = ?`).run(
        payload.participantId
      );
      broadcastSession(sid);
    });
  }
});

// Serve built frontend in production
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  console.log(`Informatika Adventure backend running on http://localhost:${PORT}`);
});
