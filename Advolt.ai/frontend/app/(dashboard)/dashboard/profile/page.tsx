'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, profileApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CreditCard, Zap, LogOut, ShoppingCart, User, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_PACKS = [
  { id: 'starter', tokens: '1,000', price: '₹99', label: 'Starter' },
  { id: 'growth', tokens: '5,000', price: '₹399', label: 'Growth' },
  { id: 'pro_pack', tokens: '15,000', price: '₹999', label: 'Pro Pack' },
];

export default function ProfilePage() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const qc = useQueryClient();
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState(false);
  const [personaText, setPersonaText] = useState('');

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const upgradeSub = useMutation({
    mutationFn: () => billingApi.createOrder({ purchase_type: 'subscription' }).then((r) => r.data),
    onSuccess: openRazorpay,
  });

  const buyTokens = useMutation({
    mutationFn: (pack_id: string) => billingApi.createOrder({ purchase_type: 'token_pack', pack_id }).then((r) => r.data),
    onSuccess: (data) => { setBuyingPack(null); openRazorpay(data); },
  });

  function openRazorpay(data: { key: string; order_id: string; amount: number; currency: string; label: string }) {
    const options = {
      key: data.key,
      amount: data.amount,
      currency: data.currency,
      order_id: data.order_id,
      name: 'Advolt.ai',
      description: data.label,
      theme: { color: '#6366f1' },
      handler: () => { qc.invalidateQueries({ queryKey: ['billing'] }); },
    };
    // @ts-expect-error — Razorpay loaded via script tag
    new window.Razorpay(options).open();
  }

  const isPro = billing?.subscription_plan === 'pro';
  const monthlyTokens = billing?.monthly_tokens ?? 0;
  const purchasedTokens = billing?.purchased_tokens ?? 0;
  const totalTokens = monthlyTokens + purchasedTokens;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Profile & Settings</h1>

      {/* Plan card */}
      <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-indigo-400" />
            <span className="font-semibold text-sm">Current Plan</span>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${isPro ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400'}`}>
            {isPro ? 'Pro ✨' : 'Free'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Ads Saved</p>
            <p className="text-lg font-bold text-indigo-400">{isLoading ? '—' : billing?.ads_saved_count ?? 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Free Analyses Used</p>
            <p className="text-lg font-bold text-yellow-400">{isLoading ? '—' : `${billing?.free_analyses_used ?? 0} / 1`}</p>
          </div>
        </div>

        {!isPro && (
          <button onClick={() => upgradeSub.mutate()} disabled={upgradeSub.isPending}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)' }}>
            <Zap size={14} />
            {upgradeSub.isPending ? 'Loading…' : 'Upgrade to Pro — ₹499/month'}
          </button>
        )}
      </div>

      {/* Token balance (Pro only) */}
      {isPro && (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <span className="font-semibold text-sm">Token Balance</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xl font-bold text-indigo-400">{monthlyTokens.toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Monthly</p>
              {billing?.monthly_tokens_expiry && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Expires {new Date(billing.monthly_tokens_expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xl font-bold text-green-400">{purchasedTokens.toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Purchased</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Never expire</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xl font-bold text-white">{totalTokens.toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total</p>
            </div>
          </div>

          {/* Buy token packs */}
          <div>
            <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
              <ShoppingCart size={10} className="inline mr-1" />
              Buy Tokens (Never Expire)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TOKEN_PACKS.map((pack) => (
                <button key={pack.id}
                  onClick={() => { setBuyingPack(pack.id); buyTokens.mutate(pack.id); }}
                  disabled={buyTokens.isPending && buyingPack === pack.id}
                  className="rounded-lg p-3 text-center transition-colors hover:ring-1 hover:ring-indigo-500 disabled:opacity-50"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-bold text-indigo-400">{pack.tokens}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tokens</p>
                  <p className="text-sm font-semibold mt-1">{pack.price}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pack.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Business Persona */}
      <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={16} className="text-indigo-400" />
            <span className="font-semibold text-sm">Business Persona</span>
          </div>
          {billing?.business_profile && !editingPersona && (
            <button onClick={() => { setEditingPersona(true); setPersonaText(typeof billing.business_persona === 'string' ? billing.business_persona : ''); }}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>

        {!billing?.business_profile ? (
          <div className="text-center py-4">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No business persona set up yet.</p>
            <button onClick={() => router.push('/dashboard/onboarding')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
              Set Up Business Persona
            </button>
          </div>
        ) : editingPersona ? (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={personaText}
              onChange={(e) => setPersonaText(e.target.value)}
              placeholder="Edit your business persona summary..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-1 focus:ring-indigo-500"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingPersona(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400" style={{ border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={async () => {
                await profileApi.updateBusiness({ ...billing.business_profile, persona_override: personaText });
                qc.invalidateQueries({ queryKey: ['billing'] });
                setEditingPersona(false);
              }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
              <button onClick={() => router.push('/dashboard/onboarding')} className="px-3 py-1.5 rounded-lg text-xs text-indigo-400" style={{ border: '1px solid var(--border)' }}>
                Redo Full Setup
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {billing.business_persona && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{String(billing.business_persona)}</p>
            )}
            {billing.business_profile && typeof billing.business_profile === 'object' && (
              <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {Object.entries(billing.business_profile).filter(([k]) => k !== 'persona_override').map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value || '')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
