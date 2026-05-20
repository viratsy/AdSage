'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adsApi, aiApi } from '@/lib/api';
import { ArrowLeft, Zap, Heart, Trash2, Copy } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import type { Ad, AiAnalysis } from '@/lib/types';

export default function AdDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [copied, setCopied] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => adsApi.get(id).then((r) => r.data),
    enabled: !!id,
    // Poll every 3s while processing, stop when completed or failed
    refetchInterval: (query) => {
      const status = query.state.data?.ad?.ai_analysis_status;
      return status === 'processing' ? 3000 : false;
    },
  });

  const { data: estimate } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => aiApi.estimate(['full_analysis']).then((r) => r.data),
    enabled: !!id && !data?.ai_analysis,
  });

  const triggerAi = useMutation({
    mutationFn: () => aiApi.trigger(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ad', id] }),
  });

  const toggleFav = useMutation({
    mutationFn: () => adsApi.update(id, { favorite: !data?.ad?.favorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ad', id] }),
  });

  const deleteAd = useMutation({
    mutationFn: () => adsApi.delete(id),
    onSuccess: () => router.push('/dashboard/library'),
  });

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
      ))}
    </div>
  );

  const ad: Ad | undefined = data?.ad;
  const ai_analysis: AiAnalysis | undefined = data?.ai_analysis;
  if (!ad) return <p className="text-gray-500 p-8">Ad not found.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex gap-2">
          <button onClick={() => toggleFav.mutate()} className="p-2 rounded-lg hover:bg-white/5" aria-label="Favorite">
            <Heart size={16} className={ad.favorite ? 'text-red-400 fill-red-400' : 'text-gray-400'} />
          </button>
          <button onClick={() => { if (confirm('Delete this ad?')) deleteAd.mutate(); }} className="p-2 rounded-lg hover:bg-white/5" aria-label="Delete">
            <Trash2 size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {ad.image_urls?.[0] && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <img src={ad.image_urls[0]} alt={ad.advertiser_name} className="w-full object-cover" />
            </div>
          )}
          <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Advertiser</p>
              <p className="font-semibold text-indigo-400">{ad.advertiser_name}</p></div>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Primary Text</p>
              <p className="text-sm leading-relaxed">{ad.primary_text || 'Not captured'}</p></div>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Headline</p>
              <p className="text-sm font-medium">{ad.headline || 'Not captured'}</p></div>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>CTA</p>
              {ad.cta ? <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400">{ad.cta}</span> : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Not captured</p>}</div>
            {ad.landing_page && <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Landing Page</p>
              <a href={ad.landing_page} target="_blank" rel="noopener" className="text-xs text-indigo-400 hover:underline break-all">{ad.landing_page}</a></div>}
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Platform</p>
              <p className="text-xs capitalize">{ad.platform || 'facebook'}</p></div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Saved {formatDate(ad.created_at)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {!ai_analysis ? (
            <div className="rounded-xl p-6 text-center space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Zap size={24} className="text-indigo-400 mx-auto" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {ad.ai_analysis_status === 'processing'
                  ? 'AI analysis in progress…'
                  : ad.ai_analysis_status === 'failed'
                  ? '⚠️ Analysis failed — tokens were refunded.'
                  : 'No AI analysis yet.'}
              </p>

              {/* Token cost preview */}
              {estimate && ad.ai_analysis_status !== 'processing' && (
                <div className="rounded-lg p-3 text-left" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">Full Analysis</span>
                    <span className="text-xs font-bold text-indigo-400">{estimate.token_cost} tokens</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Your balance</span>
                    <span className={`text-xs font-medium ${estimate.can_proceed ? 'text-green-400' : 'text-red-400'}`}>
                      {estimate.balance?.total ?? '—'} tokens {estimate.can_proceed ? '✓' : '✗ insufficient'}
                    </span>
                  </div>
                  {estimate.balance?.monthly > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {estimate.balance.monthly} monthly · {estimate.balance.purchased} purchased
                    </p>
                  )}
                </div>
              )}

              {ad.ai_analysis_status !== 'processing' && (
                <button
                  onClick={() => triggerAi.mutate()}
                  disabled={triggerAi.isPending || (estimate && !estimate.can_proceed)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: ad.ai_analysis_status === 'failed' ? '#f59e0b' : 'var(--accent)' }}
                >
                  {triggerAi.isPending
                    ? 'Queuing…'
                    : ad.ai_analysis_status === 'failed'
                    ? '🔄 Retry Analysis'
                    : `⚡ Analyze with AI${estimate ? ` · ${estimate.token_cost} tokens` : ''}`}
                </button>
              )}

              {estimate && !estimate.can_proceed && (
                <p className="text-xs text-red-400">
                  Need {estimate.token_cost} tokens, you have {estimate.balance?.total ?? 0}.{' '}
                  <a href="/dashboard/profile" className="underline text-indigo-400">Buy tokens →</a>
                </p>
              )}

              {triggerAi.isError && (
                <p className="text-xs text-red-400">
                  {(triggerAi.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to trigger analysis'}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>AI Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-indigo-400">{ai_analysis.ai_score}</span>
                  <span className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>/100</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-800">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${ai_analysis.ai_score}%` }} />
                </div>
              </div>
              <div className="rounded-xl p-5 grid grid-cols-2 gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {([['Hook Type', ai_analysis.hook_type], ['Emotion', ai_analysis.emotional_trigger],
                  ['Audience', ai_analysis.audience_type], ['Funnel', ai_analysis.funnel_stage],
                  ['CTA Strength', ai_analysis.cta_strength]] as [string, string | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="text-sm font-medium capitalize">{value?.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
              {(ai_analysis.generated_hooks?.length ?? 0) > 0 && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Generated Hooks</p>
                  <ul className="space-y-2">
                    {ai_analysis.generated_hooks!.map((hook, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 group">
                        <p className="text-sm">{hook}</p>
                        <button onClick={() => copyText(hook, `h${i}`)} className="shrink-0 opacity-0 group-hover:opacity-100" aria-label="Copy">
                          <Copy size={12} className={copied === `h${i}` ? 'text-green-400' : 'text-gray-500'} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(ai_analysis.generated_ctas?.length ?? 0) > 0 && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Generated CTAs</p>
                  <div className="flex flex-wrap gap-2">
                    {ai_analysis.generated_ctas!.map((cta, i) => (
                      <button key={i} onClick={() => copyText(cta, `c${i}`)}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ background: copied === `c${i}` ? 'rgba(34,197,94,0.2)' : 'var(--surface-2)',
                          color: copied === `c${i}` ? '#22c55e' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image generation prompt */}
              {ai_analysis.image_prompt && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Image Generation Prompt</p>
                    <button onClick={() => copyText(ai_analysis.image_prompt!, 'img')}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: copied === 'img' ? 'rgba(34,197,94,0.2)' : 'var(--surface-2)', color: copied === 'img' ? '#22c55e' : 'var(--text-muted)' }}>
                      {copied === 'img' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{ai_analysis.image_prompt}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                    Use with Midjourney, DALL-E, or generate directly from Advolt.ai (coming soon)
                  </p>
                </div>
              )}

              {/* Ad analysis explanation */}
              {ai_analysis.ad_analysis && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Why This Ad Works</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{ai_analysis.ad_analysis}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
