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
  const limit = isPro ? 40 : 5;
  const adsUsed = data.ads_saved_count ?? 0;
  const creditsLeft = data.ai_credits ?? 0;

  const adsNearLimit = adsUsed >= limit;
  const creditsNearLimit = creditsLeft <= 1;

  if (!adsNearLimit && !creditsNearLimit) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm mb-6"
      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
    >
      <div className="flex items-center gap-2 text-yellow-400">
        <AlertTriangle size={14} />
        {adsNearLimit
          ? `You've reached your ad save limit (${adsUsed}/${limit}).`
          : `Only ${creditsLeft} AI credit${creditsLeft === 1 ? '' : 's'} remaining.`}
      </div>
      {!isPro && (
        <Link
          href="/dashboard/profile"
          className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline"
        >
          Upgrade to Pro
        </Link>
      )}
    </div>
  );
}
