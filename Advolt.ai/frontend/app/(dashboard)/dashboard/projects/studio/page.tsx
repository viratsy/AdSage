'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import {
  Zap, Users, Loader2, Check, ChevronLeft, RefreshCw, Copy, Wand2,
  UserCircle, Target, AlertTriangle
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

  const [activeStep, setActiveStep] = useState(1);
  const [input, setInput] = useState<Record<string, string>>({});
  const [generatedOptions, setGeneratedOptions] = useState<AudienceProfile[] | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<Asset | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile | null>(null);
  const [copied, setCopied] = useState('');
  const [activePlatform, setActivePlatform] = useState<'meta' | 'google'>('meta');

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
          <p className="text-sm text-gray-400">{project.project_name} · {project.business_name}</p>
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
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium transition-all w-full ${
                  isActive ? 'bg-indigo-500/15 text-white' : isDone ? 'bg-emerald-500/10 text-emerald-300' : 'text-gray-500 hover:bg-white/5'
                }`}
                style={{ border: isActive ? '1px solid rgba(99,102,241,0.25)' : isDone ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {isDone ? '✓' : step.id}
                </span>
                <div className="text-left">
                  <p className="font-semibold">{step.label}</p>
                  <p className="text-[10px] text-gray-400">{step.desc}</p>
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
              <h3 className="text-base font-bold text-white mb-4">Tell us about your business</h3>
              <div className="space-y-3 text-sm">
                <div><span className="text-gray-500 text-xs">Business / Brand Name</span><p className="text-white font-medium">{project.business_name}</p></div>
                <div><span className="text-gray-500 text-xs">Niche / Industry</span><p className="text-white font-medium">{project.business_niche}</p></div>
                <div><span className="text-gray-500 text-xs">Product / Service</span><p className="text-white font-medium">{project.product_name}</p></div>
                {project.usp && <div><span className="text-gray-500 text-xs">USP</span><p className="text-gray-300 text-xs">{project.usp}</p></div>}
                {project.target_location && <div><span className="text-gray-500 text-xs">Target Location</span><p className="text-white font-medium">{project.target_location}</p></div>}
                {project.target_audience_hint && <div><span className="text-gray-500 text-xs">Ideal Customer Hint</span><p className="text-gray-300 text-xs">{project.target_audience_hint}</p></div>}
              </div>
              <button
                onClick={() => generateMutation.mutate({ tool: 'audience', input: input.description ? { description: input.description } : undefined })}
                disabled={generateMutation.isPending}
                className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
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
                  <h3 className="text-base font-bold text-white">AI Generated {generatedOptions.length} Audience Personas</h3>
                  <button onClick={() => generateMutation.mutate({ tool: 'audience' })} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
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
                          <span className="text-[10px] font-semibold text-gray-400">Persona {i + 1}</span>
                          {isSelected && <Check size={14} className="text-indigo-400" />}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center mb-3 mx-auto">
                          <UserCircle size={24} className="text-indigo-300" />
                        </div>
                        <p className="text-sm font-bold text-white text-center">{persona.label}</p>
                        <p className="text-[10px] text-gray-400 text-center mt-0.5">{persona.demographics?.split(',')[0]}</p>

                        <div className="mt-4 space-y-2 text-[11px]">
                          {persona.situation && <div className="flex gap-2"><AlertTriangle size={10} className="text-red-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Pain Points</span><p className="text-gray-300">{persona.situation.slice(0, 60)}</p></div></div>}
                          {persona.goals && <div className="flex gap-2"><Target size={10} className="text-emerald-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Goals</span><p className="text-gray-300">{persona.goals.slice(0, 60)}</p></div></div>}
                          {persona.buying_triggers && <div className="flex gap-2"><Zap size={10} className="text-amber-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Triggers</span><p className="text-gray-300">{persona.buying_triggers.slice(0, 60)}</p></div></div>}
                          {persona.awareness_level && <div className="flex gap-2"><Users size={10} className="text-blue-400 shrink-0 mt-0.5" /><div><span className="text-gray-500">Awareness</span><p className="text-gray-300">{persona.awareness_level.split(' ')[0]}</p></div></div>}
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedAudience(persona); saveMutation.mutate({ tool: 'audience', value: persona }); }}
                          disabled={saveMutation.isPending}
                          className={`w-full mt-4 py-2 rounded-xl text-xs font-semibold transition-all ${
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
                    <p className="text-sm text-gray-400">{intelligence.audience!.demographics}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4">{intelligence.audience!.situation}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {intelligence.audience!.goals && <div><span className="text-emerald-400 font-medium">Goals:</span> <span className="text-gray-300">{intelligence.audience!.goals}</span></div>}
                  {intelligence.audience!.buying_triggers && <div><span className="text-amber-400 font-medium">Triggers:</span> <span className="text-gray-300">{intelligence.audience!.buying_triggers}</span></div>}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setActiveStep(2)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    Generate Ads →
                  </button>
                  <button onClick={() => generateMutation.mutate({ tool: 'audience' })} className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 border border-white/10">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Users size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-base font-medium text-gray-400">Generate your audience personas</p>
                <p className="text-sm text-gray-500 mt-1">Click &quot;Generate Personas&quot; to get AI-powered audience profiles</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Generate Ads */}
      {activeStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Audience context */}
          <div className="lg:col-span-2 space-y-4">
            {intelligence.audience && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <UserCircle size={20} className="text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-white">{intelligence.audience.label}</p>
                    <p className="text-[10px] text-gray-400">{intelligence.audience.demographics}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mb-3">{intelligence.audience.situation}</p>
                {intelligence.audience.goals && <p className="text-[10px] text-gray-400"><span className="text-emerald-400">Goals:</span> {intelligence.audience.goals}</p>}
              </div>
            )}
          </div>

          {/* Right: Campaign generation */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Platform toggle */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex gap-2">
                  {(['meta', 'google'] as const).map(p => (
                    <button key={p} onClick={() => { setActivePlatform(p); setGeneratedAsset(null); }}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activePlatform === p ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:bg-white/5 border border-white/10'}`}>
                      {p === 'meta' ? '◎ Meta Ads' : 'G Google Ads'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone selector */}
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Tone:</p>
                <div className="flex flex-wrap gap-2">
                  {tones.map(t => (
                    <button key={t} onClick={() => setInput({ ...input, tone: input.tone === t ? '' : t })}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${input.tone === t ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 border border-white/10 hover:bg-white/5'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <textarea value={input.instruction || ''} onChange={(e) => setInput({ ...input, instruction: e.target.value })}
                placeholder="Additional instructions (optional)... e.g. Focus on festival season, target college students"
                rows={2} className="w-full px-4 py-3 rounded-xl text-sm resize-none mb-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />

              {/* Generate button */}
              <button
                onClick={() => generateMutation.mutate({ tool: activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign', input: Object.keys(input).length > 0 ? input : undefined })}
                disabled={generateMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {generateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating Campaign...</> : <><Wand2 size={14} /> Generate Campaign Concept</>}
              </button>
            </div>

            {/* Generated campaigns */}
            {generatedAsset && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Generated Campaign Concept</h3>
                    <p className="text-xs text-gray-400">Campaign generated for your audience</p>
                  </div>
                  <button onClick={() => setGeneratedAsset(null)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                    <RefreshCw size={10} /> Generate Another
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {generatedAsset.items.map((item, i) => {
                    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
                    const text = Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
                    const key = `gen_${i}`;
                    const borderColors = ['border-indigo-500/30', 'border-purple-500/30', 'border-emerald-500/30'];
                    const badgeColors = ['bg-indigo-500/20 text-indigo-300', 'bg-purple-500/20 text-purple-300', 'bg-emerald-500/20 text-emerald-300'];
                    return (
                      <div key={i} className={`rounded-2xl overflow-hidden border ${borderColors[i]}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {/* Image placeholder */}
                        <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-2">Ad Creative Preview</p>
                            <div className="flex gap-2 justify-center">
                              <button className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30">
                                Generate Image
                              </button>
                              <button className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10">
                                Generate Prompt
                              </button>
                            </div>
                          </div>
                          <span className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[9px] font-bold ${badgeColors[i]}`}>
                            Campaign {i + 1}
                          </span>
                          {i === 0 && <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Best Match</span>}
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-2.5">
                          {obj.emotional_angle ? <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold ${badgeColors[i]}`}>{String(obj.emotional_angle)}</span> : null}

                          {obj.hook ? <div><p className="text-[9px] font-semibold uppercase text-indigo-400">Hook</p><p className="text-xs text-white font-medium">{String(obj.hook)}</p></div> : null}

                          {obj.primary_text ? <div><p className="text-[9px] font-semibold uppercase text-indigo-400">Primary Text</p><p className="text-[11px] text-gray-300 leading-relaxed">{String(obj.primary_text).slice(0, 120)}{String(obj.primary_text).length > 120 ? '...' : ''}</p></div> : null}

                          {obj.headline ? <div><p className="text-[9px] font-semibold uppercase text-indigo-400">Headline</p><p className="text-xs text-white font-medium">{String(obj.headline)}</p></div> : null}

                          {obj.cta ? <div><p className="text-[9px] font-semibold uppercase text-indigo-400">CTA</p><p className="text-xs text-white">{String(obj.cta)}</p></div> : null}

                          {/* Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => copyText(text, key)} className="flex-1 py-2 rounded-xl text-[11px] font-medium text-gray-400 border border-white/10 hover:bg-white/5 transition-all">
                              {copied === key ? '✓ Copied' : 'View Details'}
                            </button>
                            <button onClick={() => copyText(text, key)} className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-all">
                              Use This Campaign
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Previous campaigns */}
            {!generatedAsset && assets.filter(a => a.tool === `${activePlatform}_campaign`).length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-400">Previous campaigns</p>
                {assets.filter(a => a.tool === `${activePlatform}_campaign`).slice().reverse().slice(0, 3).map(asset =>
                  asset.items.map((item, i) => {
                    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
                    const text = Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
                    const key = `prev_${asset.id}_${i}`;
                    return (
                      <div key={key} className="rounded-2xl p-5 relative group" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {obj.campaign_name ? <p className="text-sm font-bold text-gray-200">{String(obj.campaign_name)}</p> : null}
                        {obj.hook ? <p className="text-xs text-gray-300 mt-1"><span className="text-indigo-400">Hook:</span> {String(obj.hook)}</p> : null}
                        {obj.headline ? <p className="text-xs text-gray-300"><span className="text-indigo-400">Headline:</span> {String(obj.headline)}</p> : null}
                        {obj.cta ? <p className="text-xs text-gray-300"><span className="text-indigo-400">CTA:</span> {String(obj.cta)}</p> : null}
                        <button onClick={() => copyText(text, key)} className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white">
                          {copied === key ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
