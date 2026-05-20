'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';

const QUESTIONS = [
  { key: 'niche', label: 'What is your business or niche?', placeholder: 'e.g. Dental clinic, Online coaching, SaaS tool...', type: 'text' },
  { key: 'target_customer', label: 'Who is your ideal customer?', placeholder: 'e.g. Working professionals aged 25-40...', type: 'text' },
  { key: 'product_service', label: 'What is your main product or service?', placeholder: 'e.g. Painless dental treatments, 1:1 coaching...', type: 'text' },
  { key: 'pain_point', label: "What problem do you solve for customers?", placeholder: 'e.g. Fear of dentists, Struggling to get clients...', type: 'text' },
  { key: 'price_range', label: 'What is your price range?', placeholder: 'e.g. 500-2000 per visit, 29/month...', type: 'price' },
  { key: 'location', label: 'Where do you serve customers?', placeholder: 'e.g. Mumbai, Pan-India, Global...', type: 'text' },
];

const CURRENCIES = ['₹ INR', '$ USD', '€ EUR', '£ GBP', 'AED', 'A$ AUD', 'S$ SGD'];

type Phase = 'questions' | 'generating' | 'review' | 'follow_up' | 'saving' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>('questions');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState('₹ INR');
  const [persona, setPersona] = useState<Record<string, unknown> | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState('');
  const [error, setError] = useState('');

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  // ─── Phase: Questions ──────────────────────────────────────────────────────
  const handleNext = () => {
    if (!answers[current.key]?.trim()) { setError('Please fill this in.'); return; }
    setError('');
    if (isLast) {
      // Prepend currency to price_range
      const finalAnswers = { ...answers };
      if (finalAnswers.price_range && !finalAnswers.price_range.includes(currency.split(' ')[0])) {
        finalAnswers.price_range = `${currency.split(' ')[0]}${finalAnswers.price_range}`;
      }
      generatePersona(finalAnswers);
    } else {
      setStep(step + 1);
    }
  };

  // ─── Phase: Generate Persona ───────────────────────────────────────────────
  const generatePersona = async (ans: Record<string, string>) => {
    setPhase('generating');
    try {
      const { data } = await profileApi.generatePersona(ans);
      setPersona(data.persona);
      if (data.needs_follow_up) {
        setPhase('follow_up');
      } else {
        setPhase('review');
      }
    } catch {
      setError('AI generation failed. Please try again.');
      setPhase('questions');
    }
  };

  // ─── Phase: Follow-up ──────────────────────────────────────────────────────
  const handleFollowUp = () => {
    if (!followUpAnswers.trim()) { setError('Please answer the questions above.'); return; }
    setError('');
    generatePersona({ ...answers, follow_up_answers: followUpAnswers });
  };

  // ─── Phase: Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setPhase('saving');
    try {
      await profileApi.savePersona(answers, persona!);
      qc.invalidateQueries({ queryKey: ['billing'] });
      setPhase('done');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch {
      setError('Failed to save. Please try again.');
      setPhase('review');
    }
  };

  const handleSkip = () => router.push('/dashboard');

  const refined = persona?.refined_profile as Record<string, string> | undefined;
  const followUpQs = persona?.follow_up_questions as string[] | undefined;
  const suggestions = persona?.suggestions as string[] | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap size={20} className="text-indigo-400" />
            <span className="font-bold text-indigo-400 text-lg">Advolt.ai</span>
          </div>
          <h1 className="text-xl font-bold">
            {phase === 'questions' && 'Tell us about your business'}
            {phase === 'generating' && 'AI is analyzing your business...'}
            {phase === 'follow_up' && 'A few more details needed'}
            {phase === 'review' && 'Your Business Persona'}
            {phase === 'saving' && 'Saving...'}
            {phase === 'done' && 'All set!'}
          </h1>
        </div>

        {/* ─── Questions Phase ─────────────────────────────────────────────── */}
        {phase === 'questions' && (
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-1 rounded-full mb-4" style={{ background: 'var(--border)' }}>
              <div className="h-1 rounded-full bg-indigo-500 transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step + 1} of {QUESTIONS.length}</p>
            <h2 className="text-sm font-semibold">{current.label}</h2>
            {current.type === 'price' ? (
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <textarea
                  rows={2}
                  placeholder={current.placeholder}
                  value={answers[current.key] || ''}
                  onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus
                />
              </div>
            ) : (
              <textarea
                rows={2}
                placeholder={current.placeholder}
                value={answers[current.key] || ''}
                onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                autoFocus
              />
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Back</button>
              )}
              <button onClick={handleNext} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                {isLast ? 'Generate Persona →' : 'Next →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Generating Phase ────────────────────────────────────────────── */}
        {phase === 'generating' && (
          <div className="rounded-xl p-10 text-center space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Loader2 size={32} className="text-indigo-400 mx-auto animate-spin" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI is creating your business persona...</p>
          </div>
        )}

        {/* ─── Follow-up Phase ─────────────────────────────────────────────── */}
        {phase === 'follow_up' && followUpQs && (
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI needs a bit more context to create an accurate persona:</p>
            <ul className="space-y-2">
              {followUpQs.map((q, i) => (
                <li key={i} className="text-sm font-medium">• {q}</li>
              ))}
            </ul>
            <textarea
              rows={4}
              placeholder="Answer the questions above..."
              value={followUpAnswers}
              onChange={(e) => setFollowUpAnswers(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPhase('review')} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Skip</button>
              <button onClick={handleFollowUp} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Refine Persona →</button>
            </div>
          </div>
        )}

        {/* ─── Review Phase ────────────────────────────────────────────────── */}
        {phase === 'review' && persona && (
          <div className="space-y-4">
            {/* Persona summary */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Your Business Persona</p>
              <p className="text-sm leading-relaxed">{persona.persona_summary as string}</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-1.5 flex-1 rounded-full bg-gray-800">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${persona.confidence_score as number}%` }} />
                </div>
                <span className="text-xs text-indigo-400">{persona.confidence_score as number}% confidence</span>
              </div>
            </div>

            {/* Refined profile */}
            {refined && (
              <div className="rounded-xl p-5 grid grid-cols-2 gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {Object.entries(refined).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-medium">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {suggestions && suggestions.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>💡 Positioning Suggestions</p>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => (
                    <li key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setPhase('questions'); setStep(0); }} className="px-4 py-2.5 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>
                Edit Answers
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--accent)' }}>
                <CheckCircle size={14} /> Confirm &amp; Save Persona
              </button>
            </div>
          </div>
        )}

        {/* ─── Saving / Done ───────────────────────────────────────────────── */}
        {phase === 'saving' && (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Loader2 size={24} className="text-indigo-400 mx-auto animate-spin" />
          </div>
        )}
        {phase === 'done' && (
          <div className="rounded-xl p-10 text-center space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <CheckCircle size={32} className="text-green-400 mx-auto" />
            <p className="text-sm font-semibold">Persona saved! Redirecting...</p>
          </div>
        )}

        {phase === 'questions' && (
          <button onClick={handleSkip} className="w-full text-center text-xs mt-4 hover:text-white" style={{ color: 'var(--text-muted)' }}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
