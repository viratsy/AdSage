'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import {
  Zap, Users, AlertTriangle, Heart, Flame, Target,
  MessageSquare, FileText, Video, Image, Wand2,
  Loader2, Check, ChevronLeft, RefreshCw, Copy, ArrowRight
} from 'lucide-react';

interface AudienceProfile {
  label: string;
  demographics: string;
  psychographics: string;
  situation: string;
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

const TOOLS = [
  { id: 'audience', label: 'Target Audience', icon: Users, category: 'foundation', desc: 'Define who you\'re selling to' },
  { id: 'pain_points', label: 'Pain Points', icon: AlertTriangle, category: 'foundation', desc: 'Problems your audience faces' },
  { id: 'desires', label: 'Desires & Goals', icon: Heart, category: 'foundation', desc: 'What your audience wants' },
  { id: 'objections', label: 'Objections', icon: Target, category: 'foundation', desc: 'Why people might not buy' },
  { id: 'emotional_angles', label: 'Emotional Angles', icon: Flame, category: 'foundation', desc: 'Angles to use in ads' },
  { id: 'hooks', label: 'Hooks', icon: Zap, category: 'asset', desc: 'Attention-grabbing openers' },
  { id: 'short_copy', label: 'Short Copy', icon: FileText, category: 'asset', desc: 'Quick ad copy under 50 words' },
  { id: 'long_copy', label: 'Long Copy', icon: FileText, category: 'asset', desc: 'Full ad copy with structure' },
  { id: 'ctas', label: 'CTAs', icon: MessageSquare, category: 'asset', desc: 'Call-to-action variations' },
  { id: 'video_script', label: 'Video Script', icon: Video, category: 'asset', desc: '30-60s video ad script' },
  { id: 'image_prompt', label: 'Image Prompts', icon: Image, category: 'asset', desc: 'AI image generation prompts' },
  { id: 'ad_brief', label: 'Ad Brief', icon: Wand2, category: 'asset', desc: 'Complete campaign brief' },
];

export default function ProjectStudioPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [input, setInput] = useState<Record<string, string>>({});
  const [generatedOptions, setGeneratedOptions] = useState<AudienceProfile[] | string[] | EmotionalAngle[] | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<Asset | null>(null);
  const [missingDeps, setMissingDeps] = useState<string[] | null>(null);
  const [copied, setCopied] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedAngles, setSelectedAngles] = useState<EmotionalAngle[]>([]);
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
        // Pre-select all for list types
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
      setActiveTool(null);
      setSelectedAudience(null);
      setSelectedItems([]);
      setSelectedAngles([]);
    },
  });

  if (!projectId) {
    router.push('/dashboard/projects');
    return null;
  }

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  const intelligence = project.intelligence || {};
  const assets = project.assets || [];

  const getFoundationStatus = (tool: string) => {
    const val = (intelligence as Record<string, unknown>)[tool];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  const handleToolClick = (toolId: string) => {
    setActiveTool(toolId);
    setInput({});
    setGeneratedOptions(null);
    setGeneratedAsset(null);
    setMissingDeps(null);
    setSelectedAudience(null);
    setSelectedItems([]);
    setSelectedAngles([]);
    setShowNotes(false);
    setNotes('');
  };

  const handleGenerate = () => {
    if (!activeTool) return;
    const inp = { ...input };
    if (notes) inp.custom = notes;
    generateMutation.mutate({ tool: activeTool, input: Object.keys(inp).length > 0 ? inp : undefined });
    setShowNotes(false);
  };

  const handleResolveDep = (dep: string) => {
    handleToolClick(dep);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const foundationTools = TOOLS.filter(t => t.category === 'foundation');
  const assetTools = TOOLS.filter(t => t.category === 'asset');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/projects')} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={18} className="text-indigo-400" />
            {project.project_name}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.business_name} · {project.business_niche}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tool selector */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Foundation</p>
            <div className="space-y-1">
              {foundationTools.map(tool => {
                const done = getFoundationStatus(tool.id);
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                      activeTool === tool.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="flex-1">{tool.label}</span>
                    {done && <Check size={12} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Generate</p>
            <div className="space-y-1">
              {assetTools.map(tool => {
                const Icon = tool.icon;
                const count = assets.filter(a => a.tool === tool.id).length;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                      activeTool === tool.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="flex-1">{tool.label}</span>
                    {count > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-white/10">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Active tool workspace */}
        <div className="lg:col-span-2">
          {!activeTool ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Zap size={32} className="mx-auto text-indigo-400 mb-3" />
              <h2 className="text-lg font-semibold mb-1">Advolt AI</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a tool to start generating. Build your foundation first for better results.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-lg font-semibold">{TOOLS.find(t => t.id === activeTool)?.label}</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{TOOLS.find(t => t.id === activeTool)?.desc}</p>
              </div>

              {/* Missing dependencies */}
              {missingDeps && missingDeps.length > 0 && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-300 mb-2">We need a few things first:</p>
                  <div className="flex flex-wrap gap-2">
                    {missingDeps.map((dep: string) => (
                      <button
                        key={dep}
                        onClick={() => handleResolveDep(dep)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                      >
                        {TOOLS.find(t => t.id === dep)?.label} <ArrowRight size={10} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input area */}
              {!missingDeps && !generatedOptions && !generatedAsset && (
                <div className="space-y-3">
                  {/* Pre-suggestions from ai_analysis */}
                  {activeTool === 'audience' && !intelligence.audience && project.ai_analysis?.suggested_audiences && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Suggested from your project analysis:</p>
                      <div className="flex flex-wrap gap-2">
                        {project.ai_analysis.suggested_audiences.map((aud, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-lg text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {aud}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTool === 'pain_points' && !intelligence.pain_points?.length && project.ai_analysis?.pain_points && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Suggested from your project analysis:</p>
                      <div className="flex flex-wrap gap-2">
                        {project.ai_analysis.pain_points.map((pp, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {pp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTool === 'emotional_angles' && !intelligence.emotional_angles?.length && project.ai_analysis?.content_angles && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Content angles from your analysis:</p>
                      <div className="flex flex-wrap gap-2">
                        {project.ai_analysis.content_angles.map((angle, i) => (
                          <span key={i} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {angle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTool === 'audience' && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Describe your ideal customer (optional)</label>
                      <textarea
                        value={input.description || ''}
                        onChange={(e) => setInput({ ...input, description: e.target.value })}
                        placeholder="e.g. Small business owners aged 25-45 who struggle with marketing..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                    </div>
                  )}

                  {['pain_points', 'desires', 'objections', 'emotional_angles'].includes(activeTool) && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Add your own (optional)</label>
                      <textarea
                        value={input.custom || ''}
                        onChange={(e) => setInput({ ...input, custom: e.target.value })}
                        placeholder="Add any specific ones you know about..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                    </div>
                  )}

                  {['hooks', 'short_copy', 'long_copy', 'ctas', 'video_script', 'image_prompt', 'ad_brief'].includes(activeTool) && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Additional instructions (optional)</label>
                      <textarea
                        value={input.instruction || ''}
                        onChange={(e) => setInput({ ...input, instruction: e.target.value })}
                        placeholder="e.g. Focus on urgency, use casual tone..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 size={14} className="animate-spin" /> Generating...</>
                    ) : (
                      <><Wand2 size={14} /> Generate</>
                    )}
                  </button>

                  {/* Show current foundation value */}
                  {TOOLS.find(t => t.id === activeTool)?.category === 'foundation' && getFoundationStatus(activeTool) && (
                    <div className="p-3 rounded-lg mt-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p className="text-xs font-medium mb-2 text-emerald-400 flex items-center gap-1"><Check size={10} /> Current</p>
                      <CurrentValue tool={activeTool} intelligence={intelligence} />
                    </div>
                  )}

                  {/* Platform targeting tabs (after audience is set) */}
                  {activeTool === 'audience' && getFoundationStatus('audience') && (
                    <PlatformTargeting
                      projectId={projectId!}
                      assets={assets}
                      onCopy={copyText}
                      copied={copied}
                    />
                  )}

                  {/* Previous assets */}
                  {TOOLS.find(t => t.id === activeTool)?.category === 'asset' && (
                    <PreviousAssets assets={assets.filter(a => a.tool === activeTool)} onCopy={copyText} copied={copied} />
                  )}
                </div>
              )}

              {/* Audience options */}
              {generatedOptions && activeTool === 'audience' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Pick your target audience:</p>
                  {(generatedOptions as AudienceProfile[]).map((opt, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedAudience(opt)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedAudience === opt ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                      }`}
                      style={{ border: selectedAudience === opt ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)' }}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{opt.demographics}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.situation}</p>
                    </div>
                  ))}
                  <NotesAndRegenerate
                    showNotes={showNotes}
                    notes={notes}
                    onToggleNotes={() => setShowNotes(!showNotes)}
                    onNotesChange={setNotes}
                    onRegenerate={handleGenerate}
                    isRegenerating={generateMutation.isPending}
                  />
                  <button
                    onClick={() => selectedAudience && saveMutation.mutate({ tool: 'audience', value: selectedAudience })}
                    disabled={!selectedAudience || saveMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm
                  </button>
                </div>
              )}

              {/* Pain points / desires / objections options */}
              {generatedOptions && activeTool && ['pain_points', 'desires', 'objections'].includes(activeTool) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Select the ones that apply:</p>
                  <div className="space-y-1.5">
                    {(generatedOptions as string[]).map((item, i) => (
                      <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item)}
                          onChange={() => setSelectedItems(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item])}
                          className="mt-0.5 rounded"
                        />
                        <span className="text-sm">{item}</span>
                      </label>
                    ))}
                  </div>
                  <NotesAndRegenerate
                    showNotes={showNotes}
                    notes={notes}
                    onToggleNotes={() => setShowNotes(!showNotes)}
                    onNotesChange={setNotes}
                    onRegenerate={handleGenerate}
                    isRegenerating={generateMutation.isPending}
                  />
                  <button
                    onClick={() => saveMutation.mutate({ tool: activeTool, value: selectedItems })}
                    disabled={selectedItems.length === 0 || saveMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save ({selectedItems.length})
                  </button>
                </div>
              )}

              {/* Emotional angles options */}
              {generatedOptions && activeTool === 'emotional_angles' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Select emotional angles to use:</p>
                  <div className="space-y-2">
                    {(generatedOptions as EmotionalAngle[]).map((opt, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedAngles.includes(opt) ? 'bg-indigo-500/10' : 'hover:bg-white/5'
                        }`}
                        style={{ border: selectedAngles.includes(opt) ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAngles.includes(opt)}
                          onChange={() => setSelectedAngles(prev => prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt])}
                          className="mt-0.5 rounded"
                        />
                        <div>
                          <p className="text-sm font-medium capitalize">{opt.emotion}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.angle}</p>
                          <p className="text-xs italic mt-0.5 text-indigo-300">&quot;{opt.example_hook}&quot;</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <NotesAndRegenerate
                    showNotes={showNotes}
                    notes={notes}
                    onToggleNotes={() => setShowNotes(!showNotes)}
                    onNotesChange={setNotes}
                    onRegenerate={handleGenerate}
                    isRegenerating={generateMutation.isPending}
                  />
                  <button
                    onClick={() => saveMutation.mutate({ tool: 'emotional_angles', value: selectedAngles })}
                    disabled={selectedAngles.length === 0 || saveMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save ({selectedAngles.length})
                  </button>
                </div>
              )}

              {/* Generated asset */}
              {generatedAsset && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-emerald-400">Generated:</p>
                  <div className="space-y-2">
                    {generatedAsset.items.map((item, i) => {
                      const text = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
                      const key = `new_${i}`;
                      return (
                        <div key={i} className="p-3 rounded-lg relative group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <p className="text-sm pr-8 whitespace-pre-wrap">{text}</p>
                          <button
                            onClick={() => copyText(text, key)}
                            className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                          >
                            {copied === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <NotesAndRegenerate
                    showNotes={showNotes}
                    notes={notes}
                    onToggleNotes={() => setShowNotes(!showNotes)}
                    onNotesChange={setNotes}
                    onRegenerate={() => { setGeneratedAsset(null); handleGenerate(); }}
                    isRegenerating={generateMutation.isPending}
                    label="Generate More"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentValue({ tool, intelligence }: { tool: string; intelligence: Intelligence }) {
  if (tool === 'audience' && intelligence.audience) {
    return (
      <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
        <p className="font-medium text-white">{intelligence.audience.label}</p>
        <p>{intelligence.audience.demographics}</p>
        <p>{intelligence.audience.situation}</p>
      </div>
    );
  }
  const val = (intelligence as Record<string, unknown>)[tool];
  if (Array.isArray(val)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {val.map((item: unknown, i: number) => (
          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
            {typeof item === 'string' ? item : (item as EmotionalAngle).emotion || ''}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function PreviousAssets({ assets, onCopy, copied }: { assets: Asset[]; onCopy: (t: string, k: string) => void; copied: string }) {
  if (assets.length === 0) return null;
  return (
    <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Previously generated:</p>
      {assets.slice().reverse().map((asset) => (
        <div key={asset.id} className="space-y-1.5">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(asset.created_at).toLocaleDateString()}</p>
          {asset.items.map((item, i) => {
            const text = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
            const key = `${asset.id}_${i}`;
            return (
              <div key={i} className="p-2.5 rounded-lg relative group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-xs pr-6 whitespace-pre-wrap">{text}</p>
                <button
                  onClick={() => onCopy(text, key)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                >
                  {copied === key ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


function NotesAndRegenerate({ showNotes, notes, onToggleNotes, onNotesChange, onRegenerate, isRegenerating, label }: {
  showNotes: boolean;
  notes: string;
  onToggleNotes: () => void;
  onNotesChange: (v: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  label?: string;
}) {
  return (
    <div className="space-y-2 pt-2">
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any suggestions or notes for regeneration? e.g. Make it more specific to B2B, focus on cost savings..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-xs resize-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={onToggleNotes}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 transition-colors"
        >
          {showNotes ? 'Hide notes' : '+ Add notes'}
        </button>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
        >
          {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {label || 'Regenerate'}
        </button>
      </div>
    </div>
  );
}


function PlatformTargeting({ projectId, assets, onCopy, copied }: {
  projectId: string;
  assets: Asset[];
  onCopy: (text: string, key: string) => void;
  copied: string;
}) {
  const [activeTab, setActiveTab] = useState<'meta' | 'google' | 'linkedin'>('meta');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: (platform: string) =>
      projectsApi.generate(projectId, `audience_${platform}`, notes ? { custom: notes } : undefined).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setNotes('');
      setShowNotes(false);
    },
  });

  const tabs = [
    { id: 'meta' as const, label: 'Meta' },
    { id: 'google' as const, label: 'Google' },
    { id: 'linkedin' as const, label: 'LinkedIn' },
  ];

  const platformAssets = assets.filter(a => a.tool === `audience_${activeTab}`);
  const latestAsset = platformAssets.length > 0 ? platformAssets[platformAssets.length - 1] : null;

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <p className="text-sm font-medium mb-3">Platform Targeting</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            {tab.label}
            {assets.filter(a => a.tool === `audience_${tab.id}`).length > 0 && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {latestAsset ? (
        <div className="space-y-2">
          {latestAsset.items.map((item, i) => {
            const text = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
            const key = `platform_${activeTab}_${i}`;
            return (
              <div key={i} className="p-3 rounded-lg relative group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <pre className="text-xs whitespace-pre-wrap pr-8" style={{ color: 'var(--text)' }}>{text}</pre>
                <button
                  onClick={() => onCopy(text, key)}
                  className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                >
                  {copied === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            );
          })}
          <div className="space-y-2 pt-2">
            {showNotes && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for regeneration? e.g. Focus on retargeting, exclude certain demographics..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5"
              >
                {showNotes ? 'Hide notes' : '+ Add notes'}
              </button>
              <button
                onClick={() => generateMutation.mutate(activeTab)}
                disabled={generateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
              >
                {generateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific targeting notes? e.g. Focus on B2B, exclude students..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-xs resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5"
            >
              {showNotes ? 'Hide notes' : '+ Add notes'}
            </button>
            <button
              onClick={() => generateMutation.mutate(activeTab)}
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <><Loader2 size={12} className="animate-spin" /> Generating...</>
              ) : (
                <><Wand2 size={12} /> Generate {tabs.find(t => t.id === activeTab)?.label} Targeting</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
