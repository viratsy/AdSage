'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';

const CURRENCIES = ['₹', '$', '€', '£', 'AED', 'A$', 'S$'];

const NICHE_OPTIONS = [
  'E-commerce', 'SaaS / Software', 'Coaching / Consulting', 'Education / EdTech',
  'Healthcare / Dental / Medical', 'Real Estate', 'Finance / Insurance',
  'Food & Restaurant', 'Fitness / Wellness', 'Agency / Marketing',
  'Local Business / Services', 'Other',
];

const AUDIENCE_OPTIONS = [
  'Students (18-24)', 'Young Professionals (25-34)', 'Working Adults (35-50)',
  'Business Owners / Entrepreneurs', 'Parents / Families', 'Senior Professionals (50+)',
  'Freelancers / Creators', 'Other',
];

const PRICE_OPTIONS = [
  'Under ₹500 / $10', '₹500 - ₹2,000 / $10-$30', '₹2,000 - ₹10,000 / $30-$150',
  '₹10,000 - ₹50,000 / $150-$700', '₹50,000+ / $700+', 'Subscription / Monthly',
];

const QUESTIONS = [
  { key: 'niche', label: 'What is your business or niche?', type: 'select', options: NICHE_OPTIONS, placeholder: 'Or type your own...' },
  { key: 'target_customer', label: 'Who is your ideal customer?', type: 'select', options: AUDIENCE_OPTIONS, placeholder: 'Or describe in detail...' },
  { key: 'product_service', label: 'What is your main product or service?', type: 'text', placeholder: 'e.g. Painless dental treatments, 1:1 business coaching, Project management app...' },
  { key: 'pain_point', label: 'What problem do you solve for customers?', type: 'text', placeholder: 'e.g. Fear of dentists, Struggling to get clients, Team productivity issues...' },
  { key: 'price_range', label: 'What is your price range?', type: 'price', options: PRICE_OPTIONS, placeholder: 'Or enter custom amount...' },
  { key: 'location', label: 'Where do you serve customers?', type: 'text', placeholder: 'e.g. Mumbai, Pan-India, Global, US & UK...' },
];

