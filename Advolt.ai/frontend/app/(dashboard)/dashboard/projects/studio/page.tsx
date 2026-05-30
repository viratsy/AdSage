'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import {
  Zap, Users, Loader2, Check, ChevronLeft, RefreshCw, Copy, Wand2,
  UserCircle, Target, AlertTriangle, ArrowRight
} from 'lucide-react';

interface AudienceProfile {
  label: string;
  demographics: string;
  psychographics: string;
  situation: string;
  goals: string;
  objections: string;
  buying_triggers: string;
  awareness_level: string;
}

interface Asset {
  id: string;
  tool: string;
  items: string[];
  input: Record<string, string>;
  created_at: string;
}

interface Intelligence {
  audience?: AudienceProfile;
  pain_points?: string[];
  desires?: string[];
  objections?: string[];
  emotional_angles?: Array<{ emotion: string; angle: string; example_hook: string }>;
}

interface Project {
  project_id: string;
  project_name: string;
  business_name: string;
  business_niche: string;
  product_name: string;
  product_description: string;
  usp: string;
  target_location: string;
  target_audience_hint: string;
  intelligence?: Intelligence;
  assets?: Asset[];
  ai_analysis?: {
    suggested_audiences?: string[];
    pain_points?: string[];
    content_angles?: string[];
  };
}

const STEPS = [
  { id: 1, label: 'Audience', desc: 'Define your ideal customer' },
  { id: 2, label: 'Generate Ads', desc: 'Create campaigns' },
];

