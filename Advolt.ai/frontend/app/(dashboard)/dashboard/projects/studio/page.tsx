'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import {
  Zap, Users, AlertTriangle, Heart, Target, Flame,
  Loader2, Check, ChevronLeft, RefreshCw, Copy, Wand2,
  MapPin, DollarSign, UserCircle, MessageSquare, FileText, Image, ArrowRight
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

interface EmotionalAngle {
  emotion: string;
  angle: string;
  example_hook: string;
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
  emotional_angles?: EmotionalAngle[];
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
    summary?: string;
    target_keywords?: string[];
    suggested_audiences?: string[];
    tone_recommendations?: string[];
    content_angles?: string[];
    pain_points?: string[];
    value_propositions?: string[];
    competitive_edge?: string;
  };
}

interface GenerateResponse {
  status: 'missing_dependencies' | 'options' | 'generated';
  missing?: string[];
  tool?: string;
  options?: AudienceProfile[] | string[] | EmotionalAngle[];
  asset?: Asset;
}

const STEPS = [
  { id: 1, label: 'Define Audience' },
  { id: 2, label: 'Set Foundation' },
  { id: 3, label: 'Select Platforms' },
  { id: 4, label: 'Design Ads' },
];

export default function ProjectStudioPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(1);
  const [input, setInput] = useState<Record<string, string>>({});
  const [generatedOptions, setGeneratedOptions] = useState<AudienceProfile[] | string[] | EmotionalAngle[] | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<Asset | null>(null);
  const [missingDeps, setMissingDeps] = useState<string[] | null>(null);
  const [copied, setCopied] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedAngles, setSelectedAngles] = useState<EmotionalAngle[]>([]);
  const [activePlatform, setActivePlatform] = useState<'meta' | 'google'>('meta');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: ({ tool, input: inp }: { tool: string; input?: Record<string, string> }) =>
      projectsApi.generate(projectId!, tool, inp).then((r) => r.data as GenerateResponse),
    onSuccess: (data: GenerateResponse) => {
      if (data.status === 'missing_dependencies') {
        setMissingDeps(data.missing || []);
        setGeneratedOptions(null);
        setGeneratedAsset(null);
      } else if (data.status === 'options') {
        const opts = data.options || [];
        setGeneratedOptions(opts);
        setMissingDeps(null);
        setGeneratedAsset(null);
        if (activeTool && ['pain_points', 'desires', 'objections'].includes(activeTool)) {
          setSelectedItems(opts as string[]);
        }
        if (activeTool === 'emotional_angles') {
          setSelectedAngles(opts as EmotionalAngle[]);
        }
      } else if (data.status === 'generated') {
        setGeneratedAsset(data.asset || null);
        setMissingDeps(null);
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
      setSelectedItems([]);
      setSelectedAngles([]);
    },
  });

  if (!projectId) { router.push('/dashboard/projects'); return null; }
  if (isLoading || !project) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>;
  }

  const intelligence = project.intelligence || {};
  const assets = project.assets || [];

  const getCurrentStep = () => {
    if (!intelligence.audience) return 1;
    if (!intelligence.pain_points?.length || !intelligence.desires?.length || !intelligence.emotional_angles?.length) return 2;
    if (!assets.some(a => a.tool.startsWith('audience_'))) return 3;
    return 4;
  };

  const handleGenerate = (tool: string) => {
    setActiveTool(tool);
    const inp = { ...input };
    if (notes) inp.custom = notes;
    generateMutation.mutate({ tool, input: Object.keys(inp).length > 0 ? inp : undefined });
    setShowNotes(false);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/projects')} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">The Campaign Builder</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.project_name} · {project.business_name}</p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const current = getCurrentStep();
          const isActive = step.id === activeStep;
          const isDone = step.id < current;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${
                  isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                  isDone ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 hover:bg-white/5'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  {isDone ? '✓' : step.id}
                </span>
                {step.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-700" />}
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className={`grid grid-cols-1 lg:grid-cols-5 gap-6 ${activeStep === 4 ? 'lg:grid-flow-dense' : ''}`}>
        {/* Left Panel — Steps 1-3: step content, Step 4: audience intelligence */}
        <div className={`${activeStep === 4 ? 'lg:col-span-2' : 'lg:col-span-2'} space-y-4`}>
          {activeStep === 1 && (
            <StepAudience
              project={project}
              intelligence={intelligence}
              input={input}
              setInput={setInput}
              onGenerate={() => handleGenerate('audience')}
              generatedOptions={generatedOptions as AudienceProfile[] | null}
              selectedAudience={selectedAudience}
              setSelectedAudience={setSelectedAudience}
              onSave={(val) => saveMutation.mutate({ tool: 'audience', value: val })}
              isGenerating={generateMutation.isPending}
              isSaving={saveMutation.isPending}
              activeTool={activeTool}
            />
          )}

          {activeStep === 2 && (
            <StepFoundation
              intelligence={intelligence}
              input={input}
              setInput={setInput}
              onGenerate={handleGenerate}
              generatedOptions={generatedOptions}
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
              selectedAngles={selectedAngles}
              setSelectedAngles={setSelectedAngles}
              onSave={(tool, val) => saveMutation.mutate({ tool, value: val })}
              isGenerating={generateMutation.isPending}
              isSaving={saveMutation.isPending}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
            />
          )}

          {activeStep === 3 && (
            <StepPlatforms
              projectId={projectId!}
              assets={assets}
              activePlatform={activePlatform}
              setActivePlatform={setActivePlatform}
              onCopy={copyText}
              copied={copied}
            />
          )}

          {/* Step 4: Left side shows audience context */}
          {activeStep === 4 && intelligence.audience && (
            <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <UserCircle size={20} className="text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold">{intelligence.audience.label}</p>
                    <p className="text-xs text-gray-400">{intelligence.audience.demographics}</p>
                  </div>
                </div>
                {intelligence.audience.situation && <p className="text-xs text-gray-300 mb-2">{intelligence.audience.situation}</p>}
              </div>
              {intelligence.pain_points && intelligence.pain_points.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-bold text-red-300 mb-2">Pain Points</p>
                  {intelligence.pain_points.slice(0, 3).map((p, i) => <p key={i} className="text-xs text-gray-300 mb-1">• {p}</p>)}
                </div>
              )}
              {intelligence.emotional_angles && intelligence.emotional_angles.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-bold text-orange-300 mb-2">Emotional Angles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {intelligence.emotional_angles.map((a, i) => (
                      <span key={i} className="px-2 py-1 rounded text-[10px] bg-orange-500/10 text-orange-300 border border-orange-500/20 capitalize">{a.emotion}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel — Steps 1-3: intelligence dashboard, Step 4: ad generation workspace */}
        <div className="lg:col-span-3 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          {activeStep === 4 ? (
            <StepDesignAds
              projectId={projectId!}
              assets={assets}
              activePlatform={activePlatform}
              setActivePlatform={setActivePlatform}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              input={input}
              setInput={setInput}
              onGenerate={handleGenerate}
              generatedAsset={generatedAsset}
              setGeneratedAsset={setGeneratedAsset}
              isGenerating={generateMutation.isPending}
              onCopy={copyText}
              copied={copied}
            />
          ) : (
            <>
          {/* Platform toggle */}
          <div className="flex justify-end">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['meta', 'google'] as const).map(p => (
                <button key={p} onClick={() => setActivePlatform(p)}
                  className={`px-5 py-2.5 text-sm font-medium transition-colors ${activePlatform === p ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                  {p === 'meta' ? '◎ Meta Ads' : 'G Google Ads'}
                </button>
              ))}
            </div>
          </div>

          {intelligence.audience ? (
            <div className="space-y-5">
              {/* Ideal Audience Card */}
              <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <UserCircle size={28} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{intelligence.audience.label || 'Ideal Audience'}</h3>
                    <p className="text-sm mt-2 text-gray-200 leading-relaxed">
                      {intelligence.audience.situation || intelligence.audience.psychographics || intelligence.audience.demographics || 'Target audience defined'}
                    </p>
                    {intelligence.audience.demographics && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {intelligence.audience.demographics.split(',').map((tag, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-gray-200 border border-white/10">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    {intelligence.audience.goals && (
                      <p className="text-xs mt-3 text-gray-400"><span className="text-gray-300">Goals:</span> {intelligence.audience.goals}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pain Points & Desires */}
              {(intelligence.pain_points?.length || intelligence.desires?.length) && (
                <div className="grid grid-cols-2 gap-5">
                  {intelligence.pain_points && intelligence.pain_points.length > 0 && (
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <AlertTriangle size={12} className="text-red-400" />
                        </div>
                        <span className="text-sm font-bold text-white">Pain Points</span>
                      </div>
                      <div className="space-y-2">
                        {intelligence.pain_points.slice(0, 4).map((p, i) => (
                          <p key={i} className="text-sm text-gray-300 leading-relaxed">• {p}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {intelligence.desires && intelligence.desires.length > 0 && (
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Heart size={12} className="text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold text-white">Desires</span>
                      </div>
                      <div className="space-y-2">
                        {intelligence.desires.slice(0, 4).map((d, i) => (
                          <p key={i} className="text-sm text-gray-300 leading-relaxed">• {d}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interests & Behaviors */}
              {(() => {
                const platformAssets = assets.filter(a => a.tool === `audience_${activePlatform}`);
                const latest = platformAssets.length > 0 ? platformAssets[platformAssets.length - 1] : null;
                const data = latest?.items?.[0] as Record<string, string[]> | undefined;
                if (!data) return null;
                const interests = Array.isArray(data.interests) ? data.interests : [];
                const behaviors = Array.isArray(data.behaviors) ? data.behaviors : [];
                if (!interests.length && !behaviors.length) return null;
                return (
                  <div className="grid grid-cols-2 gap-5">
                    {interests.length > 0 && (
                      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <Zap size={12} className="text-yellow-400" />
                          </div>
                          <span className="text-sm font-bold text-white">Interests</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {interests.slice(0, 5).map((item: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-gray-200 border border-white/10">{item}</span>
                          ))}
                          {interests.length > 5 && (
                            <span className="px-2.5 py-1 rounded-lg text-xs text-gray-500">+{interests.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    {behaviors.length > 0 && (
                      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Users size={12} className="text-blue-400" />
                          </div>
                          <span className="text-sm font-bold text-white">Behaviors</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {behaviors.slice(0, 5).map((item: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-gray-200 border border-white/10">{item}</span>
                          ))}
                          {behaviors.length > 5 && (
                            <span className="px-2.5 py-1 rounded-lg text-xs text-gray-500">+{behaviors.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Emotional Angles — 5 column */}
              {intelligence.emotional_angles && intelligence.emotional_angles.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Flame size={12} className="text-orange-400" />
                    </div>
                    <span className="text-sm font-bold text-white">Emotional Angles</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {intelligence.emotional_angles.slice(0, 5).map((a, i) => {
                      const configs = [
                        { color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '💡' },
                        { color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '⭐' },
                        { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '🔄' },
                        { color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🔥' },
                        { color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: '👥' },
                      ];
                      const cfg = configs[i % configs.length];
                      return (
                        <div key={i} className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border} text-center`}>
                          <p className="text-lg mb-1">{cfg.icon}</p>
                          <p className={`text-xs font-bold capitalize ${cfg.color}`}>{a.emotion}</p>
                          <p className="text-[10px] mt-1 text-gray-400 leading-tight">{a.angle?.slice(0, 35)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Audience Size & Budget */}
              {(() => {
                const platformAssets = assets.filter(a => a.tool === `audience_${activePlatform}`);
                const latest = platformAssets.length > 0 ? platformAssets[platformAssets.length - 1] : null;
                const data = latest?.items?.[0] as Record<string, string> | undefined;
                if (!data) return null;
                return (
                  <div className="grid grid-cols-2 gap-5">
                    {data.estimated_audience_size && (
                      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Users size={12} className="text-emerald-400" />
                          </div>
                          <span className="text-xs font-medium text-gray-400">Audience Size (Estimated)</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{data.estimated_audience_size}</p>
                        <p className="text-xs text-gray-400 mt-1">People on {activePlatform === 'meta' ? 'Meta' : 'Google'}</p>
                        {data.audience_quality && (
                          <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {data.audience_quality}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                          <DollarSign size={12} className="text-indigo-400" />
                        </div>
                        <span className="text-xs font-medium text-gray-400">Budget Recommendation</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{data.budget_recommendation?.split(',')[0] || '—'}</p>
                      <p className="text-xs text-gray-400 mt-1">{data.estimated_cpc ? `Cost per click: ${data.estimated_cpc}` : data.budget_recommendation?.split(',').slice(1).join(',').trim() || ''}</p>
                      {data.estimated_cpc && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Optimized
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Users size={40} className="mx-auto text-gray-600 mb-3" />
              <p className="text-base font-medium text-gray-400">Define your audience first</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Complete Step 1 to see targeting intelligence here</p>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Step 1: Define Audience ──
function StepAudience({ project, intelligence, input, setInput, onGenerate, generatedOptions, selectedAudience, setSelectedAudience, onSave, isGenerating, isSaving, activeTool }: {
  project: Project; intelligence: Intelligence; input: Record<string, string>; setInput: (v: Record<string, string>) => void;
  onGenerate: () => void; generatedOptions: AudienceProfile[] | null; selectedAudience: AudienceProfile | null;
  setSelectedAudience: (v: AudienceProfile | null) => void; onSave: (v: unknown) => void; isGenerating: boolean; isSaving: boolean; activeTool: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3">Define your ideal customer</h3>
        <textarea
          value={input.description || ''}
          onChange={(e) => setInput({ ...input, description: e.target.value })}
          placeholder="e.g. Small business owners aged 25-45 who struggle with marketing..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none mb-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />

        {project.ai_analysis?.suggested_audiences && !intelligence.audience && (
          <div className="mb-3">
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Suggestions:</p>
            <div className="flex flex-wrap gap-1.5">
              {project.ai_analysis.suggested_audiences.map((a, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{a}</span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onGenerate} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
          {isGenerating ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Wand2 size={14} /> Generate</>}
        </button>
      </div>

      {/* Generated options */}
      {generatedOptions && activeTool === 'audience' && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium">AI Persona Generation</p>
          {(generatedOptions as AudienceProfile[]).map((opt, i) => (
            <div key={i} onClick={() => setSelectedAudience(opt)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${selectedAudience === opt ? 'bg-indigo-500/15 border-indigo-500/40' : 'hover:bg-white/5'}`}
              style={{ border: selectedAudience === opt ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)' }}>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{opt.demographics}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{opt.situation}</p>
              {opt.goals && <p className="text-xs mt-1"><span className="text-gray-400">Goals:</span> {opt.goals}</p>}
              {opt.buying_triggers && <p className="text-xs mt-1"><span className="text-gray-400">Trigger:</span> {opt.buying_triggers}</p>}
            </div>
          ))}
          <button onClick={() => selectedAudience && onSave(selectedAudience)} disabled={!selectedAudience || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm Selection
          </button>
        </div>
      )}

      {/* Current audience */}
      {intelligence.audience && !generatedOptions && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <UserCircle size={40} className="text-indigo-400" />
            <div>
              <p className="text-sm font-bold">{intelligence.audience.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{intelligence.audience.demographics}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div><span className="font-medium text-gray-300">Situation:</span> <span style={{ color: 'var(--text-muted)' }}>{intelligence.audience.situation}</span></div>
            {intelligence.audience.goals && <div><span className="font-medium text-gray-300">Goals:</span> <span style={{ color: 'var(--text-muted)' }}>{intelligence.audience.goals}</span></div>}
            {intelligence.audience.buying_triggers && <div><span className="font-medium text-gray-300">Trigger:</span> <span style={{ color: 'var(--text-muted)' }}>{intelligence.audience.buying_triggers}</span></div>}
            {intelligence.audience.objections && <div><span className="font-medium text-gray-300">Objections:</span> <span style={{ color: 'var(--text-muted)' }}>{intelligence.audience.objections}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Set Foundation ──
function StepFoundation({ intelligence, input, setInput, onGenerate, generatedOptions, selectedItems, setSelectedItems, selectedAngles, setSelectedAngles, onSave, isGenerating, isSaving, activeTool, setActiveTool }: {
  intelligence: Intelligence; input: Record<string, string>; setInput: (v: Record<string, string>) => void;
  onGenerate: (tool: string) => void; generatedOptions: AudienceProfile[] | string[] | EmotionalAngle[] | null; selectedItems: string[]; setSelectedItems: (v: string[]) => void;
  selectedAngles: EmotionalAngle[]; setSelectedAngles: (v: EmotionalAngle[]) => void;
  onSave: (tool: string, val: unknown) => void; isGenerating: boolean; isSaving: boolean; activeTool: string | null; setActiveTool: (v: string | null) => void;
}) {
  const tools = [
    { id: 'pain_points', label: 'Pain Points', icon: AlertTriangle, done: !!intelligence.pain_points?.length },
    { id: 'desires', label: 'Desires', icon: Heart, done: !!intelligence.desires?.length },
    { id: 'objections', label: 'Objections', icon: Target, done: !!intelligence.objections?.length },
    { id: 'emotional_angles', label: 'Emotional Angles', icon: Flame, done: !!intelligence.emotional_angles?.length },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3">Build Your Foundation</h3>
        <div className="grid grid-cols-2 gap-2">
          {tools.map(t => (
            <button key={t.id} onClick={() => { setActiveTool(t.id); setInput({}); }}
              className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium transition-colors text-left ${
                activeTool === t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/5'
              }`} style={{ border: activeTool !== t.id ? '1px solid var(--border)' : undefined }}>
              <t.icon size={14} />
              <span className="flex-1">{t.label}</span>
              {t.done && <Check size={12} className="text-emerald-400" />}
            </button>
          ))}
        </div>
      </div>

      {activeTool && ['pain_points', 'desires', 'objections'].includes(activeTool) && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <textarea value={input.custom || ''} onChange={(e) => setInput({ custom: e.target.value })}
            placeholder="Add your own (optional)..." rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none mb-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={() => onGenerate(activeTool)} disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generate
          </button>

          {generatedOptions && Array.isArray(generatedOptions) && typeof generatedOptions[0] === 'string' && (
            <div className="mt-3 space-y-1.5">
              {(generatedOptions as string[]).map((item, i) => (
                <label key={i} className="flex items-start gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={selectedItems.includes(item)}
                    onChange={() => setSelectedItems(selectedItems.includes(item) ? selectedItems.filter(x => x !== item) : [...selectedItems, item])}
                    className="mt-0.5 rounded" />
                  <span className="text-xs">{item}</span>
                </label>
              ))}
              <button onClick={() => onSave(activeTool, selectedItems)} disabled={selectedItems.length === 0 || isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-500 text-white disabled:opacity-50 mt-2">
                {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save ({selectedItems.length})
              </button>
            </div>
          )}
        </div>
      )}

      {activeTool === 'emotional_angles' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <button onClick={() => onGenerate('emotional_angles')} disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 mb-3">
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generate Angles
          </button>
          {generatedOptions && Array.isArray(generatedOptions) && typeof generatedOptions[0] === 'object' && 'emotion' in (generatedOptions[0] as object) && (
            <div className="space-y-2">
              {(generatedOptions as EmotionalAngle[]).map((opt, i) => (
                <label key={i} className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer ${selectedAngles.includes(opt) ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
                  style={{ border: selectedAngles.includes(opt) ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selectedAngles.includes(opt)}
                    onChange={() => setSelectedAngles(selectedAngles.includes(opt) ? selectedAngles.filter(a => a !== opt) : [...selectedAngles, opt])}
                    className="mt-0.5 rounded" />
                  <div>
                    <p className="text-xs font-medium capitalize">{opt.emotion}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.angle}</p>
                  </div>
                </label>
              ))}
              <button onClick={() => onSave('emotional_angles', selectedAngles)} disabled={selectedAngles.length === 0 || isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-500 text-white disabled:opacity-50">
                {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save ({selectedAngles.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Select Platforms (Targeting) ──
function StepPlatforms({ projectId, assets, activePlatform, setActivePlatform, onCopy, copied }: {
  projectId: string; assets: Asset[]; activePlatform: 'meta' | 'google'; setActivePlatform: (v: 'meta' | 'google') => void;
  onCopy: (t: string, k: string) => void; copied: string;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generate(projectId, `audience_${activePlatform}`, notes ? { custom: notes } : undefined).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', projectId] }); setNotes(''); },
  });

  const platformAssets = assets.filter(a => a.tool === `audience_${activePlatform}`);
  const latest = platformAssets.length > 0 ? platformAssets[platformAssets.length - 1] : null;
  const data = latest?.items?.[0] as Record<string, unknown> | undefined;

  // Extract counts from data
  const getCount = (key: string) => {
    if (!data || !data[key]) return 0;
    return Array.isArray(data[key]) ? (data[key] as unknown[]).length : 1;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-1">Audience Builder</h3>
        <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>Configure your audience inputs</p>

        {/* Audience Sources */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-indigo-400" />
            <span className="text-xs font-medium">Audience Sources</span>
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Lookalike Audiences</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-medium">{getCount('lookalike_suggestions')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Custom Audiences</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-medium">{getCount('custom_audience_ideas')}</span>
            </div>
          </div>
        </div>

        {/* Targeting */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-indigo-400" />
            <span className="text-xs font-medium">Targeting</span>
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Demographics</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-medium">{data?.demographics_targeting ? 1 : 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Behaviors</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-medium">{getCount('behaviors')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Interests</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-medium">{getCount('interests')}</span>
            </div>
          </div>
        </div>

        {/* Optimization */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 size={12} className="text-indigo-400" />
            <span className="text-xs font-medium">Optimization</span>
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Exclusions</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-medium">{getCount('exclusions')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>Budget & Bidding</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{data?.budget_recommendation ? '✓' : '—'}</span>
            </div>
          </div>
        </div>

        {/* Generate / Regenerate */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Targeting notes (optional)..."
            className="w-full px-3 py-2 rounded-lg text-xs mb-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
            {generateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {latest ? 'Regenerate Audience' : 'Generate Audience'}
          </button>
          <p className="text-[9px] text-center mt-1.5" style={{ color: 'var(--text-muted)' }}>AI will {latest ? 'reanalyze and refine' : 'generate'} audience insights</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Design Ads ──
function StepDesignAds({ projectId, assets, activePlatform, setActivePlatform, activeTool, setActiveTool, input, setInput, onGenerate, generatedAsset, setGeneratedAsset, isGenerating, onCopy, copied }: {
  projectId: string; assets: Asset[]; activePlatform: 'meta' | 'google'; setActivePlatform: (v: 'meta' | 'google') => void;
  activeTool: string | null; setActiveTool: (v: string | null) => void; input: Record<string, string>; setInput: (v: Record<string, string>) => void;
  onGenerate: (tool: string) => void; generatedAsset: Asset | null; setGeneratedAsset: (v: Asset | null) => void; isGenerating: boolean;
  onCopy: (t: string, k: string) => void; copied: string;
}) {
  const [mode, setMode] = useState<'campaign' | 'individual'>('campaign');

  const tones = ['Bold', 'Emotional', 'Funny', 'Luxury', 'Aggressive', 'Minimal', 'Gen-Z', 'Professional'];

  const metaTools = [
    { id: 'meta_hooks', label: 'Hooks' }, { id: 'meta_primary_text', label: 'Primary Text' },
    { id: 'meta_headlines', label: 'Headlines' }, { id: 'meta_ctas', label: 'CTAs' }, { id: 'meta_creatives', label: 'Creatives' },
  ];
  const googleTools = [
    { id: 'google_keywords', label: 'Keywords' }, { id: 'google_headlines', label: 'Headlines' },
    { id: 'google_descriptions', label: 'Descriptions' }, { id: 'google_extensions', label: 'Extensions' },
    { id: 'google_ctas', label: 'CTAs' }, { id: 'google_landing_match', label: 'Landing Match' },
  ];

  const campaignTool = activePlatform === 'meta' ? 'meta_campaign' : 'google_campaign';
  const campaignAssets = assets.filter(a => a.tool === campaignTool);

  return (
    <div className="space-y-4">
      {/* Platform + Mode toggle */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {(['meta', 'google'] as const).map(p => (
              <button key={p} onClick={() => { setActivePlatform(p); setActiveTool(null); setGeneratedAsset(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activePlatform === p ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                {p === 'meta' ? '◎ Meta Ads' : 'G Google Ads'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setMode('campaign')} className={`px-3 py-1.5 rounded ${mode === 'campaign' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Campaign</button>
            <button onClick={() => setMode('individual')} className={`px-3 py-1.5 rounded ${mode === 'individual' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Individual</button>
          </div>
        </div>

        {mode === 'campaign' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-white">Generate Complete Campaign</p>
            <p className="text-xs text-gray-400">AI will create full campaign concepts with hook, copy, headline, CTA, and creative direction.</p>

            {/* Tone selector */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Tone (optional):</p>
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
              placeholder="Additional instructions (optional)... e.g. Focus on festival season, target college students"
              rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />

            <button onClick={() => onGenerate(campaignTool)} disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
              {isGenerating ? <><Loader2 size={14} className="animate-spin" /> Generating Campaigns...</> : <><Wand2 size={14} /> Generate 3 Campaign Concepts</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(activePlatform === 'meta' ? metaTools : googleTools).map(t => {
                const count = assets.filter(a => a.tool === t.id).length;
                return (
                  <button key={t.id} onClick={() => { setActiveTool(t.id); setGeneratedAsset(null); setInput({}); }}
                    className={`p-2.5 rounded-lg text-xs font-medium ${activeTool === t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-300 hover:bg-white/5'}`}
                    style={{ border: activeTool !== t.id ? '1px solid var(--border)' : undefined }}>
                    {t.label} {count > 0 && <span className="ml-1 text-gray-500">{count}</span>}
                  </button>
                );
              })}
            </div>
            {activeTool && (
              <>
                <textarea value={input.instruction || ''} onChange={(e) => setInput({ ...input, instruction: e.target.value })}
                  placeholder="Instructions (optional)..." rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <button onClick={() => onGenerate(activeTool)} disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
                  {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generate
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generated campaigns / assets */}
      {generatedAsset && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-emerald-400">✓ Generated</p>
          {generatedAsset.items.map((item, i) => {
            const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
            const text = typeof item === 'string' ? item : Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
            const key = `gen_${i}`;
            return (
              <div key={i} className="rounded-xl p-5 relative group" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {typeof item === 'object' && item !== null ? (
                  <div className="space-y-3">
                    {obj.campaign_name ? <p className="text-base font-bold text-white">{String(obj.campaign_name)}</p> : null}
                    {obj.emotional_angle ? <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">{String(obj.emotional_angle)}</span> : null}
                    {obj.search_intent ? <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">{String(obj.search_intent)}</span> : null}

                    {Object.entries(obj).filter(([k]) => !['campaign_name', 'emotional_angle', 'search_intent'].includes(k)).map(([field, value]) => {
                      const isLong = typeof value === 'string' && value.length > 60;
                      const isArray = Array.isArray(value);
                      return (
                        <div key={field}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400 mb-0.5">{field.replace(/_/g, ' ')}</p>
                          {isArray ? (
                            <div className="flex flex-wrap gap-1.5">
                              {(value as string[]).map((v, j) => <span key={j} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-200">{v}</span>)}
                            </div>
                          ) : (
                            <p className={`text-sm text-gray-200 leading-relaxed ${isLong ? 'whitespace-pre-line' : ''}`}>{String(value)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-200">{text}</p>
                )}
                <button onClick={() => onCopy(text, key)} className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white hover:bg-white/10">
                  {copied === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            );
          })}
          <button onClick={() => setGeneratedAsset(null)} className="text-xs text-indigo-300 hover:text-indigo-200">↻ Generate more</button>
        </div>
      )}

      {/* Previous campaigns */}
      {!generatedAsset && (mode === 'campaign' ? campaignAssets : assets.filter(a => a.tool === activeTool)).length > 0 && (
        <div className="space-y-4 max-h-[50vh] overflow-y-auto">
          <p className="text-xs font-medium text-gray-400">Previous campaigns</p>
          {(mode === 'campaign' ? campaignAssets : assets.filter(a => a.tool === activeTool)).slice().reverse().slice(0, 3).map(asset => (
            asset.items.map((item, i) => {
              const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
              const text = typeof item === 'string' ? item : Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
              const key = `prev_${asset.id}_${i}`;
              return (
                <div key={key} className="rounded-xl p-4 relative group" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {typeof item === 'object' && item !== null ? (
                    <div className="space-y-2">
                      {obj.campaign_name ? <p className="text-sm font-bold text-gray-200">{String(obj.campaign_name)}</p> : null}
                      {obj.hook ? <p className="text-xs text-gray-300"><span className="text-indigo-400 font-medium">Hook:</span> {String(obj.hook)}</p> : null}
                      {obj.headline ? <p className="text-xs text-gray-300"><span className="text-indigo-400 font-medium">Headline:</span> {typeof obj.headline === 'string' ? obj.headline : (obj.headlines as string[])?.join(' | ')}</p> : null}
                      {obj.cta ? <p className="text-xs text-gray-300"><span className="text-indigo-400 font-medium">CTA:</span> {String(obj.cta)}</p> : null}
                      {obj.why_it_works ? <p className="text-[10px] text-gray-500 italic mt-1">{String(obj.why_it_works)}</p> : null}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300">{text}</p>
                  )}
                  <button onClick={() => onCopy(text, key)} className="absolute top-3 right-3 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white">
                    {copied === key ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  </button>
                </div>
              );
            })
          ))}
        </div>
      )}
    </div>
  );
}

// ── Platform Content (targeting display) ──
function PlatformContent({ projectId, platform, assets, onCopy, copied }: {
  projectId: string; platform: 'meta' | 'google'; assets: Asset[]; onCopy: (t: string, k: string) => void; copied: string;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generate(projectId, `audience_${platform}`, notes ? { custom: notes } : undefined).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', projectId] }); setNotes(''); },
  });

  const platformAssets = assets.filter(a => a.tool === `audience_${platform}`);
  const latest = platformAssets.length > 0 ? platformAssets[platformAssets.length - 1] : null;

  if (!latest) {
    return (
      <div className="space-y-2">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Targeting notes (optional)..."
          className="w-full px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
          {generateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generate {platform === 'meta' ? 'Meta' : 'Google'} Targeting
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {latest.items.map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          return (
            <div key={i} className="grid grid-cols-2 gap-3">
              {Object.entries(item as Record<string, unknown>).map(([key, value]) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const sKey = `tgt_${platform}_${key}`;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium text-gray-400">{label}</p>
                      <button onClick={() => onCopy(Array.isArray(value) ? (value as string[]).join(', ') : String(value), sKey)} className="p-0.5 text-gray-600 hover:text-white">
                        {copied === sKey ? <Check size={8} className="text-emerald-400" /> : <Copy size={8} />}
                      </button>
                    </div>
                    {Array.isArray(value) ? (
                      <div className="flex flex-wrap gap-1">
                        {(value as string[]).slice(0, 6).map((v, j) => (
                          <span key={j} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-300">{v}</span>
                        ))}
                        {(value as string[]).length > 6 && <span className="text-[10px] text-gray-500">+{(value as string[]).length - 6}</span>}
                      </div>
                    ) : (
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{String(value)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        return null;
      })}
      <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50">
        {generateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Regenerate
      </button>
    </div>
  );
}
