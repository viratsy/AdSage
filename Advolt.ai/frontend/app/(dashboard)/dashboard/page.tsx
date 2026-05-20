'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi, adsApi } from '@/lib/api';
import { Zap, BookImage, CreditCard } from 'lucide-react';
import AdCard from '@/components/AdCard';
import { formatDate } from '@/lib/utils';
import type { Ad } from '@/lib/types';

export default function DashboardPage() {
  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const { data: adsData } = useQuery({
    queryKey: ['ads', 'recent'],
    queryFn: () => adsApi.list({ limit: 6 }).then((r) => r.data),
  });

  const stats = [
    {
      label: 'Ads Saved',
      value: billing?.ads_saved_count ?? '—',
      icon: BookImage,
      color: 'text-indigo-400',
    },
    {
      label: 'AI Credits',
      value: billing?.ai_credits ?? '—',
      icon: Zap,
      color: 'text-yellow-400',
    },
    {
      label: 'Plan',
      value: billing?.subscription_plan === 'pro' ? 'Pro ✨' : 'Free',
      icon: CreditCard,
      color: 'text-green-400',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {label}
              </span>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent saves */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
          Recent Saves
        </h2>
        {adsData?.ads?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adsData.ads.map((ad: Ad) => (
              <AdCard key={ad.ad_id} ad={ad} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No ads saved yet. Use the Chrome extension to save your first ad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
