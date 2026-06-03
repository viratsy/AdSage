'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, adsApi } from '@/lib/api';
import {
  Wand2, Loader2, RefreshCw, Copy, Check, ChevronLeft, ArrowRight,
  Library, Zap, Image as ImageIcon
} from 'lucide-react';

interface Ad {
  ad_id: string;
  advertiser_name: string;
  primary_text: string;
  headline: string;
  cta: string;
  landing_page: string;
  platform: string;
  image_urls?: string[];
}

interface Asset {
  id: string;
  tool: string;
  items: string[];
  input: Record<string, string>;
  created_at: string;
}

interface Props {
  projectId: string;
  assets: Asset[];
  activePlatform: 'meta' | 'google';
  setActivePlatform: (v: 'meta' | 'google') => void;
  generatedAsset: Asset | null;
  setGeneratedAsset: (v: Asset | null) => void;
}

const tones = ['Bold', 'Emotional', 'Funny', 'Luxury', 'Aggressive', 'Minimal', 'Gen-Z', 'Professional'];

export default function CampaignGenerator({ projectId, assets, activePlatform, setActivePlatform, generatedAsset, setGeneratedAsset }: Props) {
  const [mode, setMode] = useState<'scratch' | 'from_ad'>('scratch');
  const [input, setInput] = useState<Record<string, string>>({});
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showAdPicker, setShowAdPicker] = useState(false);
  const [copied, setCopied] = useState('');
  const [campaignIndex, setCampaignIndex] = useState(0);
  const queryClient = useQueryClient();

  // Fetch saved ads for the picker
  const { data: adsData } = useQuery({
    queryKey: ['ads'],
    queryFn: () => adsApi.list({ limit: 20 }).then(r => r.data),
    enabled: mode === 'from_ad',
  });
  const savedAds: Ad[] = adsData?.ads || [];

  const generateMutation = useMutation({
    mutationFn: ({ tool, inp }: { tool: string; inp?: Record<string, string> }) =>
      projectsApi.generate(projectId, tool, inp).then(r => r.data),
    onSuccess: (data) => {
      if (data.status === 'generated') {
        setGeneratedAsset(data.asset);
        setCampaignIndex(0);
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
    },
  });

  const handleGenerateFromScratch = () => {
    const tool = activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign';
    generateMutation.mutate({ tool, inp: Object.keys(input).length > 0 ? input : undefined });
  };

  const handleGenerateFromAd = () => {
    if (!selectedAd) return;
    generateMutation.mutate({
      tool: 'meta_campaign_from_ad',
      inp: {
        ...input,
        ad_advertiser: selectedAd.advertiser_name,
        ad_headline: selectedAd.headline,
        ad_primary_text: selectedAd.primary_text?.slice(0, 500),
        ad_cta: selectedAd.cta,
        ad_platform: selectedAd.platform,
        ad_landing_page: selectedAd.landing_page,
      },
    });
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Get all campaigns for navigation
  const campaignTool = activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign';
  const fromAdTool = 'meta_campaign_from_ad';
  const allCampaignAssets = assets.filter(a => a.tool === campaignTool || a.tool === fromAdTool);
  const allCampaignItems = allCampaignAssets.flatMap(a => a.items);
  const currentAsset = generatedAsset || (allCampaignAssets.length > 0 ? allCampaignAssets[allCampaignAssets.length - 1] : null);

  return (
    <div className="space-y-5">
      {/* Platform toggle + Mode selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {(['meta', 'google'] as const).map(p => (
            <button key={p} onClick={() => { setActivePlatform(p); setGeneratedAsset(null); setCampaignIndex(0); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-medium transition-all ${activePlatform === p ? 'bg-indigo-500/15 text-white border border-indigo-500/25' : 'text-gray-400 hover:bg-white/5 border border-white/10'}`}>
              {p === 'meta' ? '◎ Meta Ads' : 'G Google Ads'}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="ml-auto flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => { setMode('scratch'); setSelectedAd(null); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'scratch' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5'}`}>
            <Wand2 size={12} className="inline mr-1.5" />From Scratch
          </button>
          <button onClick={() => setMode('from_ad')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === 'from_ad' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5'}`}>
            <Library size={12} className="inline mr-1.5" />From Saved Ad
          </button>
        </div>
      </div>

      {/* Generation controls */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {mode === 'from_ad' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Generate from Saved Ad</h3>
                <p className="text-sm text-gray-400 mt-0.5">AI will analyze a competitor ad and create a campaign inspired by their strategy</p>
              </div>
            </div>

            {/* Ad picker */}
            {selectedAd ? (
              <div className="p-4 rounded-xl flex items-start gap-4" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                {selectedAd.image_urls?.[0] && (
                  <img src={selectedAd.image_urls[0]} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{selectedAd.advertiser_name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{selectedAd.headline || selectedAd.primary_text?.slice(0, 60)}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{selectedAd.platform} · {selectedAd.cta || 'No CTA'}</p>
                </div>
                <button onClick={() => setSelectedAd(null)} className="text-xs text-gray-500 hover:text-white">Change</button>
              </div>
            ) : (
              <div>
                <button onClick={() => setShowAdPicker(!showAdPicker)}
                  className="w-full p-4 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all text-left flex items-center gap-3"
                  style={{ border: '1px dashed rgba(255,255,255,0.15)' }}>
                  <Library size={20} className="text-indigo-400" />
                  <div>
                    <p className="font-medium text-gray-300">Select a saved ad as inspiration</p>
                    <p className="text-xs text-gray-500 mt-0.5">{savedAds.length} ads in your library</p>
                  </div>
                  <ArrowRight size={14} className="ml-auto" />
                </button>

                {showAdPicker && savedAds.length > 0 && (
                  <div className="mt-3 max-h-60 overflow-y-auto space-y-2 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {savedAds.map(ad => (
                      <button key={ad.ad_id} onClick={() => { setSelectedAd(ad); setShowAdPicker(false); }}
                        className="w-full p-3 rounded-lg text-left hover:bg-white/5 transition-colors flex items-center gap-3"
                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {ad.image_urls?.[0] && <img src={ad.image_urls[0]} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{ad.advertiser_name}</p>
                          <p className="text-xs text-gray-500 truncate">{ad.headline || ad.primary_text?.slice(0, 50)}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">{ad.platform}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 className="text-base font-bold text-white">Generate Campaign from Scratch</h3>
            <p className="text-sm text-gray-400 mt-0.5">AI creates a complete campaign using your business data and audience</p>
          </div>
        )}

        {/* Shared controls: tone + instructions */}
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2">Tone (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {tones.map(t => (
                <button key={t} onClick={() => setInput({ ...input, tone: input.tone === t ? '' : t })}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${input.tone === t ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 border border-white/10 hover:bg-white/5'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <textarea value={input.instruction || ''} onChange={(e) => setInput({ ...input, instruction: e.target.value })}
            placeholder="Additional instructions (optional)... e.g. Focus on urgency, target college students, mention free trial"
            rows={2} className="w-full px-4 py-3 rounded-xl text-sm resize-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />

          <button
            onClick={mode === 'from_ad' ? handleGenerateFromAd : handleGenerateFromScratch}
            disabled={generateMutation.isPending || (mode === 'from_ad' && !selectedAd)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all">
            {generateMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Generating Campaign...</>
            ) : mode === 'from_ad' ? (
              <><Library size={16} /> Generate Inspired Campaign</>
            ) : (
              <><Wand2 size={16} /> Generate Campaign</>
            )}
          </button>
        </div>
      </div>

      {/* Generated campaign display */}
      {currentAsset && currentAsset.items.length > 0 && (
        <div className="space-y-4">
          {/* Campaign cards */}
          {(generatedAsset?.items || currentAsset.items.slice(campaignIndex, campaignIndex + 1)).map((item, i) => {
            const campaign = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
            const text = Object.entries(campaign).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
            const key = `campaign_${i}`;

            return (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div>
                    <h3 className="text-lg font-bold text-white">{campaign.campaign_name ? String(campaign.campaign_name) : 'Campaign'}</h3>
                    {campaign.emotional_angle && <span className="inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">{String(campaign.emotional_angle)}</span>}
                  </div>
                  <button onClick={() => copyText(text, key)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                    {copied === key ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {campaign.inspired_by && (
                    <p className="text-xs text-indigo-300 italic">💡 {String(campaign.inspired_by)}</p>
                  )}

                  {Object.entries(campaign)
                    .filter(([k]) => !['campaign_name', 'emotional_angle', 'emotional_angle_description', 'inspired_by', 'targeting', 'placements'].includes(k))
                    .map(([field, value]) => {
                      const isArray = Array.isArray(value);
                      const isLong = typeof value === 'string' && value.length > 80;
                      return (
                        <div key={field}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">{field.replace(/_/g, ' ')}</p>
                          {isArray ? (
                            <div className="flex flex-wrap gap-1.5">
                              {(value as string[]).map((v, j) => <span key={j} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-gray-200 border border-white/8">{v}</span>)}
                            </div>
                          ) : typeof value === 'object' && value !== null ? (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(value as Record<string, unknown>).map(([k2, v2]) => (
                                <div key={k2}><span className="text-gray-500">{k2}:</span> <span className="text-gray-200">{Array.isArray(v2) ? (v2 as string[]).join(', ') : String(v2)}</span></div>
                              ))}
                            </div>
                          ) : (
                            <p className={`text-sm text-gray-200 leading-relaxed ${isLong ? 'whitespace-pre-line' : ''}`}>{String(value)}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Cross-promote the other mode */}
          <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {mode === 'scratch' ? (
              <>
                <Library size={18} className="text-indigo-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-200">Want inspiration from a competitor?</p>
                  <p className="text-xs text-gray-500">Generate a campaign inspired by a saved ad from your library</p>
                </div>
                <button onClick={() => { setMode('from_ad'); setGeneratedAsset(null); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/10">
                  Try From Saved Ad →
                </button>
              </>
            ) : (
              <>
                <Wand2 size={18} className="text-indigo-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-200">Want something completely original?</p>
                  <p className="text-xs text-gray-500">Generate a campaign purely from your business data</p>
                </div>
                <button onClick={() => { setMode('scratch'); setGeneratedAsset(null); setSelectedAd(null); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/10">
                  Try From Scratch →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state when no campaigns yet */}
      {!currentAsset && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Zap size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-base font-medium text-gray-400">Ready to create your campaign</p>
          <p className="text-sm text-gray-500 mt-1">Choose a mode above and hit Generate</p>
        </div>
      )}
    </div>
  );
}
