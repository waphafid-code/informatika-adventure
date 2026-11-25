import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, ArrowRight, Users } from 'lucide-react';
import { GameState, Question } from '../../types';
import { GameButton } from './GameButton';

interface QuestionModalProps {
  question: Question;
  gameState: GameState;
  onNextTurn: () => void;
  onDemoAnswer?: (option?: string) => void;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  question,
  gameState,
  onNextTurn,
  onDemoAnswer,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(45);
  const isAnswered = gameState.answer_status === 'ANSWERED';
  const isTeam1 = gameState.active_team === 1;

  useEffect(() => {
    setSecondsLeft(45);
  }, [question.id, gameState.turn_number]);

  useEffect(() => {
    if (isAnswered) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAnswered]);

  const proposals = Object.values(gameState.proposed_answers || {});

  return (
    <div
      data-testid="teacher-question-modal"
      className="fixed inset-0 z-40 bg-[#0B1120]/90 flex items-center justify-center p-4 sm:p-6"
    >
      <div className="animate-pop-in w-full max-w-4xl rounded-2xl bg-[#162033] border-2 border-slate-700 overflow-hidden">
        <div
          className={`px-6 py-4 flex flex-wrap items-center justify-between gap-3 ${isTeam1 ? 'bg-[#2563EB]' : 'bg-[#E11D48]'
            }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-display font-black text-lg sm:text-xl text-white">
              Giliran Kelompok {gameState.active_team} ({isTeam1 ? 'Tim Biru' : 'Tim Merah'})
            </span>
            <span className="px-3 py-1 rounded-lg bg-black/25 text-white text-xs font-bold">
              {question.topic}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
              +{question.xp_reward} XP
            </span>
            {!isAnswered && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black ${secondsLeft <= 10 ? 'bg-rose-950 text-rose-200' : 'bg-black/30 text-white'
                  }`}
              >
                <Clock className="w-4 h-4" /> {secondsLeft}d
              </span>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-snug">
            {question.question_text}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.keys(question.options).map((opt) => {
              const isFinal = gameState.final_answer_option === opt;
              const isCorrect = question.correct_option === opt;
              let cardStyle = 'bg-[#0F172A] border-slate-700 text-slate-100';

              if (isAnswered) {
                if (isCorrect) {
                  cardStyle = 'bg-emerald-950/60 border-[#10B981] text-emerald-100';
                } else if (isFinal && !gameState.final_answer_correct) {
                  cardStyle = 'bg-rose-950/60 border-[#E11D48] text-rose-100';
                } else {
                  cardStyle = 'bg-[#0F172A]/60 border-slate-800 text-slate-400';
                }
              }

              return (
                <div
                  key={opt}
                  className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-colors ${cardStyle}`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-display font-black text-sm ${isAnswered && isCorrect
                        ? 'bg-[#10B981] text-slate-950'
                        : 'bg-[#1E293B] text-slate-200'
                      }`}
                  >
                    {opt}
                  </span>
                  <span className="text-sm sm:text-base font-semibold leading-snug pt-0.5">
                    {question.options[opt]}
                  </span>
                </div>
              );
            })}
          </div>

          {proposals.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 mr-2">
                <Users className="w-4 h-4 text-blue-400" /> Usulan Siswa:
              </span>
              {proposals.map((p) => (
                <span
                  key={p.studentId}
                  className="px-3 py-1 rounded-lg bg-[#1E293B] border border-slate-700 text-xs font-bold text-white"
                >
                  {p.fullName}: <span className="text-amber-400">{p.option}</span>
                </span>
              ))}
            </div>
          )}

          {isAnswered ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#0F172A] border border-slate-700">
              <div className="flex items-center gap-3">
                {gameState.final_answer_correct ? (
                  <CheckCircle2 className="w-9 h-9 text-[#10B981] shrink-0" />
                ) : (
                  <XCircle className="w-9 h-9 text-[#E11D48] shrink-0" />
                )}
                <div>
                  <div className="font-display font-black text-lg text-white">
                    {gameState.final_answer_correct
                      ? `Jawaban Benar (+${question.xp_reward} XP untuk Kelompok ${gameState.final_answer_team})`
                      : `Jawaban Kurang Tepat (Kunci: ${question.correct_option})`}
                  </div>
                  {question.explanation && (
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{question.explanation}</p>
                  )}
                </div>
              </div>

              <GameButton
                variant="purple"
                size="lg"
                onClick={onNextTurn}
                data-testid="next-turn-btn"
                className="shrink-0"
              >
                Giliran Berikutnya <ArrowRight className="w-5 h-5" />
              </GameButton>
            </div>
          ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="text-sm text-slate-400 font-medium">
                  Menunggu Kapten Kelompok {gameState.active_team} mengirim jawaban final.
                </div>
                {onDemoAnswer && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase text-amber-400">Demo:</span>
                    {Object.keys(question.options).map((opt) => (
                      <button
                        key={`demo-${opt}`}
                        type="button"
                        data-testid={`demo-answer-${opt}`}
                        onClick={() => onDemoAnswer(opt)}
                        className="px-3 py-1.5 rounded-lg bg-[#0F172A] border border-slate-700 hover:border-amber-400 text-xs font-extrabold text-white cursor-pointer"
                      >
                        Jawab {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
          )}
            </div>
      </div>
      </div>
      );
};
