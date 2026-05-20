'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Zap } from 'lucide-react';

const STEPS = [
  {
    key: 'niche',
    label: 'What is your business or niche?',
    placeholder: 'e.g. Dental clinic, Online coaching, SaaS tool, E-commerce fashion...',
    hint: 'Be specific — this helps AI generate content for your exact industry.',
  },
  {
    key: 'target_customer',
    label: 'Who is your ideal customer?',
    placeholder: 'e.g. Working professionals aged 25-40 in metro cities...',
    hint: 'Describe their age, job, lifestyle, or any relevant traits.',
  },
  {
    key: 'product_service',
    label: 'What is your main product or service?',
    placeholder: 'e.g. Painless dental treatments, 1:1 business coaching, Project management app...',
    hint: 'What do you sell or offer?',
  },
  {
    key: 'pain_point',
    label: "What is your customer's biggest pain point?",
    placeholder: 'e.g. Fear of dentists, Struggling to get clients, Team productivity issues...',
    hint: 'The problem your business solves.',
  },
  {
    key: 'price_range',
    label: 'What is your price range?',
    placeholder: 'e.g. ₹500-2000 per visit, ₹50,000 for 3-month program, $29/month...',
    hint: 'Helps calibrate tone — premium vs accessible.',
  },
  {
    key: 'location',
    label: 'Where is your business based or who do you serve?',
    placeholder: 'e.g. Mumbai, India | Pan-India | Global English-speaking market...',
    hint: 'Location helps localize the generated content.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = async () => {
    if (!answers[current.key]?.trim()) {
      setError('Please fill in this field before continuing.');
      return;
    }
    setError('');

    if (isLast) {
      setSaving(true);
      try {
        await profileApi.updateBusiness(answers);
        qc.invalidateQueries({ queryKey: ['billing'] });
        router.push('/dashboard');
      } catch {
        setError('Failed to save. Please try again.');
      } finally {
        setSaving(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => router.push('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap size={20} className="text-indigo-400" />
            <span className="font-bold text-indigo-400 text-lg">Advolt.ai</span>
          </div>
          <h1 className="text-xl font-bold mb-1">Set up your business profile</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            AI will use this to generate content tailored to your business — not the ads you save.
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-8" style={{ background: 'var(--border)' }}>
          <div
            className="h-1 rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step */}
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-base font-semibold">{current.label}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{current.hint}</p>
          </div>

          <textarea
            rows={3}
            placeholder={current.placeholder}
            value={answers[current.key] || ''}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            autoFocus
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                style={{ border: '1px solid var(--border)' }}
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : isLast ? 'Finish Setup' : 'Next →'}
            </button>
          </div>
        </div>

        <button
          onClick={handleSkip}
          className="w-full text-center text-xs mt-4 hover:text-white transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Skip for now — I&apos;ll set this up later in Profile
        </button>
      </div>
    </div>
  );
}
