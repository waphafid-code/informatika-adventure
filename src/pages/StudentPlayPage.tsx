import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  Crown,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { apiFetch, createRealtimeSocket } from '../api';
import { SessionSnapshot } from '../types';
import { GameButton } from '../components/ui/GameButton';
import { StudentAvatar } from '../components/ui/StudentAvatar';
import { GachaMachine } from '../components/ui/GachaMachine';
import { VictoryOverlay } from '../components/ui/VictoryOverlay';
import { sfx } from '../utils/sound';

export const StudentPlayPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [token] = useState<string | null>(() => sessionStorage.getItem('student_token'));
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [teamNumber, setTeamNumber] = useState<1 | 2 | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [gachaSpinning, setGachaSpinning] = useState(false);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const socketRef = useRef<Socket | null>(null);

  const syncMe = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const me = await apiFetch<{
        student: { id: string; fullName: string };
        teamNumber: 1 | 2 | null;
        isCaptain: boolean;
        snapshot: SessionSnapshot;
      }>(`/api/sessions/${sessionId}/me`, {}, token);
      setStudentName(me.student.fullName);
      setStudentId(me.student.id);
      setTeamNumber(me.teamNumber);
      setIsCaptain(me.isCaptain);
      setSnapshot(me.snapshot);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }, [token, sessionId]);

  useEffect(() => {
    if (!token || !sessionId) {
      navigate('/join', { replace: true });
      return;
    }
    syncMe();
  }, [token, sessionId, syncMe, navigate]);

  useEffect(() => {
    if (!token || !sessionId) return;

    const socket = createRealtimeSocket(token, sessionId);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      syncMe();
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('session:update', (updated: SessionSnapshot) => {
      setSnapshot(updated);
      const meInSnap = updated.participants.find((p) => p.student_id === studentId);
      if (meInSnap) {
        setTeamNumber(meInSnap.team_number);
        setIsCaptain(meInSnap.is_captain);
      }
    });

    socket.on('auth:error', (payload: { error: string }) => {
      setErrorMsg(payload.error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, sessionId, studentId, syncMe]);

  useEffect(() => {
    if (snapshot?.gameState?.answer_status === 'READY_TO_ROLL') {
      setSelectedOption(null);
      setFeedbackMsg('');
    }
    if (snapshot?.gameState?.answer_status === 'AWAITING_ANSWER') {
      setSecondsLeft(45);
    }
  }, [snapshot?.gameState?.turn_number, snapshot?.gameState?.answer_status]);

  useEffect(() => {
    if (snapshot?.gameState?.answer_status !== 'AWAITING_ANSWER') return;
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [snapshot?.gameState?.answer_status]);

  async function handleRunGachaFallback() {
    if (!token || !sessionId) return;
    setErrorMsg('');
    setGachaSpinning(true);
    try {
      const res = await apiFetch<{ teamNumber: 1 | 2; isCaptain: boolean; snapshot: SessionSnapshot }>(
        `/api/sessions/${sessionId}/gacha`,
        { method: 'POST' },
        token
      );
      setTimeout(() => {
        setGachaSpinning(false);
        setTeamNumber(res.teamNumber);
        setIsCaptain(res.isCaptain);
        setSnapshot(res.snapshot);
      }, 600);
    } catch (err: any) {
      setGachaSpinning(false);
      setErrorMsg(err.message);
    }
  }

  async function handlePropose(opt: string) {
    if (!token || !sessionId) return;
    setErrorMsg('');
    setSelectedOption(opt);
    try {
      await apiFetch(
        `/api/sessions/${sessionId}/propose-answer`,
        { method: 'POST', body: JSON.stringify({ option: opt }) },
        token
      );
      setFeedbackMsg(`Usulan ${opt} terkirim ke kelompok.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSubmitFinal() {
    if (!token || !sessionId || !selectedOption) return;
    setErrorMsg('');
    try {
      await apiFetch(
        `/api/sessions/${sessionId}/submit-answer`,
        { method: 'POST', body: JSON.stringify({ option: selectedOption }) },
        token
      );
      setFeedbackMsg('Jawaban final berhasil dikirim!');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center p-6">
        {errorMsg ? (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm">
            {errorMsg}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Memuat data sesi...</p>
        )}
      </div>
    );
  }

  const { session, teams, gameState, currentQuestion, result, board } = snapshot;
  const isBlue = teamNumber === 1;
  const myTeamMembers = isBlue ? teams.team1 : teamNumber === 2 ? teams.team2 : [];
  const isMyTeamsTurn = gameState?.active_team === teamNumber;
  const captainMember = myTeamMembers.find((m) => m.is_captain);
  const boardSize = board?.size || 50;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 pb-10">
      {/* Mobile Header */}
      <header className="sticky top-0 z-20 bg-[#111C33]/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <StudentAvatar
              name={studentName || 'Siswa'}
              teamNumber={teamNumber}
              isCaptain={isCaptain}
              isConnected={connected}
              size="sm"
            />
            <div className="min-w-0">
              <div data-testid="student-name-header" className="text-sm font-extrabold text-white truncate">
                {studentName}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>{session.class_name}</span>
                <span>•</span>
                <span
                  data-testid="student-team-badge"
                  className={`font-extrabold ${isBlue ? 'text-blue-300' : 'text-rose-300'}`}
                >
                  {teamNumber ? `Kelompok ${teamNumber} (${isBlue ? 'Biru' : 'Merah'})` : 'Belum Ada Tim'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMuted(sfx.toggleMute())}
              aria-label={muted ? 'Aktifkan suara' : 'Bisukan suara'}
              className="p-2 rounded-xl bg-[#0B1120] border border-slate-800 text-slate-300 cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>
            <div
              data-testid="connection-indicator"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                connected ? 'bg-emerald-500/15 text-[#10B981]' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connected ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {errorMsg && (
          <div
            data-testid="play-error"
            className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold"
          >
            {errorMsg}
          </div>
        )}

        {/* Fallback Gacha if no team */}
        {!teamNumber && (
          <div className="rounded-3xl bg-[#111C33] border-2 border-slate-800 p-5">
            <GachaMachine spinning={gachaSpinning} onSpin={handleRunGachaFallback} result={null} />
          </div>
        )}

        {/* STUDENT LOBBY VIEW */}
        {teamNumber && session.status !== 'PLAYING' && session.status !== 'FINISHED' && (
          <div data-testid="student-lobby-view" className="space-y-4 animate-pop-in">
            <div
              className={`rounded-3xl p-5 border-2 space-y-3 ${
                isBlue ? 'bg-blue-950/40 border-[#2563EB]/60' : 'bg-rose-950/40 border-[#E11D48]/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Status Lobby</span>
                <span
                  data-testid="student-session-status"
                  className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#7C3AED] text-white"
                >
                  {session.status}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                Menunggu guru memulai permainan. Diskusikan strategi bersama anggota timmu!
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-2xl bg-[#111C33] border border-blue-500/40 text-center">
                  <div className="text-xs text-blue-300 font-bold">Tim Biru (K1)</div>
                  <div data-testid="lobby-t1-count" className="font-display text-2xl font-black text-white">
                    {teams.team1Count}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#111C33] border border-rose-500/40 text-center">
                  <div className="text-xs text-rose-300 font-bold">Tim Merah (K2)</div>
                  <div data-testid="lobby-t2-count" className="font-display text-2xl font-black text-white">
                    {teams.team2Count}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-[#111C33] border-2 border-slate-800 p-5 space-y-3">
              <h2 className="font-display text-base font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Anggota Kelompok {teamNumber}
              </h2>
              <div className="space-y-2">
                {myTeamMembers.map((m) => (
                  <div
                    key={m.student_id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-[#0B1120] border border-slate-800 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StudentAvatar
                        name={m.full_name}
                        teamNumber={teamNumber}
                        isCaptain={m.is_captain}
                        isConnected={m.is_connected}
                        size="sm"
                      />
                      <span className="text-slate-100 font-semibold truncate">{m.full_name}</span>
                    </div>
                    {m.is_captain && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
                        <Crown className="w-3 h-3" /> Kapten
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PLAYING VIEW: PROGRESS + QUESTION INTERFACE */}
        {teamNumber && session.status === 'PLAYING' && gameState && (
          <div data-testid="student-playing-view" className="space-y-4">
            {/* Game Progress Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-3.5 rounded-2xl border-2 transition ${
                  gameState.active_team === 1
                    ? 'bg-blue-950/60 border-[#3B82F6]'
                    : 'bg-[#111C33] border-slate-800'
                }`}
              >
                <div className="text-[11px] font-extrabold text-blue-300">TIM BIRU (K1)</div>
                <div className="font-display text-lg font-black text-white">
                  Petak {gameState.team1_pos}/{boardSize}
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6] transition-all duration-300"
                    style={{ width: `${Math.min(100, (gameState.team1_pos / boardSize) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] font-bold text-amber-400 mt-1">{gameState.team1_xp} XP</div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border-2 transition ${
                  gameState.active_team === 2
                    ? 'bg-rose-950/60 border-[#FB7185]'
                    : 'bg-[#111C33] border-slate-800'
                }`}
              >
                <div className="text-[11px] font-extrabold text-rose-300">TIM MERAH (K2)</div>
                <div className="font-display text-lg font-black text-white">
                  Petak {gameState.team2_pos}/{boardSize}
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#E11D48] transition-all duration-300"
                    style={{ width: `${Math.min(100, (gameState.team2_pos / boardSize) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] font-bold text-amber-400 mt-1">{gameState.team2_xp} XP</div>
              </div>
            </div>

            {!isMyTeamsTurn ? (
              <div
                data-testid="waiting-other-team"
                className="rounded-3xl bg-[#111C33] border-2 border-slate-800 p-8 text-center space-y-3"
              >
                <Clock className="w-11 h-11 text-slate-400 mx-auto animate-pulse" />
                <h2 className="font-display text-xl font-black text-white">
                  Giliran Kelompok {gameState.active_team}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Perhatikan papan permainan di proyektor kelas. Tim kamu akan bersiap pada giliran berikutnya!
                </p>
              </div>
            ) : (
              <div data-testid="active-team-panel" className="space-y-4">
                {gameState.answer_status === 'READY_TO_ROLL' && (
                  <div className="rounded-3xl bg-[#1A2744] border-2 border-purple-500/40 p-6 text-center space-y-2">
                    <h2 className="font-display text-lg font-black text-white">Giliran Kelompok Kamu!</h2>
                    <p className="text-xs text-slate-300">
                      Guru sedang bersiap melempar dadu di laptop. Pertanyaan muncul otomatis setelah dadu berhenti.
                    </p>
                  </div>
                )}

                {gameState.answer_status === 'AWAITING_ANSWER' && currentQuestion && (
                  <div className="rounded-3xl bg-[#111C33] border-2 border-[#3B82F6] p-5 space-y-4 animate-pop-in">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-[#7C3AED]/25 text-purple-200 font-bold">
                        Giliran #{gameState.turn_number} • {currentQuestion.topic}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0B1120] text-amber-400 font-black">
                        <Clock className="w-3.5 h-3.5" /> {secondsLeft}d
                      </span>
                    </div>

                    <h2 data-testid="question-text" className="font-display text-base font-extrabold text-white leading-snug">
                      {currentQuestion.question_text}
                    </h2>

                    <div className="space-y-2.5">
                      {Object.keys(currentQuestion.options).map((opt) => {
                        const isPicked = selectedOption === opt;
                        const voteCount = Object.values(gameState.proposed_answers).filter(
                          (p) => p.option === opt
                        ).length;
                        return (
                          <button
                            key={opt}
                            data-testid={`option-btn-${opt}`}
                            onClick={() => handlePropose(opt)}
                            className={`w-full min-h-[48px] text-left px-4 py-3 rounded-2xl border-2 text-sm transition cursor-pointer flex items-center justify-between gap-3 ${
                              isPicked
                                ? 'bg-[#2563EB]/25 border-[#3B82F6] text-white font-bold'
                                : 'bg-[#0B1120] border-slate-800 text-slate-200 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-display font-black text-xs ${
                                  isPicked ? 'bg-[#2563EB] text-white' : 'bg-[#1A2744] text-blue-300'
                                }`}
                              >
                                {opt}
                              </span>
                              <span className="pt-0.5">{currentQuestion.options[opt]}</span>
                            </div>
                            {voteCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-black shrink-0">
                                {voteCount} pilih
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {feedbackMsg && (
                      <div className="text-xs text-[#10B981] font-bold">{feedbackMsg}</div>
                    )}

                    {Object.values(gameState.proposed_answers).length > 0 && (
                      <div className="p-3 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400">Usulan Anggota Tim:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.values(gameState.proposed_answers).map((p) => (
                            <span
                              key={p.studentId}
                              className="text-xs px-2.5 py-1 rounded-full bg-[#1A2744] text-slate-200 font-semibold"
                            >
                              {p.fullName}: <strong className="text-amber-400">{p.option}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isCaptain ? (
                      <GameButton
                        variant="success"
                        size="lg"
                        fullWidth
                        disabled={!selectedOption}
                        onClick={handleSubmitFinal}
                        data-testid="submit-final-btn"
                      >
                        <Send className="w-4 h-4" /> Kirim Jawaban Final ({selectedOption || '-'})
                      </GameButton>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 text-center">
                        Kamu dapat mengusulkan jawaban. Jawaban final dikirim oleh Kapten:{' '}
                        <strong>{captainMember?.full_name || 'Kapten'}</strong>
                      </div>
                    )}
                  </div>
                )}

                {gameState.answer_status === 'ANSWERED' && (
                  <div
                    data-testid="answer-result-card"
                    className={`animate-pop-in rounded-3xl p-6 border-2 text-center space-y-2.5 ${
                      gameState.final_answer_correct
                        ? 'bg-emerald-500/15 border-[#10B981]'
                        : 'bg-rose-500/15 border-[#E11D48]'
                    }`}
                  >
                    {gameState.final_answer_correct ? (
                      <CheckCircle2 className="w-12 h-12 mx-auto text-[#10B981]" />
                    ) : (
                      <XCircle className="w-12 h-12 mx-auto text-[#E11D48]" />
                    )}
                    <div className="font-display text-xl font-black text-white">
                      {gameState.final_answer_correct ? 'Jawaban Benar!' : 'Jawaban Kurang Tepat'}
                    </div>
                    {currentQuestion?.explanation && (
                      <p className="text-xs text-slate-200 leading-relaxed">{currentQuestion.explanation}</p>
                    )}
                    <p className="text-xs text-slate-400 pt-1">Menunggu guru melanjutkan giliran...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FINISHED VIEW */}
        {session.status === 'FINISHED' && result && (
          <VictoryOverlay result={result} testId="student-game-result" />
        )}
      </main>
    </div>
  );
};
