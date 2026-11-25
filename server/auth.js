import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function getOrCreateSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, '.auth-secret');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, generated, 'utf8');
  return generated;
}

const SERVER_SECRET = getOrCreateSecret();

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createTeacherToken(teacher) {
  return signPayload({
    role: 'teacher',
    teacherId: teacher.id,
    username: teacher.username,
    displayName: teacher.display_name,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  });
}

export function createParticipantToken(sessionId, studentId, participantId) {
  return signPayload({
    role: 'student',
    sessionId,
    studentId,
    participantId,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });
}

export function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

export function requireTeacher(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'teacher') {
    return res.status(401).json({ error: 'Akses ditolak: khusus guru yang terautentikasi.' });
  }
  req.teacher = payload;
  next();
}

export function requireParticipant(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'student') {
    return res.status(401).json({ error: 'Token peserta tidak valid atau kedaluwarsa.' });
  }
  const targetSessionId = req.params.sessionId || req.body?.sessionId;
  if (targetSessionId && payload.sessionId !== targetSessionId) {
    return res.status(403).json({ error: 'Akses ditolak: siswa tidak dapat mengakses sesi lain.' });
  }
  req.participant = payload;
  next();
}
