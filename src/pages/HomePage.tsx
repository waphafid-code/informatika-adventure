import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  ShieldCheck,
  Gamepad2,
  Lock,
  Unlock,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ArrowRight,
  Users,
} from 'lucide-react';
import { apiFetch } from '../api';
import { ClassItem } from '../types';
import { GameLogo } from '../components/ui/GameLogo';
import { GameBoard } from '../components/GameBoard';
import { GameButton } from '../components/ui/GameButton';

export const HomePage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<'classes' | 'board'>('classes');
  const [classes, setClasses] = useState<ClassItem[]>([]);

  function fetchClasses() {
    apiFetch<{ classes: ClassItem[] }>('/api/classes')
      .then((res) => setClasses(res.classes))
      .catch(() => {});
  }

  useEffect(() => {
    fetchClasses();
    const timer = setInterval(fetchClasses, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between bg-[#162033] border-r border-slate-800 p-4">
          <div className="space-y-6">
            <div className="px-2 pt-1">
              <GameLogo size="sm" />
            </div>

            <nav className="space-y-1.5">
              <button
                onClick={() => setActiveView('classes')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
                  activeView === 'classes'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                <Users className="w-4 h-4" /> Gabung Kelas
              </button>

              <button
                onClick={() => setActiveView('board')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
                  activeView === 'board'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                <Gamepad2 className="w-4 h-4" /> Papan Ular Tangga
              </button>
            </nav>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <Link
              to="/teacher"
              data-testid="sidebar-teacher-btn"
              className="w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl bg-[#0F172A] border-2 border-slate-700 hover:border-[#2563EB] text-sm font-extrabold text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Dashboard Guru
              </span>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </Link>
          </div>
        </aside>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-[#162033] px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Tutup Panel' : 'Buka Panel'}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] border border-slate-700 hover:border-slate-500 text-xs font-bold text-slate-200 cursor-pointer"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              <span>{sidebarOpen ? 'Tutup Panel' : 'Buka Panel'}</span>
            </button>
            <div className="md:hidden">
              <GameLogo size="sm" />
            </div>
            <span className="hidden sm:inline text-sm font-bold text-slate-300">
              Dashboard Peserta • Informatika Kelas XI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/teacher"
              data-testid="enter-teacher-btn"
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F172A] border border-slate-700 text-xs font-bold text-white"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Guru
            </Link>
            <Link to="/join" data-testid="enter-student-btn">
              <GameButton variant="warning" size="sm">
                <Smartphone className="w-4 h-4" /> Masuk Siswa
              </GameButton>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
          {activeView === 'classes' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-black text-white">Selamat Datang di Informatika Adventure</h1>
                  <p className="text-sm text-slate-400 mt-1">
                    Pilih kelas yang sudah dibuka kuncinya oleh Guru untuk bergabung dan bermain bersama tim.
                  </p>
                </div>
                <button
                  onClick={fetchClasses}
                  aria-label="Muat ulang daftar kelas"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] border border-slate-700 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => {
                  const unlocked = Boolean(cls.is_unlocked);
                  return (
                    <div
                      key={cls.id}
                      className={`rounded-2xl p-5 border-2 bg-[#162033] flex flex-col justify-between gap-4 ${
                        unlocked ? 'border-[#10B981]' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl font-black text-white">Kelas {cls.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {unlocked
                              ? `${cls.participant_count || 0} siswa sudah bergabung`
                              : 'Menunggu Guru membuka kunci kelas'}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold ${
                            unlocked ? 'bg-[#10B981] text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {unlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {unlocked ? 'Terbuka' : 'Terkunci'}
                        </span>
                      </div>

                      <Link to="/join">
                        <GameButton variant={unlocked ? 'success' : 'ghost'} fullWidth disabled={!unlocked}>
                          {unlocked ? (
                            <>
                              Gabung Kelas {cls.name} <ArrowRight className="w-4 h-4" />
                            </>
                          ) : (
                            'Kelas Sedang Terkunci'
                          )}
                        </GameButton>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeView === 'board' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#162033] border-2 border-slate-800 p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-black text-white">Papan Ular Tangga (100 Petak)</h2>
                  <p className="text-xs text-slate-400">Pratinjau papan permainan kelas Informatika.</p>
                </div>
                <Link to="/join">
                  <GameButton variant="primary" size="sm">
                    Gabung Permainan
                  </GameButton>
                </Link>
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
        </main>
      </div>
    </div>
  );
};
