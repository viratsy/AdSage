'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adsApi, aiApi } from '@/lib/api';
import { ArrowLeft, Zap, Heart, Trash2, Copy } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import type { Ad, AiAnalysis } from '@/lib/types';
import GenerateSection from '@/components/GenerateSection';
import VideoTranscript from '@/components/VideoTranscript';

export default function AdDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [copied, setCopied] = useState('');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

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

  const saveNotes = useMutation({
    mutationFn: () => adsApi.update(id, { notes }),
    onSuccess: () => { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000); },
  });

  const generateSimilar = useMutation({
    mutationFn: () => aiApi.trigger(id, ['full_analysis']),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ad', id] }),
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

          {/* Notes */}
          <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <textarea
              rows={3}
              placeholder="Add your notes about this ad..."
              value={notes || ad.notes || ''}
              onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-1 focus:ring-indigo-500"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button
              onClick={() => saveNotes.mutate()}
              disabled={saveNotes.isPending}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: notesSaved ? 'rgba(34,197,94,0.2)' : 'var(--surface-2)', color: notesSaved ? '#22c55e' : 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {saveNotes.isPending ? 'Saving...' : notesSaved ? '✓ Saved' : 'Save Notes'}
            </button>
          </div>

          {/* Video Transcription */}
          <VideoTranscript adId={id} transcript={ad.video_transcript} />

          {/* Generate Similar Ad */}
          {ai_analysis && (
            <button
              onClick={() => generateSimilar.mutate()}
              disabled={generateSimilar.isPending}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {generateSimilar.isPending ? '⏳ Generating...' : '✨ Generate Similar Ad for My Business'}
            </button>
          )}
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
              {/* Hooks — with regenerate + generate more */}
              <GenerateSection adId={id} operation="hooks" title="Generated Hooks" tokenCost={20}
                initialData={ai_analysis.generated_hooks} type="list" canGenerateMore />

              {/* CTAs — with regenerate + generate more */}
              <GenerateSection adId={id} operation="ctas" title="Generated CTAs" tokenCost={20}
                initialData={ai_analysis.generated_ctas} type="list" canGenerateMore />

              {/* Short Copy — on-demand */}
              <GenerateSection adId={id} operation="short_copy" title="Short Ad Copy" tokenCost={30}
                initialData={ai_analysis.short_copy} type="text" />

              {/* Long Copy — on-demand */}
              <GenerateSection adId={id} operation="long_copy" title="Long Ad Copy" tokenCost={50}
                initialData={ai_analysis.long_copy} type="text" />

              {/* Image Prompt — on-demand */}
              <GenerateSection adId={id} operation="image_prompt" title="Image Generation Prompt" tokenCost={20}
                initialData={ai_analysis.image_prompt} type="text" />

              {/* Video Script — on-demand */}
              <GenerateSection adId={id} operation="video_script" title="Video Ad Script" tokenCost={50}
                initialData={null} type="text" />

              {/* Why This Ad Works */}
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
