'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import {
  Zap, Users, AlertTriangle, Heart, Flame, Target,
  MessageSquare, FileText, Video, Image, Wand2,
  Loader2, Check, ChevronLeft, RefreshCw, Copy, ArrowRight
} from 'lucide-react';

interface Project {
  project_id: string;
  project_name: string;
  business_name: string;
  business_niche: string;
  product_name: string;
  product_description: string;
  usp: string;
  intelligence?: {
    audience?: unknown;
    pain_points?: string[];
    desires?: string[];
    objections?: string[];
    emotional_angles?: unknown[];
  };
  assets?: Array<{
    id: string;
    tool: string;
    items: unknown[];
    input: Record<string, string>;
    created_at: string;
  }>;
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
  const [generatedOptions, setGeneratedOptions] = useState<unknown>(null);
  const [generatedAsset, setGeneratedAsset] = useState<unknown>(null);
  const [missingDeps, setMissingDeps] = useState<string[] | null>(null);
  const [copied, setCopied] = useState('');

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: ({ tool, input }: { tool: string; input?: Record<string, string> }) =>
      projectsApi.generate(projectId!, tool, input).then((r) => r.data),
    onSuccess: (data) => {
      if (data.status === 'missing_dependencies') {
        setMissingDeps(data.missing);
        setGeneratedOptions(null);
        setGeneratedAsset(null);
      } else if (data.status === 'options') {
        setGeneratedOptions(data.options);
        setMissingDeps(null);
        setGeneratedAsset(null);
      } else if (data.status === 'generated') {
        setGeneratedAsset(data.asset);
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
    if (tool === 'audience') return !!intelligence.audience;
    return !!(intelligence as Record<string, unknown>)[tool] && 
      (Array.isArray((intelligence as Record<string, unknown>)[tool]) 
        ? ((intelligence as Record<string, unknown>)[tool] as unknown[]).length > 0 
        : true);
  };

  const handleToolClick = (toolId: string) => {
    setActiveTool(toolId);
    setInput({});
    setGeneratedOptions(null);
    setGeneratedAsset(null);
    setMissingDeps(null);
  };

  const handleGenerate = () => {
    if (!activeTool) return;
    generateMutation.mutate({ tool: activeTool, input: Object.keys(input).length > 0 ? input : undefined });
  };

  const handleSaveFoundation = (value: unknown) => {
    if (!activeTool) return;
    saveMutation.mutate({ tool: activeTool, value });
  };

  const handleResolveDep = (dep: string) => {
    setActiveTool(dep);
    setMissingDeps(null);
    setGeneratedOptions(null);
    setGeneratedAsset(null);
    setInput({});
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
          {/* Foundation */}
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

          {/* Assets */}
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
              {/* Tool header */}
              <div>
                <h2 className="text-lg font-semibold">{TOOLS.find(t => t.id === activeTool)?.label}</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{TOOLS.find(t => t.id === activeTool)?.desc}</p>
              </div>

              {/* Missing dependencies */}
              {missingDeps && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-300 mb-2">We need a few things first:</p>
                  <div className="flex flex-wrap gap-2">
                    {missingDeps.map(dep => (
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
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Add your own (optional, AI will generate the rest)</label>
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
                        placeholder="e.g. Focus on urgency, use casual tone, target mobile users..."
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
                </div>
              )}

              {/* Foundation options (pick/confirm) */}
              {generatedOptions && activeTool && TOOLS.find(t => t.id === activeTool)?.category === 'foundation' && (
                <FoundationOptions
                  tool={activeTool}
                  options={generatedOptions}
                  onSave={handleSaveFoundation}
                  onRegenerate={handleGenerate}
                  isRegenerating={generateMutation.isPending}
                  isSaving={saveMutation.isPending}
                />
              )}

              {/* Generated asset display */}
              {generatedAsset && (
                <AssetDisplay
                  asset={generatedAsset as { tool: string; items: unknown[] }}
                  onCopy={copyText}
                  copied={copied}
                  onGenerateMore={handleGenerate}
                  isGenerating={generateMutation.isPending}
                />
              )}

              {/* Previously generated assets for this tool */}
              {activeTool && TOOLS.find(t => t.id === activeTool)?.category === 'asset' && !generatedAsset && !missingDeps && (
                <PreviousAssets
                  assets={assets.filter(a => a.tool === activeTool)}
                  onCopy={copyText}
                  copied={copied}
                />
              )}

              {/* Show current foundation value if already set */}
              {activeTool && TOOLS.find(t => t.id === activeTool)?.category === 'foundation' && getFoundationStatus(activeTool) && !generatedOptions && (
                <CurrentFoundation
                  tool={activeTool}
                  value={(intelligence as Record<string, unknown>)[activeTool]}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Foundation Options Component ──
function FoundationOptions({ tool, options, onSave, onRegenerate, isRegenerating, isSaving }: {
  tool: string;
  options: unknown;
  onSave: (value: unknown) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isSaving: boolean;
}) {
  const [selected, setSelected] = useState<unknown>(null);

  // Audience: pick one from options array
  if (tool === 'audience' && Array.isArray(options)) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Pick your target audience:</p>
        {options.map((opt: { label: string; demographics: string; psychographics: string; situation: string; awareness_level: string }, i: number) => (
          <div
            key={i}
            onClick={() => setSelected(opt)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              selected === opt ? 'bg-indigo-500/20 border-indigo-500/40' : 'hover:bg-white/5'
            }`}
            style={{ border: selected === opt ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium">{opt.label}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{opt.demographics}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.situation}</p>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
          <button
            onClick={() => selected && onSave(selected)}
            disabled={!selected || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm Selection
          </button>
        </div>
      </div>
    );
  }

  // Pain points, desires, objections: multi-select from list
  if (['pain_points', 'desires', 'objections'].includes(tool) && Array.isArray(options)) {
    const [selectedItems, setSelectedItems] = useState<string[]>(options as string[]);

    const toggleItem = (item: string) => {
      setSelectedItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Select the ones that apply (you can edit):</p>
        <div className="space-y-1.5">
          {(options as string[]).map((item, i) => (
            <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.includes(item)}
                onChange={() => toggleItem(item)}
                className="mt-0.5 rounded"
              />
              <span className="text-sm">{item}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
          <button
            onClick={() => onSave(selectedItems)}
            disabled={selectedItems.length === 0 || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save ({selectedItems.length})
          </button>
        </div>
      </div>
    );
  }

  // Emotional angles: pick favorites
  if (tool === 'emotional_angles' && Array.isArray(options)) {
    const [selectedAngles, setSelectedAngles] = useState<unknown[]>(options);

    const toggleAngle = (angle: unknown) => {
      setSelectedAngles(prev => prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]);
    };

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Select emotional angles to use:</p>
        <div className="space-y-2">
          {(options as Array<{ emotion: string; angle: string; example_hook: string }>).map((opt, i) => (
            <label
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedAngles.includes(opt) ? 'bg-indigo-500/10 border-indigo-500/30' : 'hover:bg-white/5'
              }`}
              style={{ border: selectedAngles.includes(opt) ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)' }}
            >
              <input
                type="checkbox"
                checked={selectedAngles.includes(opt)}
                onChange={() => toggleAngle(opt)}
                className="mt-0.5 rounded"
              />
              <div>
                <p className="text-sm font-medium capitalize">{opt.emotion}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.angle}</p>
                <p className="text-xs italic mt-0.5 text-indigo-300">"{opt.example_hook}"</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
          <button
            onClick={() => onSave(selectedAngles)}
            disabled={selectedAngles.length === 0 || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save ({selectedAngles.length})
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Asset Display Component ──
function AssetDisplay({ asset, onCopy, copied, onGenerateMore, isGenerating }: {
  asset: { tool: string; items: unknown[] };
  onCopy: (text: string, key: string) => void;
  copied: string;
  onGenerateMore: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-emerald-400">Generated:</p>
      <div className="space-y-2">
        {asset.items.map((item, i) => {
          const text = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
          const key = `${asset.tool}_${i}`;
          return (
            <div key={i} className="p-3 rounded-lg relative group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-sm pr-8 whitespace-pre-wrap">{text}</p>
              <button
                onClick={() => onCopy(text, key)}
                className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
              >
                {copied === key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onGenerateMore}
        disabled={isGenerating}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-colors"
      >
        <RefreshCw size={12} /> Generate More
      </button>
    </div>
  );
}

// ── Previous Assets Component ──
function PreviousAssets({ assets, onCopy, copied }: {
  assets: Array<{ id: string; tool: string; items: unknown[]; created_at: string }>;
  onCopy: (text: string, key: string) => void;
  copied: string;
}) {
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

// ── Current Foundation Display ──
function CurrentFoundation({ tool, value }: { tool: string; value: unknown }) {
  if (!value) return null;

  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium mb-2 text-emerald-400 flex items-center gap-1"><Check size={10} /> Current</p>
      {tool === 'audience' && typeof value === 'object' && value !== null && (
        <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
          <p className="font-medium text-white">{(value as Record<string, string>).label}</p>
          <p>{(value as Record<string, string>).demographics}</p>
          <p>{(value as Record<string, string>).situation}</p>
        </div>
      )}
      {Array.isArray(value) && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
              {typeof item === 'string' ? item : (item as Record<string, string>).emotion || JSON.stringify(item)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