type Phase = 'questions' | 'generating' | 'review' | 'follow_up' | 'saving' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>('questions');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState('₹');
  const [customInput, setCustomInput] = useState('');
  const [persona, setPersona] = useState<Record<string, unknown> | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState('');
  const [error, setError] = useState('');

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  const selectOption = (value: string) => {
    if (value === 'Other') {
      setCustomInput('');
    } else {
      setAnswers({ ...answers, [current.key]: value });
      setCustomInput('');
    }
  };

  const getValue = () => answers[current.key] || '';

  const handleNext = () => {
    const val = customInput || answers[current.key];
    if (!val?.trim()) { setError('Please select or type an answer.'); return; }
    setError('');

    // Save custom input if used
    if (customInput) setAnswers({ ...answers, [current.key]: customInput });

    // For price, prepend currency
    if (current.key === 'price_range' && customInput) {
      setAnswers({ ...answers, price_range: `${currency}${customInput}` });
    }

    if (isLast) {
      const finalAnswers = { ...answers };
      if (customInput && current.key === 'price_range') {
        finalAnswers.price_range = `${currency}${customInput}`;
      } else if (customInput) {
        finalAnswers[current.key] = customInput;
      }
      generatePersona(finalAnswers);
    } else {
      setStep(step + 1);
      setCustomInput('');
    }
  };

  const generatePersona = async (ans: Record<string, string>) => {
    setPhase('generating');
    try {
      const { data } = await profileApi.generatePersona(ans);
      setPersona(data.persona);
      setPhase(data.needs_follow_up ? 'follow_up' : 'review');
    } catch {
      setError('AI generation failed. Please try again.');
      setPhase('questions');
    }
  };

  const handleFollowUp = () => {
    if (!followUpAnswers.trim()) { setError('Please answer the questions.'); return; }
    setError('');
    generatePersona({ ...answers, follow_up_answers: followUpAnswers });
  };

  const handleSave = async () => {
    setPhase('saving');
    try {
      await profileApi.savePersona(answers, persona!);
      qc.invalidateQueries({ queryKey: ['billing'] });
      setPhase('done');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch {
      setError('Failed to save.');
      setPhase('review');
    }
  };

  const refined = persona?.refined_profile as Record<string, string> | undefined;
  const followUpQs = persona?.follow_up_questions as string[] | undefined;
  const suggestions = persona?.suggestions as string[] | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap size={20} className="text-indigo-400" />
            <span className="font-bold text-indigo-400 text-lg">Advolt.ai</span>
          </div>
          <h1 className="text-xl font-bold">
            {phase === 'questions' && 'Tell us about your business'}
            {phase === 'generating' && 'AI is analyzing...'}
            {phase === 'follow_up' && 'A few more details'}
            {phase === 'review' && 'Your Business Persona'}
            {phase === 'saving' && 'Saving...'}
            {phase === 'done' && 'All set!'}
          </h1>
        </div>

        {/* Questions */}
        {phase === 'questions' && (
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-1 rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-1 rounded-full bg-indigo-500 transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step + 1} of {QUESTIONS.length}</p>
            <h2 className="text-sm font-semibold">{current.label}</h2>

            {/* Select options */}
            {current.options && (
              <div className="flex flex-wrap gap-2">
                {current.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => selectOption(opt)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      getValue() === opt ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500' : 'hover:bg-white/5'
                    }`}
                    style={{ border: '1px solid var(--border)', color: getValue() === opt ? undefined : 'var(--text-muted)' }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Price with currency */}
            {current.type === 'price' && (
              <div className="flex gap-2 items-center">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2.5 rounded-lg text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="e.g. 500-2000 per visit"
                  value={customInput}
                  onChange={(e) => { setCustomInput(e.target.value); setAnswers({ ...answers, price_range: '' }); }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            )}

            {/* Custom text input for select types */}
            {current.type === 'select' && (
              <input
                type="text"
                placeholder={current.placeholder}
                value={customInput}
                onChange={(e) => { setCustomInput(e.target.value); setAnswers({ ...answers, [current.key]: '' }); }}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            )}

            {/* Plain text input */}
            {current.type === 'text' && (
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
              {step > 0 && <button onClick={() => { setStep(step - 1); setCustomInput(''); }} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Back</button>}
              <button onClick={handleNext} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                {isLast ? 'Generate Persona →' : 'Next →'}
              </button>
            </div>
          </div>
        )}

        {/* Generating */}
        {phase === 'generating' && (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Loader2 size={32} className="text-indigo-400 mx-auto animate-spin" />
            <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>Creating your business persona...</p>
          </div>
        )}

        {/* Follow-up */}
        {phase === 'follow_up' && followUpQs && (
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI needs more context:</p>
            <ul className="space-y-2">{followUpQs.map((q, i) => <li key={i} className="text-sm">• {q}</li>)}</ul>
            <textarea rows={4} placeholder="Answer here..." value={followUpAnswers} onChange={(e) => setFollowUpAnswers(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPhase('review')} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Skip</button>
              <button onClick={handleFollowUp} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Refine →</button>
            </div>
          </div>
        )}

        {/* Review */}
        {phase === 'review' && persona && (
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Your Business Persona</p>
              <p className="text-sm leading-relaxed">{persona.persona_summary as string}</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-1.5 flex-1 rounded-full bg-gray-800"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${persona.confidence_score as number}%` }} /></div>
                <span className="text-xs text-indigo-400">{persona.confidence_score as number}%</span>
              </div>
            </div>
            {refined && (
              <div className="rounded-xl p-5 grid grid-cols-2 gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {Object.entries(refined).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                  </div>
                ))}
              </div>
            )}
            {suggestions && suggestions.length > 0 && (
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>💡 Suggestions</p>
                {suggestions.map((s, i) => <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>• {s}</p>)}
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setPhase('questions'); setStep(0); }} className="px-4 py-2.5 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Edit</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--accent)' }}>
                <CheckCircle size={14} /> Confirm Persona
              </button>
            </div>
          </div>
        )}

        {phase === 'saving' && <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><Loader2 size={24} className="text-indigo-400 mx-auto animate-spin" /></div>}
        {phase === 'done' && <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><CheckCircle size={32} className="text-green-400 mx-auto" /><p className="text-sm font-semibold mt-2">Persona saved!</p></div>}

        {phase === 'questions' && <button onClick={() => router.push('/dashboard')} className="w-full text-center text-xs mt-4 hover:text-white" style={{ color: 'var(--text-muted)' }}>Skip for now</button>}
      </div>
    </div>
  );
}
