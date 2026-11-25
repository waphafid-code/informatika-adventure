import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCheck, Search, Lock, Unlock, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api';
import { ClassItem, StudentItem } from '../types';
import { GameLogo } from '../components/ui/GameLogo';
import { GameButton } from '../components/ui/GameButton';
import { StudentAvatar } from '../components/ui/StudentAvatar';
import { GachaMachine } from '../components/ui/GachaMachine';

export const StudentJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<'CLASS_PICK' | 'NAME_PICK' | 'CONFIRM' | 'GACHA' | 'GACHA_RESULT'>('CLASS_PICK');
  const [sessionCodeFromQr] = useState(() => (searchParams.get('code') || '').toUpperCase());

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [nameFilter, setNameFilter] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [studentToken, setStudentToken] = useState<string | null>(() =>
    sessionStorage.getItem('student_token')
  );
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(() =>
    sessionStorage.getItem('student_session_id')
  );
  const [gachaSpinning, setGachaSpinning] = useState(false);
  const [gachaResult, setGachaResult] = useState<{ teamNumber: 1 | 2; isCaptain: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadClasses = useCallback(() => {
    apiFetch<{ classes: ClassItem[] }>('/api/classes')
      .then((res) => setClasses(res.classes))
      .catch(() => {});
  }, []);

  // Resume existing session on page refresh
  useEffect(() => {
    if (studentToken && joinedSessionId) {
      apiFetch<{ teamNumber: 1 | 2 | null; isCaptain: boolean }>(
        `/api/sessions/${joinedSessionId}/me`,
        {},
        studentToken
      )
        .then((me) => {
          if (me.teamNumber) {
            navigate(`/play/${joinedSessionId}`, { replace: true });
          } else {
            setStep('GACHA');
          }
        })
        .catch(() => {
          sessionStorage.removeItem('student_token');
          sessionStorage.removeItem('student_session_id');
          setStudentToken(null);
          setJoinedSessionId(null);
        });
    }
  }, []);

  // Optional QR code support if opened via ?code=
  useEffect(() => {
    if (sessionCodeFromQr.length === 6) {
      apiFetch<{ session: { class_id: string } }>(`/api/sessions/lookup/${sessionCodeFromQr}`)
        .then((res) => {
          setSelectedClassId(res.session.class_id);
          setStep('NAME_PICK');
        })
        .catch(() => {});
    }
  }, [sessionCodeFromQr]);

  useEffect(() => {
    loadClasses();
    if (step !== 'CLASS_PICK') return;
    const timer = setInterval(loadClasses, 3000);
    return () => clearInterval(timer);
  }, [step, loadClasses]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    apiFetch<{ students: StudentItem[] }>(`/api/classes/${selectedClassId}/students`)
      .then((res) => setStudents(res.students))
      .catch(() => {});
  }, [selectedClassId]);

  function handleSelectClass(cls: ClassItem) {
    setErrorMsg('');
    if (!cls.is_unlocked) {
      setErrorMsg(`Kelas ${cls.name} sedang dikunci oleh Guru.`);
      return;
    }
    setSelectedClassId(cls.id);
    setSelectedStudentId('');
    setNameFilter('');
    setStep('NAME_PICK');
  }

  function handleToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedClassId || !selectedStudentId) {
      setErrorMsg('Pilih nama Anda terlebih dahulu.');
      return;
    }
    setStep('CONFIRM');
  }

  async function handleJoinSession() {
    if (!selectedClassId || !selectedStudentId) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; sessionId: string }>('/api/sessions/join', {
        method: 'POST',
        body: JSON.stringify({
          ...(sessionCodeFromQr ? { sessionCode: sessionCodeFromQr } : {}),
          classId: selectedClassId,
          studentId: selectedStudentId,
        }),
      });
      sessionStorage.setItem('student_token', res.token);
      sessionStorage.setItem('student_session_id', res.sessionId);
      setStudentToken(res.token);
      setJoinedSessionId(res.sessionId);
      setStep('GACHA');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunGacha() {
    if (!studentToken || !joinedSessionId) return;
    setErrorMsg('');
    setGachaSpinning(true);
    try {
      const res = await apiFetch<{ teamNumber: 1 | 2; isCaptain: boolean }>(
        `/api/sessions/${joinedSessionId}/gacha`,
        { method: 'POST' },
        studentToken
      );
      setTimeout(() => {
        setGachaSpinning(false);
        setGachaResult({ teamNumber: res.teamNumber, isCaptain: res.isCaptain });
        setStep('GACHA_RESULT');
      }, 650);
    } catch (err: any) {
      setGachaSpinning(false);
      setErrorMsg(err.message);
    }
  }

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(nameFilter.trim().toLowerCase())
  );
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#162033] border-2 border-slate-800 p-6 space-y-6">
        <div className="flex justify-center">
          <GameLogo size="sm" />
        </div>

        {errorMsg && (
          <div
            data-testid="join-error"
            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold"
          >
            {errorMsg}
          </div>
        )}

        {/* STEP 1: PILIH KELAS (TERBUKA / TERKUNCI) */}
        {step === 'CLASS_PICK' && (
          <div className="space-y-4 animate-pop-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-black text-white">Pilih Kelas</h1>
                <p className="text-xs text-slate-400">Pilih kelas yang sudah dibuka kuncinya oleh Guru</p>
              </div>
              <button
                type="button"
                onClick={loadClasses}
                aria-label="Muat ulang status kelas"
                className="p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-slate-300 hover:border-slate-500 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {classes.map((cls) => {
                const unlocked = Boolean(cls.is_unlocked);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    data-testid={`pick-class-${cls.id}`}
                    disabled={!unlocked}
                    onClick={() => handleSelectClass(cls)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-colors ${
                      unlocked
                        ? 'bg-[#0F172A] border-[#10B981] hover:bg-[#1E293B] cursor-pointer'
                        : 'bg-[#0F172A]/60 border-slate-800 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="font-display text-lg font-black text-white">Kelas {cls.name}</div>
                      <div className="text-xs text-slate-400">
                        {unlocked
                          ? `${cls.participant_count || 0} siswa sudah bergabung`
                          : 'Terkunci oleh Guru'}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 ${
                        unlocked
                          ? 'bg-[#10B981] text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" /> Masuk
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" /> Terkunci
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: SEARCHABLE NAMA SISWA */}
        {step === 'NAME_PICK' && (
          <form onSubmit={handleToConfirm} className="space-y-4 animate-pop-in">
            <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 text-xs text-slate-300 flex justify-between items-center">
              <span>Kelas Dipilih</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#2563EB] text-white font-bold">
                {selectedClass?.name || selectedClassId}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Cari &amp; Pilih Nama Anda ({filteredStudents.length} siswa)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Ketik nama untuk menyaring..."
                  className="w-full rounded-xl bg-[#0F172A] border border-slate-700 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <select
                data-testid="select-student-name"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border-2 border-slate-700 px-3.5 py-3 text-sm text-white font-semibold"
                required
              >
                <option value="">-- Pilih Nama Anda --</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <GameButton type="button" variant="ghost" onClick={() => setStep('CLASS_PICK')}>
                Ganti Kelas
              </GameButton>
              <GameButton type="submit" variant="primary" fullWidth data-testid="to-confirm-btn">
                Konfirmasi Nama
              </GameButton>
            </div>
          </form>
        )}

        {/* STEP 3: KONFIRMASI IDENTITAS */}
        {step === 'CONFIRM' && selectedStudent && (
          <div className="space-y-5 animate-pop-in">
            <div className="p-4 rounded-xl bg-[#0F172A] border-2 border-[#2563EB] flex items-center gap-4">
              <StudentAvatar name={selectedStudent.full_name} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-blue-400 text-[11px] font-extrabold uppercase">
                  <UserCheck className="w-3.5 h-3.5" /> Konfirmasi Identitas
                </div>
                <div className="font-display text-lg font-black text-white truncate">
                  {selectedStudent.full_name}
                </div>
                <div className="text-xs text-slate-400">
                  Kelas <strong className="text-slate-200">{selectedClass?.name}</strong> • ID {selectedStudent.nisn}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Satu identitas siswa hanya dapat bergabung satu kali dalam sesi ini. Pastikan nama di atas benar-benar Anda.
            </p>

            <div className="flex gap-2">
              <GameButton type="button" variant="ghost" onClick={() => setStep('NAME_PICK')}>
                Ganti
              </GameButton>
              <GameButton
                variant="success"
                fullWidth
                disabled={loading}
                onClick={handleJoinSession}
                data-testid="confirm-join-btn"
              >
                {loading ? 'Bergabung...' : 'Gabung Sekarang'}
              </GameButton>
            </div>
          </div>
        )}

        {/* STEP 4: GACHA MACHINE & TEAM REVEAL */}
        {(step === 'GACHA' || step === 'GACHA_RESULT') && joinedSessionId && (
          <GachaMachine
            spinning={gachaSpinning}
            onSpin={handleRunGacha}
            result={gachaResult}
            onContinue={() => navigate(`/play/${joinedSessionId}`)}
          />
        )}
      </div>
    </div>
  );
};