export default function ProjectStudioPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(() => {
    // Will be updated after project loads
    return 1;
  });
  const [input, setInput] = useState<Record<string, string>>({});
  const [generatedOptions, setGeneratedOptions] = useState<AudienceProfile[] | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<Asset | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile | null>(null);
  const [copied, setCopied] = useState('');
  const [activePlatform, setActivePlatform] = useState<'meta' | 'google'>('meta');
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [regenSection, setRegenSection] = useState<string | null>(null);
  const [regenInput, setRegenInput] = useState('');

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: ({ tool, input: inp }: { tool: string; input?: Record<string, string> }) =>
      projectsApi.generate(projectId!, tool, inp).then((r) => r.data),
    onSuccess: (data) => {
      if (data.status === 'options') {
        setGeneratedOptions(data.options as AudienceProfile[]);
        setGeneratedAsset(null);
      } else if (data.status === 'generated') {
        setGeneratedAsset(data.asset);
        setGeneratedOptions(null);
        setCampaignIndex(0);
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ tool, value }: { tool: string; value: unknown }) =>
      projectsApi.saveIntelligence(projectId!, tool, value).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setGeneratedOptions(null);
      setSelectedAudience(null);
      setActiveStep(2); // Auto-advance to ads
    },
  });

  if (!projectId) { router.push('/dashboard/projects'); return null; }
  if (isLoading || !project) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>;
  }

  const intelligence = project.intelligence || {};
  const assets = project.assets || [];
  const hasAudience = !!intelligence.audience;
  const hasCampaigns = assets.some(a => a.tool === 'meta_campaign' || a.tool === 'google_campaign');

  // Auto-advance to Step 2 if audience exists and campaigns exist
  if (hasAudience && hasCampaigns && activeStep === 1) {
    setActiveStep(2);
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Auto-advance if audience exists
  if (hasAudience && activeStep === 1) {
    // Show step 1 but with audience selected state
  }

  const tones = ['Bold', 'Emotional', 'Funny', 'Luxury', 'Aggressive', 'Minimal', 'Gen-Z', 'Professional'];

  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/projects')} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Campaign Builder</h1>
          <p className="text-base text-gray-400">{project.project_name} · {project.business_name}</p>
        </div>
      </div>

      {/* 2-Step Progress */}
      <div className="flex items-center gap-4">
        {STEPS.map((step, i) => {
          const isActive = step.id === activeStep;
          const isDone = step.id === 1 && hasAudience;
          return (
            <div key={step.id} className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-base font-medium transition-all w-full ${
                  isActive ? 'bg-indigo-500/15 text-white' : isDone ? 'bg-emerald-500/10 text-emerald-300' : 'text-gray-500 hover:bg-white/5'
                }`}
                style={{ border: isActive ? '1px solid rgba(99,102,241,0.25)' : isDone ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {isDone ? '✓' : step.id}
                </span>
                <div className="text-left">
                  <p className="font-semibold">{step.label}</p>
                  <p className="text-sm text-gray-400">{step.desc}</p>
                </div>
              </button>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Audience */}
      {activeStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Business info + Generate */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-bold text-white mb-4">Tell us about your business</h3>
              <div className="space-y-3 text-base">
                <div><span className="text-gray-500 text-sm">Business / Brand Name</span><p className="text-white font-medium">{project.business_name}</p></div>
                <div><span className="text-gray-500 text-sm">Niche / Industry</span><p className="text-white font-medium">{project.business_niche}</p></div>
                <div><span className="text-gray-500 text-sm">Product / Service</span><p className="text-white font-medium">{project.product_name}</p></div>
                {project.usp && <div><span className="text-gray-500 text-sm">USP</span><p className="text-gray-300 text-sm">{project.usp}</p></div>}
                {project.target_location && <div><span className="text-gray-500 text-sm">Target Location</span><p className="text-white font-medium">{project.target_location}</p></div>}
                {project.target_audience_hint && <div><span className="text-gray-500 text-sm">Ideal Customer Hint</span><p className="text-gray-300 text-sm">{project.target_audience_hint}</p></div>}
              </div>
              <button
                onClick={() => generateMutation.mutate({ tool: 'audience', input: input.description ? { description: input.description } : undefined })}
                disabled={generateMutation.isPending}
                className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {generateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Wand2 size={14} /> Generate Personas ✨</>}
              </button>
            </div>
          </div>

          {/* Right: Persona cards */}
          <div className="lg:col-span-3">
            {generatedOptions && generatedOptions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">AI Generated {generatedOptions.length} Audience Personas</h3>
                  <button onClick={() => generateMutation.mutate({ tool: 'audience' })} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <RefreshCw size={10} /> Regenerate
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {generatedOptions.map((persona, i) => {
                    const colors = ['border-indigo-500/30 bg-indigo-500/5', 'border-blue-500/30 bg-blue-500/5', 'border-emerald-500/30 bg-emerald-500/5'];
                    const isSelected = selectedAudience === persona;
                    return (
                      <div key={i}
                        onClick={() => setSelectedAudience(persona)}
                        className={`rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${isSelected ? 'ring-2 ring-indigo-500 ' + colors[i] : colors[i]}`}
                        style={{ border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-400">Persona {i + 1}</span>
                          {isSelected && <Check size={14} className="text-indigo-400" />}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center mb-3 mx-auto">
                          <UserCircle size={24} className="text-indigo-300" />
                        </div>
                        <p className="text-base font-bold text-white text-center">{persona.label}</p>
                        <p className="text-sm text-gray-400 text-center mt-0.5">{persona.demographics?.split(',')[0]}</p>

                        <div className="mt-4 space-y-2 text-sm">
                          {persona.situation && <div className="flex gap-2"><AlertTriangle size={10} className="text-red-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Pain Points</span><p className="text-gray-300">{persona.situation.slice(0, 60)}</p></div></div>}
                          {persona.goals && <div className="flex gap-2"><Target size={10} className="text-emerald-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Goals</span><p className="text-gray-300">{persona.goals.slice(0, 60)}</p></div></div>}
                          {persona.buying_triggers && <div className="flex gap-2"><Zap size={10} className="text-amber-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Triggers</span><p className="text-gray-300">{persona.buying_triggers.slice(0, 60)}</p></div></div>}
                          {persona.awareness_level && <div className="flex gap-2"><Users size={10} className="text-blue-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Awareness</span><p className="text-gray-300">{persona.awareness_level.split(' ')[0]}</p></div></div>}
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedAudience(persona); saveMutation.mutate({ tool: 'audience', value: persona }); }}
                          disabled={saveMutation.isPending}
                          className={`w-full mt-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}>
                          {isSelected && saveMutation.isPending ? 'Saving...' : isSelected ? 'Selected ✓' : 'Select'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : hasAudience ? (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                    <UserCircle size={28} className="text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{intelligence.audience!.label}</p>
                    <p className="text-base text-gray-400">{intelligence.audience!.demographics}</p>
                  </div>
                </div>
                <p className="text-base text-gray-300 mb-4">{intelligence.audience!.situation}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {intelligence.audience!.goals && <div><span className="text-emerald-400 font-medium">Goals:</span> <span className="text-gray-300">{intelligence.audience!.goals}</span></div>}
                  {intelligence.audience!.buying_triggers && <div><span className="text-amber-400 font-medium">Triggers:</span> <span className="text-gray-300">{intelligence.audience!.buying_triggers}</span></div>}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setActiveStep(2)} className="flex-1 py-2.5 rounded-xl text-base font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    Generate Ads →
                  </button>
                  <button onClick={() => generateMutation.mutate({ tool: 'audience' })} className="px-4 py-2.5 rounded-xl text-base text-gray-400 hover:bg-white/5 border border-white/10">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Users size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-lg font-medium text-gray-400">Generate your audience personas</p>
                <p className="text-base text-gray-500 mt-1">Click &quot;Generate Personas&quot; to get AI-powered audience profiles</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Generate Ads */}
      {activeStep === 2 && (
        <div className="space-y-5">
          {/* Platform toggle + Tone + Generate */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              {(['meta', 'google'] as const).map(p => (
                <button key={p} onClick={() => { setActivePlatform(p); setGeneratedAsset(null); setCampaignIndex(0); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-medium transition-all ${activePlatform === p ? 'bg-indigo-500/15 text-white border border-indigo-500/25' : 'text-gray-400 hover:bg-white/5 border border-white/10'}`}>
                  <img src={p === 'meta' ? '/meta.svg' : '/google.svg'} alt={p} className="w-5 h-5" />
                  {p === 'meta' ? 'Meta Ads (Facebook & Instagram)' : 'Google Ads (Search)'}
                </button>
              ))}
            </div>
            <select value={input.tone || ''} onChange={(e) => setInput({ ...input, tone: e.target.value })}
              className="ml-auto px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-gray-200 outline-none appearance-none cursor-pointer hover:bg-white/8 transition-colors"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px' }}>
              <option value="" style={{ background: '#1a1a2e', color: '#e5e7eb' }}>Tone: Auto</option>
              {tones.map(t => <option key={t} value={t} style={{ background: '#1a1a2e', color: '#e5e7eb' }}>{t}</option>)}
            </select>
            <button
              onClick={() => generateMutation.mutate({ tool: activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign', input: Object.keys(input).length > 0 ? input : undefined })}
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50">
              {generateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><RefreshCw size={14} /> Generate</>}
            </button>
          </div>

          {/* 3-column layout when campaign exists (generated or saved) */}
          {(() => {
            // Use freshly generated asset OR load from saved assets
            const campaignTool = activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign';
            const savedCampaigns = assets.filter(a => a.tool === campaignTool);
            const currentAsset = generatedAsset || (savedCampaigns.length > 0 ? savedCampaigns[savedCampaigns.length - 1] : null);
            
            if (!currentAsset || !currentAsset.items.length) {
              return (
                <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Wand2 size={32} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-lg font-medium text-gray-400">Generate your campaign</p>
                  <p className="text-base text-gray-500 mt-1">Select a platform and click Generate to create a complete campaign with targeting</p>
                  <textarea value={input.instruction || ''} onChange={(e) => setInput({ ...input, instruction: e.target.value })}
                    placeholder="Additional instructions (optional)..."
                    rows={2} className="w-full max-w-md mx-auto mt-4 px-4 py-3 rounded-xl text-base resize-none"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
                  <button
                    onClick={() => generateMutation.mutate({ tool: campaignTool, input: Object.keys(input).length > 0 ? input : undefined })}
                    disabled={generateMutation.isPending}
                    className="mt-4 flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl text-base font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {generateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Wand2 size={14} /> Generate Campaign</>}
                  </button>
                </div>
              );
            }

            // Campaign slider — show current campaign with navigation
            const allCampaignItems = savedCampaigns.flatMap(a => a.items);
            const totalCampaigns = allCampaignItems.length;
            const currentCampaignItem = allCampaignItems[campaignIndex] || currentAsset.items[0];

            const campaign = (typeof currentCampaignItem === 'object' && currentCampaignItem !== null ? currentCampaignItem : {}) as Record<string, unknown>;
            const targeting = (campaign.targeting || {}) as Record<string, unknown>;
            const placements = (campaign.placements || []) as string[];
            const allText = Object.entries(campaign).filter(([k]) => !['targeting', 'placements'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');

            return (
              <div className="space-y-5">
                {/* Campaign navigation */}
                {totalCampaigns > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <button
                      onClick={() => setCampaignIndex(Math.max(0, campaignIndex - 1))}
                      disabled={campaignIndex === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: Math.min(totalCampaigns, 10) }).map((_, i) => (
                        <button key={i} onClick={() => setCampaignIndex(i)}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${i === campaignIndex ? 'bg-indigo-400 scale-125' : 'bg-gray-600 hover:bg-gray-400'}`} />
                      ))}
                      {totalCampaigns > 10 && <span className="text-xs text-gray-500">...</span>}
                      <span className="text-sm text-gray-400 ml-3 font-medium">{campaignIndex + 1}/{totalCampaigns}</span>
                    </div>
                    <button
                      onClick={() => setCampaignIndex(Math.min(totalCampaigns - 1, campaignIndex + 1))}
                      disabled={campaignIndex === totalCampaigns - 1}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Delete & Regenerate buttons */}
                <div className="flex items-center justify-end gap-2 px-2">
                  <button
                    onClick={() => {
                      const asset = savedCampaigns.find(a => a.items.includes(currentCampaignItem));
                      if (asset && confirm('Delete this campaign?')) {
                        projectsApi.deleteAsset(projectId!, asset.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                          setCampaignIndex(Math.max(0, campaignIndex - 1));
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    🗑 Delete
                  </button>
                  <button
                    onClick={() => { setGeneratedAsset(null); generateMutation.mutate({ tool: campaignTool, input: Object.keys(input).length > 0 ? input : undefined }); }}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} /> Regenerate All
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-5">
                  {/* Left: Campaign Brief */}
                  <div className="col-span-3 space-y-4">
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 className="text-base font-bold text-white mb-4">Campaign Brief</h3>
                      <div className="space-y-3 text-sm">
                        <div><span className="text-indigo-400 font-medium">Audience</span><p className="text-gray-300 mt-0.5">{intelligence.audience?.label}</p><p className="text-gray-500 text-sm">{intelligence.audience?.demographics}</p></div>
                        <div><span className="text-indigo-400 font-medium">Goal</span><p className="text-gray-300 mt-0.5">{intelligence.audience?.goals || 'Conversions'}</p></div>
                        <div><span className="text-indigo-400 font-medium">Platform</span><p className="text-gray-300 mt-0.5">{activePlatform === 'meta' ? 'Meta Ads (Facebook & Instagram)' : 'Google Ads (Search)'}</p></div>
                        <div><span className="text-indigo-400 font-medium">Tone</span><p className="text-gray-300 mt-0.5">{input.tone || 'Auto'}</p></div>
                        {input.instruction ? <div><span className="text-indigo-400 font-medium">Instructions</span><p className="text-gray-300 mt-0.5">{input.instruction}</p></div> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Wand2 size={12} className="text-indigo-400" /> AI Suggestions</h4>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li>• Use urgency in hooks</li>
                        <li>• Highlight limited time benefits</li>
                        <li>• Showcase real results</li>
                        <li>• Add social proof elements</li>
                      </ul>
                    </div>
                  </div>

                  {/* Center: Creative + Copy */}
                  <div className="col-span-5">
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <h3 className="text-lg font-bold text-white">{campaign.campaign_name ? String(campaign.campaign_name) : 'Campaign Concept'}</h3>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">Best Match</span>
                      </div>
                      <div className="relative h-44 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm text-gray-500 mb-2">Ad Creative Preview</p>
                          <div className="flex gap-2 justify-center">
                            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Generate Image</button>
                            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 text-gray-400 border border-white/10">Generate Prompt</button>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        {['hook', 'primary_text', 'headline', 'cta', 'description', 'display_url'].map(field => {
                          if (!campaign[field]) return null;
                          const label = field.replace(/_/g, ' ').toUpperCase();
                          const isHook = field === 'hook' || field === 'headline';
                          const color = ['description', 'display_url'].includes(field) ? 'text-amber-400' : 'text-indigo-400';
                          return (
                            <div key={field} className="group/section relative">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold uppercase ${color}`}>{label}</p>
                                <button
                                  onClick={() => setRegenSection(regenSection === field ? null : field)}
                                  className="opacity-0 group-hover/section:opacity-100 p-1 rounded text-gray-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all"
                                  title={`Regenerate ${label}`}
                                >
                                  <RefreshCw size={11} />
                                </button>
                              </div>
                              <p className={`${isHook ? 'text-base font-semibold text-white' : 'text-base text-gray-300 leading-relaxed whitespace-pre-line'}`}>
                                {String(campaign[field])}
                              </p>
                              {regenSection === field && (
                                <div className="mt-2 flex gap-2">
                                  <input
                                    value={regenInput}
                                    onChange={(e) => setRegenInput(e.target.value)}
                                    placeholder={`How to change ${field.replace(/_/g, ' ')}...`}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-sm"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                  />
                                  <button
                                    onClick={() => {
                                      const existingCampaign = JSON.stringify(campaign);
                                      generateMutation.mutate({ tool: 'campaign_section', input: { existing_campaign: existingCampaign, section: field, instruction: regenInput } });
                                      setRegenSection(null);
                                      setRegenInput('');
                                    }}
                                    disabled={generateMutation.isPending}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                                  >
                                    {generateMutation.isPending ? '...' : '↻'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Target Audience */}
                  <div className="col-span-4">
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 className="text-base font-bold text-white mb-4">Target Audience</h3>
                      <div className="space-y-4 text-sm">
                        {targeting.demographics ? <div><span className="text-indigo-400 font-medium flex items-center gap-1"><Users size={10} /> Demographics</span><p className="text-gray-300 mt-1">{String(targeting.demographics)}</p></div> : null}
                        {targeting.interests && Array.isArray(targeting.interests) ? <div><span className="text-purple-400 font-medium">Interests</span><p className="text-gray-300 mt-1">{(targeting.interests as string[]).join(', ')}</p></div> : null}
                        {targeting.behaviors && Array.isArray(targeting.behaviors) ? <div><span className="text-emerald-400 font-medium">Behaviors</span><p className="text-gray-300 mt-1">{(targeting.behaviors as string[]).join(', ')}</p></div> : null}
                        {targeting.custom_audiences && Array.isArray(targeting.custom_audiences) ? <div><span className="text-amber-400 font-medium">Custom Audiences</span><p className="text-gray-300 mt-1">{(targeting.custom_audiences as string[]).join(', ')}</p></div> : null}
                        {targeting.lookalike_audiences && Array.isArray(targeting.lookalike_audiences) ? <div><span className="text-cyan-400 font-medium">Lookalike Audiences</span><p className="text-gray-300 mt-1">{(targeting.lookalike_audiences as string[]).join(', ')}</p></div> : null}
                      </div>
                    </div>
                    {campaign.budget_recommendation ? <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-sm font-bold uppercase text-emerald-400">Budget</p>
                      <p className="text-base text-gray-300 mt-1">{String(campaign.budget_recommendation)}</p>
                    </div> : null}
                  </div>
                </div>

                {/* Bottom cards */}
                <div className="grid grid-cols-4 gap-4">
                  {campaign.emotional_angle ? <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-bold text-white mb-1">🔥 Emotional Angle</p>
                    <p className="text-sm text-gray-200">{String(campaign.emotional_angle)}</p>
                    {campaign.emotional_angle_description ? <p className="text-sm text-gray-400 mt-1">{String(campaign.emotional_angle_description)}</p> : null}
                  </div> : null}
                  {campaign.creative_direction ? <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-bold text-white mb-1">🎬 Creative Direction</p>
                    <p className="text-base text-gray-300">{String(campaign.creative_direction)}</p>
                  </div> : null}
                  {campaign.offer ? <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-bold text-white mb-1">🎁 Offer</p>
                    <p className="text-base text-gray-300">{String(campaign.offer)}</p>
                  </div> : null}
                  {campaign.why_it_works ? <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-bold text-white mb-1">⭐ Why It Works</p>
                    <p className="text-base text-gray-300">{String(campaign.why_it_works)}</p>
                  </div> : null}
                </div>

                {/* Placements */}
                {placements.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-gray-400">Recommended Placements:</span>
                    {placements.map((p, i) => <span key={i} className="px-2.5 py-1 rounded-lg text-sm bg-white/5 text-gray-300 border border-white/10">{p}</span>)}
                  </div>
                )}

                {/* Bottom action bar */}
                <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-base text-gray-400">Need more options?</p>
                  <div className="flex gap-3">
                    <button onClick={() => copyText(allText, 'full_campaign')} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 border border-white/10 hover:bg-white/5">
                      {copied === 'full_campaign' ? '✓ Copied All' : 'Copy All'}
                    </button>
                    <button
                      onClick={() => { setGeneratedAsset(null); generateMutation.mutate({ tool: activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign', input: Object.keys(input).length > 0 ? input : undefined }); }}
                      disabled={generateMutation.isPending}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                      <Wand2 size={12} /> Generate More
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}



