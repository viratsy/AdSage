'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function LimitBanner() {
  const { data } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  if (!data) return null;

  const isPro = data.subscription_plan === 'pro';
  const totalTokens = (data.monthly_tokens ?? 0) + (data.purchased_tokens ?? 0);
  const adsUsed = data.ads_saved_count ?? 0;
  const adsLimit = isPro ? Infinity : 5;

  const adsNearLimit = !isPro && adsUsed >= adsLimit;
  const tokensLow = isPro && totalTokens < 50;

  if (!adsNearLimit && !tokensLow) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm mb-6"
      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
    >
      <div className="flex items-center gap-2 text-yellow-400">
        <AlertTriangle size={14} />
        {adsNearLimit
          ? `You've reached your ad save limit (${adsUsed}/5). Upgrade to Pro for unlimited.`
          : `Low token balance (${totalTokens} remaining). Buy more in Profile.`}
      </div>
      <Link
        href="/dashboard/profile"
        className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline"
      >
        {adsNearLimit ? 'Upgrade' : 'Buy Tokens'}
      </Link>
    </div>
  );
}
