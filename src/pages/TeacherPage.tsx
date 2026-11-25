import React, { useEffect, useState, useRef } from 'react';
import {
  Dices,
  Play,
  Square,
  Users,
  Trophy,
  QrCode,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Crown,
  ArrowLeftRight,
  LogOut,
  Wifi,
  WifiOff,
  PlusCircle,
  LayoutDashboard,
  Gamepad2,
  GraduationCap,
  History,
  Search,
  UserPlus,
  Swords,
  Volume2,
  VolumeX,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Unlock,
  Fingerprint,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { apiFetch, createRealtimeSocket } from '../api';
import { ClassItem, SessionSnapshot, SessionStatus, Participant, StudentItem } from '../types';
import { GameBoard } from '../components/GameBoard';
import { GameLogo } from '../components/ui/GameLogo';
import { GameButton } from '../components/ui/GameButton';
import { StudentAvatar } from '../components/ui/StudentAvatar';
import { DiceWidget } from '../components/ui/DiceWidget';
import { QuestionModal } from '../components/ui/QuestionModal';
import { VictoryOverlay } from '../components/ui/VictoryOverlay';
import { sfx } from '../utils/sound';

type TeacherTab = 'dashboard' | 'lobby' | 'board' | 'classes' | 'history';

const STATUS_FLOW: { status: SessionStatus; label: string }[] = [
  { status: 'WAITING', label: 'Menunggu' },
  { status: 'REGISTRATION', label: 'Pendaftaran' },
  { status: 'TEAM_ASSIGNMENT', label: 'Gacha' },
  { status: 'LOBBY', label: 'Lobby' },
  { status: 'PLAYING', label: 'Bermain' },
  { status: 'FINISHED', label: 'Selesai' },
];

export const TeacherPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('teacher_token'));
  const [teacherName, setTeacherName] = useState<string>(() => sessionStorage.getItem('teacher_name') || '');
  const [pin, setPin] = useState('');
  const [biometricStatus, setBiometricStatus] = useState('');
  const [hasBiometric, setHasBiometric] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState<TeacherTab>('dashboard');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [newStudentName, setNewStudentName] = useState('');

  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectorMode, setProjectorMode] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [errorMsg, setErrorMsg] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const prevStatusRef = useRef<SessionStatus | null>(null);

  useEffect(() => {
    apiFetch<{ classes: ClassItem[] }>('/api/classes')
      .then((res) => {
        setClasses(res.classes);
        if (res.classes.length > 0 && !selectedClassId) {
          setSelectedClassId(res.classes[0].id);
        }
      })
      .catch(() => { });
  }, [snapshot?.session.status]);

  useEffect(() => {
    if (!selectedClassId) return;
    apiFetch<{ students: StudentItem[] }>(`/api/classes/${selectedClassId}/students`)
      .then((res) => setClassStudents(res.students))
      .catch(() => { });
  }, [selectedClassId]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ sessions: any[] }>('/api/teacher/sessions', {}, token)
      .then((res) => setSessionHistory(res.sessions))
      .catch(() => { });
  }, [token, snapshot?.session.status]);

  useEffect(() => {
    const savedSessionId = sessionStorage.getItem('teacher_session_id');
    if (token && savedSessionId && !snapshot) {
      apiFetch<{ snapshot: SessionSnapshot; qrDataUrl: string; joinUrl: string }>(
        `/api/teacher/sessions/${savedSessionId}?baseUrl=${encodeURIComponent(window.location.origin)}`,
        {},
        token
      )
        .then((res) => {
          setSnapshot(res.snapshot);
          setQrDataUrl(res.qrDataUrl);
          setJoinUrl(res.joinUrl);
        })
        .catch(() => {
          sessionStorage.removeItem('teacher_session_id');
        });
    }
  }, [token]);

  useEffect(() => {
    if (!token || !snapshot?.session.id) return;

    const socket = createRealtimeSocket(token, snapshot.session.id);
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('auth:error', () => {
      handleLogout();
      setLoginError('Sesi login guru berakhir. Silakan masukkan PIN kembali.');
    });
    socket.on('session:update', (updated: SessionSnapshot) => {
      if (updated.session.status === 'PLAYING' && prevStatusRef.current !== 'PLAYING') {
        setActiveTab('board');
      }
      prevStatusRef.current = updated.session.status;
      setSnapshot(updated);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, snapshot?.session.id]);

  useEffect(() => {
    apiFetch<{ hasRegisteredBiometric: boolean }>('/api/teacher/webauthn/status')
      .then((res) => setHasBiometric(res.hasRegisteredBiometric))
      .catch(() => { });
  }, []);

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await apiFetch<{ token: string; teacher: { displayName: string } }>(
        '/api/teacher/pin-login',
        { method: 'POST', body: JSON.stringify({ pin }) }
      );
      sessionStorage.setItem('teacher_token', res.token);
      sessionStorage.setItem('teacher_name', res.teacher.displayName);
      setToken(res.token);
      setTeacherName(res.teacher.displayName);
    } catch (err: any) {
      setLoginError(err.message);
    }
  }

  async function handleBiometricLogin() {
    setLoginError('');
    setBiometricStatus('');
    const storedCredId = localStorage.getItem('teacher_webauthn_cred_id');
    if (!storedCredId) {
      setLoginError('Sidik jari belum didaftarkan di perangkat ini. Masuk dengan PIN dulu, lalu aktifkan Sidik Jari.');
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials) {
      setLoginError('Browser atau perangkat ini tidak mendukung autentikasi sidik jari (WebAuthn).');
      return;
    }
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const rawId = Uint8Array.from(atob(storedCredId), (c) => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      if (!assertion) throw new Error('Verifikasi sidik jari dibatalkan.');

      const res = await apiFetch<{ token: string; teacher: { displayName: string } }>(
        '/api/teacher/webauthn/login',
        { method: 'POST', body: JSON.stringify({ credentialId: storedCredId }) }
      );
      sessionStorage.setItem('teacher_token', res.token);
      sessionStorage.setItem('teacher_name', res.teacher.displayName);
      setToken(res.token);
      setTeacherName(res.teacher.displayName);
    } catch (err: any) {
      setLoginError(err.message || 'Gagal memverifikasi sidik jari.');
    }
  }

  async function handleRegisterBiometric() {
    if (!token) return;
    setBiometricStatus('');
    setErrorMsg('');
    if (!window.PublicKeyCredential || !navigator.credentials) {
      setErrorMsg('Browser atau perangkat ini tidak mendukung sensor sidik jari (WebAuthn).');
      return;
    }
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode('teacher-pipit');
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Informatika Adventure', id: window.location.hostname },
          user: { id: userId, name: 'guru', displayName: teacherName || 'Pipit Khofifah' },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!cred) throw new Error('Pendaftaran sidik jari dibatalkan.');
      const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));

      await apiFetch(
        '/api/teacher/webauthn/register',
        { method: 'POST', body: JSON.stringify({ credentialId: credIdB64 }) },
        token
      );
      localStorage.setItem('teacher_webauthn_cred_id', credIdB64);
      setHasBiometric(true);
      setBiometricStatus('Sidik jari perangkat berhasil didaftarkan!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mendaftarkan sidik jari perangkat.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('teacher_token');
    sessionStorage.removeItem('teacher_name');
    sessionStorage.removeItem('teacher_session_id');
    setToken(null);
    setSnapshot(null);
  }

  function handleAuthError(err: any) {
    const msg = err?.message || '';
    if (msg.includes('khusus guru') || msg.includes('401')) {
      handleLogout();
      setLoginError('Sesi login guru berakhir. Silakan masukkan PIN kembali.');
      return true;
    }
    return false;
  }

  async function handleToggleClassLock(classId: string) {
    if (!token) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{
        classes: ClassItem[];
        snapshot: SessionSnapshot;
        qrDataUrl: string;
        joinUrl: string;
      }>(
        `/api/teacher/classes/${classId}/toggle-lock`,
        { method: 'POST', body: JSON.stringify({ baseUrl: window.location.origin }) },
        token
      );
      setClasses(res.classes);
      setSelectedClassId(classId);
      sessionStorage.setItem('teacher_session_id', res.snapshot.session.id);
      setSnapshot(res.snapshot);
      setQrDataUrl(res.qrDataUrl);
      setJoinUrl(res.joinUrl);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSelectClassSession(sessionId: string, classId: string) {
    if (!token) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot; qrDataUrl: string; joinUrl: string }>(
        `/api/teacher/sessions/${sessionId}?baseUrl=${encodeURIComponent(window.location.origin)}`,
        {},
        token
      );
      setSelectedClassId(classId);
      sessionStorage.setItem('teacher_session_id', res.snapshot.session.id);
      setSnapshot(res.snapshot);
      setQrDataUrl(res.qrDataUrl);
      setJoinUrl(res.joinUrl);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleCreateSession() {
    if (!token || !selectedClassId) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot; qrDataUrl: string; joinUrl: string }>(
        '/api/teacher/sessions',
        {
          method: 'POST',
          body: JSON.stringify({ classId: selectedClassId, baseUrl: window.location.origin }),
        },
        token
      );
      sessionStorage.setItem('teacher_session_id', res.snapshot.session.id);
      setSnapshot(res.snapshot);
      setQrDataUrl(res.qrDataUrl);
      setJoinUrl(res.joinUrl);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleStatusChange(status: SessionStatus) {
    if (!token || !snapshot) return;
    if (status === 'PLAYING' && startingGame) return;
    setErrorMsg('');
    if (status === 'PLAYING') setStartingGame(true);
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot }>(
        `/api/teacher/sessions/${snapshot.session.id}/status`,
        { method: 'POST', body: JSON.stringify({ status }) },
        token
      );
      prevStatusRef.current = res.snapshot.session.status;
      if (status === 'PLAYING') {
        setActiveTab('board');
      }
      setSnapshot(res.snapshot);
    } catch (err: any) {
      if (!handleAuthError(err)) setErrorMsg(err.message);
    } finally {
      if (status === 'PLAYING') setStartingGame(false);
    }
  }

  async function handleSeedDemo() {
    if (!token) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{
        classes: ClassItem[];
        snapshot: SessionSnapshot;
        qrDataUrl: string;
        joinUrl: string;
      }>(
        '/api/teacher/demo/seed',
        { method: 'POST', body: JSON.stringify({ classId: selectedClassId || 'cls-xi-f8', baseUrl: window.location.origin }) },
        token
      );
      setClasses(res.classes);
      sessionStorage.setItem('teacher_session_id', res.snapshot.session.id);
      prevStatusRef.current = res.snapshot.session.status;
      setSnapshot(res.snapshot);
      setQrDataUrl(res.qrDataUrl);
      setJoinUrl(res.joinUrl);
      setActiveTab('lobby');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleDemoAnswer(option?: string) {
    if (!token || !snapshot) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot }>(
        `/api/teacher/sessions/${snapshot.session.id}/demo-answer`,
        { method: 'POST', body: JSON.stringify({ option }) },
        token
      );
      setSnapshot(res.snapshot);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleReassign(studentId: string, opts: { teamNumber?: 1 | 2; makeCaptain?: boolean }) {
    if (!token || !snapshot) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot }>(
        `/api/teacher/sessions/${snapshot.session.id}/reassign`,
        { method: 'POST', body: JSON.stringify({ studentId, ...opts }) },
        token
      );
      setSnapshot(res.snapshot);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleRollDice() {
    if (!token || !snapshot) return;
    setErrorMsg('');
    setDiceRolling(true);
    sfx.dice();
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot }>(
        `/api/teacher/sessions/${snapshot.session.id}/roll-dice`,
        { method: 'POST' },
        token
      );
      setTimeout(() => {
        setDiceRolling(false);
        setSnapshot(res.snapshot);
        const note = res.snapshot.gameState?.last_move_note || '';
        if (note.includes('Tangga')) sfx.ladder();
        else if (note.includes('Ular')) sfx.snake();
      }, 350);
    } catch (err: any) {
      setDiceRolling(false);
      setErrorMsg(err.message);
    }
  }

  async function handleNextTurn() {
    if (!token || !snapshot) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ snapshot: SessionSnapshot }>(
        `/api/teacher/sessions/${snapshot.session.id}/next-turn`,
        { method: 'POST' },
        token
      );
      setSnapshot(res.snapshot);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedClassId || !newStudentName.trim()) return;
    setErrorMsg('');
    try {
      const res = await apiFetch<{ student: StudentItem }>(
        '/api/teacher/students',
        { method: 'POST', body: JSON.stringify({ classId: selectedClassId, fullName: newStudentName }) },
        token
      );
      setClassStudents((prev) => [...prev, res.student].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setNewStudentName('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-[#162033] border-2 border-slate-800 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <GameLogo size="md" />
            </div>
            <h1 className="font-display text-xl font-black text-white pt-2">Akses Dashboard Guru</h1>
            <p className="text-xs text-slate-400">Masukkan PIN 6 digit atau gunakan autentikasi Sidik Jari</p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold">
              {loginError}
            </div>
          )}

          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                PIN Guru (6 Digit)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  data-testid="teacher-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-2xl font-mono font-black tracking-[0.35em] rounded-xl bg-[#0F172A] border-2 border-slate-700 px-10 py-3 text-amber-400 focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>
            </div>

            <GameButton type="submit" variant="primary" size="lg" fullWidth data-testid="teacher-login-btn">
              <Lock className="w-4 h-4" /> Masuk dengan PIN
            </GameButton>
          </form>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <GameButton
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              onClick={handleBiometricLogin}
              data-testid="teacher-biometric-btn"
            >
              <Fingerprint className="w-5 h-5 text-emerald-400" />
              {hasBiometric ? 'Masuk dengan Sidik Jari' : 'Sidik Jari (Belum Terdaftar)'}
            </GameButton>

            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white pt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard Biasa
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const state = snapshot?.gameState;
  const session = snapshot?.session;
  const isPlaying = session?.status === 'PLAYING';
  const isFinished = session?.status === 'FINISHED';
  const canEditTeams = session && !isPlaying && !isFinished;

  const navItems: { id: TeacherTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Sesi & QR', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'lobby', label: 'Lobby Tim (VS)', icon: <Users className="w-4 h-4" /> },
    { id: 'board', label: 'Papan Permainan', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'classes', label: 'Kelas & Siswa', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'history', label: 'Riwayat & Hasil', icon: <History className="w-4 h-4" /> },
  ];

  const showQuestionModal =
    isPlaying &&
    snapshot?.currentQuestion &&
    state &&
    (state.answer_status === 'AWAITING_ANSWER' || state.answer_status === 'ANSWERED');

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex">
      {/* Sidebar Navigation (Toggle Buka / Tutup) */}
      {!projectorMode && sidebarOpen && (
        <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between bg-[#162033] border-r border-slate-800 p-4">
          <div className="space-y-6">
            <div className="px-2 pt-1">
              <GameLogo size="sm" />
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${active
                      ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-300 hover:bg-[#1A2744]'
                      }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-slate-800">
            <div className="px-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Guru Pengajar</div>
              <div className="text-sm font-bold text-white truncate">{teacherName}</div>
            </div>
            {biometricStatus && (
              <div className="px-2 text-[11px] font-bold text-[#10B981]">{biometricStatus}</div>
            )}
            <GameButton variant="ghost" size="sm" fullWidth onClick={handleRegisterBiometric}>
              <Fingerprint className="w-4 h-4 text-emerald-400" /> Daftarkan Sidik Jari
            </GameButton>
            <GameButton variant="danger" size="sm" fullWidth onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> Keluar
            </GameButton>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-[#162033] px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!projectorMode && (
              <button
                data-testid="toggle-sidebar-btn"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? 'Tutup Panel' : 'Buka Panel'}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] border border-slate-700 hover:border-slate-500 text-xs font-bold text-slate-200 cursor-pointer"
              >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                <span>{sidebarOpen ? 'Tutup Panel' : 'Buka Panel'}</span>
              </button>
            )}
            {projectorMode && <GameLogo size="sm" />}
            {session ? (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-lg bg-[#0F172A] border border-slate-700 text-xs font-extrabold text-blue-300">
                  {session.class_name}
                </span>
                <span className="font-mono font-black text-sm tracking-widest text-amber-400">
                  {session.session_code}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold ${socketConnected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                    }`}
                >
                  {socketConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {socketConnected ? 'Realtime' : 'Menyambung...'}
                </span>
                {!isPlaying && !isFinished && (
                  <button
                    data-testid="toggle-registration-btn"
                    onClick={() =>
                      handleStatusChange(session.status === 'REGISTRATION' ? 'LOBBY' : 'REGISTRATION')
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${session.status === 'REGISTRATION'
                      ? 'bg-[#10B981] text-slate-950'
                      : 'bg-[#0F172A] border border-slate-700 text-slate-200 hover:border-slate-500'
                      }`}
                  >
                    {session.status === 'REGISTRATION' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Pendaftaran Dibuka
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Pendaftaran Ditutup
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm font-bold text-slate-300">Siap Membuat Sesi Kelas</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile quick tab switcher */}
            <div className="flex md:hidden items-center gap-1">
              {navItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`p-2 rounded-lg ${activeTab === item.id ? 'bg-[#2563EB] text-white' : 'bg-[#1A2744] text-slate-300'}`}
                  aria-label={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>

            <GameButton
              variant="ghost"
              size="sm"
              aria-label={muted ? 'Aktifkan suara' : 'Bisukan suara'}
              onClick={() => setMuted(sfx.toggleMute())}
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </GameButton>

            {snapshot && (
              <GameButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProjectorMode((v) => !v);
                  setActiveTab('board');
                }}
              >
                {projectorMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{projectorMode ? 'Mode Kontrol' : 'Mode Proyektor'}</span>
              </GameButton>
            )}

            {snapshot && !projectorMode && (
              <GameButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  sessionStorage.removeItem('teacher_session_id');
                  setSnapshot(null);
                  setActiveTab('dashboard');
                }}
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Sesi Baru</span>
              </GameButton>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: DASHBOARD & CLASS LOCK/UNLOCK */}
          {activeTab === 'dashboard' && !projectorMode && (
            <div className="space-y-6">
              {/* Per-Class Lock / Unlock Cards */}
              <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="font-display text-xl font-black text-white">Kunci / Buka Kunci Kelas</h1>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Buka kunci kelas agar siswa dapat langsung memilih kelas dan namanya dari HP tanpa perlu mengetik token.
                      </p>
                    </div>
                    <GameButton variant="purple" size="sm" onClick={handleSeedDemo} data-testid="seed-demo-btn">
                      Mode Demo: Isi 6 Siswa
                    </GameButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {classes.map((c) => {
                      const isUnlocked = Boolean(c.is_unlocked);
                      const isPlayingClass = c.active_status === 'PLAYING';
                      const isSelected = snapshot?.session.class_id === c.id;
                      return (
                        <div
                          key={c.id}
                          data-testid={`class-card-${c.id}`}
                          className={`rounded-2xl p-5 border-2 flex flex-col justify-between gap-4 bg-[#0F172A] ${isUnlocked
                            ? 'border-[#10B981]'
                            : isSelected
                              ? 'border-[#2563EB]'
                              : 'border-slate-800'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display text-lg font-black text-white">Kelas {c.name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {c.active_session_id
                                  ? `${c.participant_count || 0} siswa bergabung • Status: ${c.active_status}`
                                  : 'Belum ada sesi aktif'}
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold ${isUnlocked
                                ? 'bg-emerald-500/15 text-[#10B981]'
                                : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                              {isUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              {isUnlocked ? 'Terbuka' : 'Terkunci'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <GameButton
                              variant={isUnlocked ? 'danger' : 'success'}
                              size="sm"
                              disabled={isPlayingClass}
                              onClick={() => handleToggleClassLock(c.id)}
                              data-testid={`toggle-lock-${c.id}`}
                              className="flex-1"
                            >
                              {isUnlocked ? (
                                <>
                                  <Lock className="w-4 h-4" /> Kunci Kelas
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-4 h-4" /> Buka Kunci
                                </>
                              )}
                            </GameButton>

                            {c.active_session_id && (
                              <GameButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectClassSession(c.active_session_id!, c.id)}
                              >
                                Kelola Sesi
                              </GameButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {snapshot && session && state && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* QR & Session Code Card (Opsional untuk scan cepat) */}
                    <div className="lg:col-span-5 rounded-2xl bg-[#162033] border-2 border-slate-800 p-6 flex flex-col items-center text-center space-y-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-300">
                        QR Code Gabung Cepat ({session.class_name})
                      </span>
                      {qrDataUrl && (
                        <div className="bg-white p-3 rounded-xl">
                          <img src={qrDataUrl} alt="QR Code Sesi" className="w-40 h-40" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-xs text-slate-400">Kode Sesi (Opsional)</div>
                        <div
                          data-testid="session-code-display"
                          className="font-mono text-2xl font-black tracking-[0.2em] text-amber-400"
                        >
                          {session.session_code}
                        </div>
                      </div>
                      <GameButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(joinUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        }}
                      >
                        {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Link Tersalin' : 'Salin Link Gabung'}
                      </GameButton>
                    </div>

                    {/* Session Controls & Stats */}
                    <div className="lg:col-span-7 space-y-5">
                      <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-6 space-y-4">
                        <h2 className="font-display text-lg font-black text-white">Kontrol Sesi {session.class_name}</h2>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_FLOW.map((item) => {
                            const active = session.status === item.status;
                            return (
                              <button
                                key={item.status}
                                data-testid={`status-btn-${item.status}`}
                                onClick={() => handleStatusChange(item.status)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${active
                                  ? 'bg-[#2563EB] text-white'
                                  : 'bg-[#0F172A] border border-slate-700 text-slate-300 hover:border-slate-500'
                                  }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-2 flex flex-wrap gap-3">
                          {!isPlaying && !isFinished && (
                            <GameButton
                              variant="success"
                              size="lg"
                              onClick={() => handleStatusChange('PLAYING')}
                              data-testid="start-game-btn"
                            >
                              <Play className="w-5 h-5" /> Mulai Permainan
                            </GameButton>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-[#162033] border border-slate-800 p-4">
                          <div className="text-xs text-slate-400">Total Siswa</div>
                          <div className="font-display text-3xl font-black text-white mt-1">
                            {snapshot.participants.length}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[#162033] border border-[#2563EB]/60 p-4">
                          <div className="text-xs text-blue-400 font-bold">Tim Biru (K1)</div>
                          <div className="font-display text-3xl font-black text-white mt-1">
                            {snapshot.teams.team1Count}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[#162033] border border-[#E11D48]/60 p-4">
                          <div className="text-xs text-rose-400 font-bold">Tim Merah (K2)</div>
                          <div className="font-display text-3xl font-black text-white mt-1">
                            {snapshot.teams.team2Count}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
          )}

              {/* TAB 2: TEAM LOBBY (BLUE VS RED) */}
              {activeTab === 'lobby' && !snapshot && !projectorMode && (
                <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-8 text-center space-y-4">
                  <Users className="w-10 h-10 text-blue-400 mx-auto" />
                  <h2 className="font-display text-xl font-black text-white">Belum Ada Sesi Kelas Aktif</h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Buka kunci kelas terlebih dahulu di menu <strong>Sesi &amp; QR</strong> agar siswa dapat bergabung ke Tim Biru dan Tim Merah.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <GameButton variant="primary" onClick={() => setActiveTab('dashboard')}>
                      Buka Menu Sesi &amp; QR
                    </GameButton>
                    <GameButton variant="purple" onClick={handleSeedDemo}>
                      Mode Demo: Isi 6 Siswa
                    </GameButton>
                  </div>
                </div>
              )}

              {activeTab === 'lobby' && snapshot && session && !projectorMode && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl font-black text-white">Lobby Pertandingan</h1>
                      <p className="text-sm text-slate-400">
                        Status: <strong className="text-blue-300">{session.status}</strong> • Total{' '}
                        {snapshot.participants.length} peserta bergabung
                      </p>
                    </div>
                    {!isPlaying && !isFinished && (
                      <GameButton variant="success" size="lg" onClick={() => handleStatusChange('PLAYING')}>
                        <Play className="w-5 h-5" /> Mulai Permainan Sekarang
                      </GameButton>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
                    {/* BLUE TEAM (LEFT) */}
                    <div
                      data-testid="teacher-team-1-list"
                      className="lg:col-span-5 rounded-3xl bg-blue-950/35 border-2 border-[#2563EB]/60 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-xl font-black text-blue-300">KELOMPOK 1 • TIM BIRU</h2>
                        <span className="px-3 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                          {snapshot.teams.team1Count} siswa
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {snapshot.teams.team1.length === 0 && (
                          <p className="text-sm text-slate-400 italic py-6 text-center">Menunggu siswa masuk Tim Biru...</p>
                        )}
                        {snapshot.teams.team1.map((m: Participant) => (
                          <div
                            key={m.student_id}
                            className="flex items-center justify-between gap-2 bg-[#111C33] border border-slate-800 px-3.5 py-2.5 rounded-2xl"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <StudentAvatar
                                name={m.full_name}
                                teamNumber={1}
                                isCaptain={m.is_captain}
                                isConnected={m.is_connected}
                                size="sm"
                              />
                              <div className="truncate">
                                <div className="text-sm font-bold text-white truncate">{m.full_name}</div>
                                {m.is_captain && (
                                  <span className="text-[10px] font-extrabold text-amber-400">KAPTEN TIM</span>
                                )}
                              </div>
                            </div>
                            {canEditTeams && (
                              <div className="flex items-center gap-1 shrink-0">
                                {!m.is_captain && (
                                  <button
                                    title="Jadikan Kapten"
                                    onClick={() => handleReassign(m.student_id, { makeCaptain: true })}
                                    className="p-1.5 rounded-lg bg-[#1A2744] hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  title="Pindah ke Tim Merah"
                                  onClick={() => handleReassign(m.student_id, { teamNumber: 2 })}
                                  className="p-1.5 rounded-lg bg-[#1A2744] hover:bg-rose-500/20 text-slate-300 cursor-pointer"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* VS CENTER BADGE */}
                    <div className="lg:col-span-1 flex items-center justify-center py-2">
                      <div className="w-14 h-14 rounded-2xl bg-[#7C3AED] border-2 border-purple-300/40 flex flex-col items-center justify-center shadow-xl">
                        <Swords className="w-5 h-5 text-white" />
                        <span className="font-display text-xs font-black text-white">VS</span>
                      </div>
                    </div>

                    {/* RED TEAM (RIGHT) */}
                    <div
                      data-testid="teacher-team-2-list"
                      className="lg:col-span-5 rounded-3xl bg-rose-950/35 border-2 border-[#E11D48]/60 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-xl font-black text-rose-300">KELOMPOK 2 • TIM MERAH</h2>
                        <span className="px-3 py-1 rounded-full bg-[#E11D48] text-white text-xs font-extrabold">
                          {snapshot.teams.team2Count} siswa
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {snapshot.teams.team2.length === 0 && (
                          <p className="text-sm text-slate-400 italic py-6 text-center">Menunggu siswa masuk Tim Merah...</p>
                        )}
                        {snapshot.teams.team2.map((m: Participant) => (
                          <div
                            key={m.student_id}
                            className="flex items-center justify-between gap-2 bg-[#111C33] border border-slate-800 px-3.5 py-2.5 rounded-2xl"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <StudentAvatar
                                name={m.full_name}
                                teamNumber={2}
                                isCaptain={m.is_captain}
                                isConnected={m.is_connected}
                                size="sm"
                              />
                              <div className="truncate">
                                <div className="text-sm font-bold text-white truncate">{m.full_name}</div>
                                {m.is_captain && (
                                  <span className="text-[10px] font-extrabold text-amber-400">KAPTEN TIM</span>
                                )}
                              </div>
                            </div>
                            {canEditTeams && (
                              <div className="flex items-center gap-1 shrink-0">
                                {!m.is_captain && (
                                  <button
                                    title="Jadikan Kapten"
                                    onClick={() => handleReassign(m.student_id, { makeCaptain: true })}
                                    className="p-1.5 rounded-lg bg-[#1A2744] hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  title="Pindah ke Tim Biru"
                                  onClick={() => handleReassign(m.student_id, { teamNumber: 1 })}
                                  className="p-1.5 rounded-lg bg-[#1A2744] hover:bg-blue-500/20 text-slate-300 cursor-pointer"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MAIN GAME BOARD (16:9 PROJECTOR OPTIMIZED) */}
              {(activeTab === 'board' || projectorMode) && !snapshot && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-black text-white">Pratinjau Papan Ular Tangga (100 Petak)</h2>
                      <p className="text-xs text-slate-400">
                        Buka kunci salah satu kelas di menu <strong>Sesi &amp; QR</strong> untuk memulai permainan bersama siswa.
                      </p>
                    </div>
                    <GameButton variant="primary" size="sm" onClick={() => setActiveTab('dashboard')}>
                      Buka Sesi &amp; QR
                    </GameButton>
                  </div>
                  <GameBoard
                    team1Pos={1}
                    team2Pos={1}
                    activeTeam={1}
                    ladders={{ 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 }}
                    snakes={{ 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 }}
                    size={100}
                  />
                </div>
              )}

              {(activeTab === 'board' || projectorMode) && snapshot && session && state && (
                <div className="space-y-4">
                  {/* Top Two Team Score Panels */}
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`rounded-2xl p-4 border-2 flex items-center justify-between transition ${state.active_team === 1 && isPlaying
                        ? 'bg-blue-950/70 border-[#3B82F6] shadow-lg shadow-blue-500/15'
                        : 'bg-[#111C33] border-slate-800'
                        }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-blue-300">
                          Kelompok 1 • Tim Biru ({snapshot.teams.team1Count} siswa)
                        </div>
                        <div className="font-display text-2xl sm:text-3xl font-black text-white mt-0.5">
                          Petak {state.team1_pos} <span className="text-sm text-slate-400">/ {snapshot.board.size}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-display font-black text-lg">
                        {state.team1_xp} XP
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl p-4 border-2 flex items-center justify-between transition ${state.active_team === 2 && isPlaying
                        ? 'bg-rose-950/70 border-[#FB7185] shadow-lg shadow-rose-500/15'
                        : 'bg-[#111C33] border-slate-800'
                        }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                          Kelompok 2 • Tim Merah ({snapshot.teams.team2Count} siswa)
                        </div>
                        <div className="font-display text-2xl sm:text-3xl font-black text-white mt-0.5">
                          Petak {state.team2_pos} <span className="text-sm text-slate-400">/ {snapshot.board.size}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-display font-black text-lg">
                        {state.team2_xp} XP
                      </div>
                    </div>
                  </div>

                  {/* Center Board + Side Control Panel */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    <div className="xl:col-span-9 space-y-3">
                      <GameBoard
                        team1Pos={state.team1_pos}
                        team2Pos={state.team2_pos}
                        activeTeam={state.active_team}
                        ladders={snapshot.board.ladders}
                        snakes={snapshot.board.snakes}
                        size={snapshot.board.size}
                      />
                      {state.last_move_note && (
                        <div className="p-3 rounded-2xl bg-[#1A2744] border border-purple-500/40 text-purple-200 text-sm font-bold text-center">
                          {state.last_move_note}
                        </div>
                      )}
                    </div>

                    {/* Side Controls */}
                    <div className="xl:col-span-3 rounded-3xl bg-[#111C33] border-2 border-slate-800 p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Giliran #{state.turn_number}
                        </span>
                        <span
                          data-testid="active-team-label"
                          className={`font-display font-black text-sm px-3 py-1 rounded-full ${state.active_team === 1
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-[#E11D48] text-white'
                            }`}
                        >
                          Kelompok {state.active_team}
                        </span>
                      </div>

                      <div className="flex flex-col items-center py-2 space-y-4">
                        <DiceWidget value={state.last_dice} rolling={diceRolling} activeTeam={state.active_team} />

                        {isPlaying && state.answer_status === 'READY_TO_ROLL' && (
                          <GameButton
                            variant={state.active_team === 1 ? 'team1' : 'team2'}
                            size="lg"
                            fullWidth
                            onClick={handleRollDice}
                            data-testid="roll-dice-btn"
                          >
                            <Dices className="w-5 h-5" /> Lempar Dadu
                          </GameButton>
                        )}

                        {!isPlaying && !isFinished && (
                          <GameButton
                            variant="success"
                            size="lg"
                            fullWidth
                            onClick={() => handleStatusChange('PLAYING')}
                          >
                            <Play className="w-5 h-5" /> Mulai Permainan
                          </GameButton>
                        )}
                      </div>

                      {isPlaying && (
                        <GameButton
                          variant="danger"
                          size="sm"
                          fullWidth
                          onClick={() => handleStatusChange('FINISHED')}
                          data-testid="end-game-btn"
                        >
                          <Square className="w-4 h-4" /> Akhiri Permainan
                        </GameButton>
                      )}

                      {isFinished && snapshot.result && (
                        <VictoryOverlay result={snapshot.result} testId="teacher-game-result" />
                      )}

                      {/* Live Event Feed */}
                      {snapshot.turns.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <Activity className="w-3.5 h-3.5 text-blue-400" /> Aktivitas Terkini
                          </div>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {snapshot.turns.slice(0, 4).map((t) => (
                              <div
                                key={t.id}
                                className="text-[11px] px-2.5 py-1.5 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className="text-slate-300 truncate">
                                  G{t.turn_number} • K{t.team_number} ({t.selected_option})
                                </span>
                                <span className={t.is_correct ? 'text-[#10B981] font-bold' : 'text-rose-400 font-bold'}>
                                  {t.is_correct ? `+${t.xp_delta} XP` : 'Salah'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CLASS & STUDENT MANAGEMENT */}
              {activeTab === 'classes' && !projectorMode && (
                <div className="rounded-3xl bg-[#111C33] border-2 border-slate-800 p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="font-display text-xl font-black text-white">Manajemen Kelas &amp; Siswa</h1>
                      <p className="text-xs text-slate-400">Daftar siswa resmi yang dapat memilih namanya saat bergabung.</p>
                    </div>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="rounded-xl bg-[#0B1120] border-2 border-slate-700 px-4 py-2 text-sm text-white font-bold"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Cari nama siswa..."
                        className="w-full rounded-xl bg-[#0B1120] border border-slate-700 pl-10 pr-4 py-2.5 text-sm text-white"
                      />
                    </div>
                    <form onSubmit={handleAddStudent} className="flex gap-2">
                      <input
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        placeholder="Tambah nama siswa baru..."
                        className="rounded-xl bg-[#0B1120] border border-slate-700 px-3.5 py-2.5 text-sm text-white"
                      />
                      <GameButton type="submit" variant="primary" size="sm">
                        <UserPlus className="w-4 h-4" /> Tambah
                      </GameButton>
                    </form>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto">
                    {classStudents
                      .filter((s) => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#0B1120] border border-slate-800"
                        >
                          <StudentAvatar name={s.full_name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{s.full_name}</div>
                            <div className="text-[11px] text-slate-400">NISN/ID: {s.nisn}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 5: GAME HISTORY & RESULTS */}
              {activeTab === 'history' && !projectorMode && (
                <div className="rounded-3xl bg-[#111C33] border-2 border-slate-800 p-6 space-y-4">
                  <h1 className="font-display text-xl font-black text-white">Riwayat Sesi &amp; Hasil Pertandingan</h1>
                  <div className="space-y-2.5">
                    {sessionHistory.length === 0 && (
                      <p className="text-sm text-slate-400">Belum ada riwayat sesi.</p>
                    )}
                    {sessionHistory.map((h) => (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#0B1120] border border-slate-800"
                      >
                        <div>
                          <div className="font-display font-bold text-white">
                            {h.class_name} • <span className="font-mono text-amber-400">#{h.session_code}</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Status: {h.status} • Peserta: {h.participant_count} siswa
                          </div>
                        </div>
                        {h.winner_team != null && (
                          <div className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-400/15 text-amber-300">
                            {h.winner_team === 0 ? 'Seri' : `Pemenang: Kelompok ${h.winner_team}`} (Biru {h.team1_xp} XP vs Merah {h.team2_xp} XP)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>
      </div>

      {/* Large Projector Question Challenge Modal */}
      {showQuestionModal && snapshot.currentQuestion && state && (
        <QuestionModal
          question={snapshot.currentQuestion}
          gameState={state}
          onNextTurn={handleNextTurn}
          onDemoAnswer={handleDemoAnswer}
        />
      )}
    </div>
  );
};
