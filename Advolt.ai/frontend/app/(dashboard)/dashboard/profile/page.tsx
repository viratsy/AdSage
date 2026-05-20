'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CreditCard, Zap, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const logout = useAuthStore((s) => s.logout);

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const upgrade = useMutation({
    mutationFn: () => billingApi.createOrder('pro').then((r) => r.data),
    onSuccess: (data) => {
      // Open Razorpay checkout
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: 'Advolt.ai',
        description: 'Pro Plan',
        theme: { color: '#6366f1' },
        handler: () => window.location.reload(),
      };
      // @ts-expect-error — Razorpay loaded via script tag
      new window.Razorpay(options).open();
    },
  });

  const isPro = billing?.subscription_plan === 'pro';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Profile & Settings</h1>

      {/* Plan card */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-indigo-400" />
            <span className="font-semibold text-sm">Current Plan</span>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              isPro ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {isPro ? 'Pro ✨' : 'Free'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Ads Saved</p>
            <p className="text-lg font-bold text-indigo-400">
              {isLoading ? '—' : `${billing?.ads_saved_count} / ${isPro ? 40 : 5}`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>AI Credits</p>
            <p className="text-lg font-bold text-yellow-400">
              {isLoading ? '—' : `${billing?.ai_credits} / ${isPro ? 40 : 5}`}
            </p>
          </div>
        </div>

        {!isPro && (
          <button
            onClick={() => upgrade.mutate()}
            disabled={upgrade.isPending}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)' }}
          >
            <Zap size={14} />
            {upgrade.isPending ? 'Loading…' : 'Upgrade to Pro'}
          </button>
        )}
      </div>

      {/* Logout */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
