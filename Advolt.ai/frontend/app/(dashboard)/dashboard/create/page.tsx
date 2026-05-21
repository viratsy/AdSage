'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { aiApi, billingApi } from '@/lib/api';
import { Wand2, FileText, Zap, MessageSquare, Image, Video, RefreshCw, Copy, Check, User } from 'lucide-react';

const TOOLS = [
  { id: 'hooks', label: 'Hook Generator', icon: Zap, cost: 20, desc: 'Generate attention-grabbing hooks' },
  { id: 'ctas', label: 'CTA Generator', icon: MessageSquare, cost: 20, desc: 'Create compelling CTAs' },
  { id: 'short_copy', label: 'Short Copy', icon: FileText, cost: 30, desc: 'Quick ad copy under 50 words' },
  { id: 'long_copy', label: 'Long Copy', icon: FileText, cost: 50, desc: 'Full ad copy with hook + CTA' },
  { id: 'ad_brief', label: 'Ad Brief', icon: Wand2, cost: 30, desc: 'Complete campaign brief' },
  { id: 'image_prompt', label: 'Image Prompts', icon: Image, cost: 20, desc: 'AI image generation prompts' },
  { id: 'video_script', label: 'Video Script', icon: Video, cost: 50, desc: '30-60s video ad script' },
  { id: 'rewrite', label: 'Ad Rewriter', icon: RefreshCw, cost: 30, desc: 'Rewrite existing copy' },
];

export default function CreateStudioPage() {
  const [activeTool, setActiveTool] = useState('hooks');
  const [input, setInput] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [copied, setCopied] = useState('');
  const [usePersona, setUsePersona] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{ tool: string; result: unknown; date: string; input: Record<string, string> }>>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('advolt_studio_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Fetch user persona
  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const persona = billing?.business_persona;
  const personaObj = typeof persona === 'object' && persona ? persona : null;
  const personaStr = typeof persona === 'string' ? persona : null;

  // Prefill from persona when it loads
  useEffect(() => {
    if (usePersona && !input.product) {
      if (personaObj) {
        setInput((prev) => ({
          ...prev,
          product: personaObj.product_service || personaObj.business_name || '',
          audience: personaObj.target_audience || '',
          tone: personaObj.tone || personaObj.brand_voice || '',
        }));
      } else if (personaStr) {
        setInput((prev) => ({
          ...prev,
          product: personaStr.slice(0, 200),
        }));
      }
    }
  }, [persona, usePersona]);

  const saveToHistory = (toolId: string, res: unknown, inp: Record<string, string>) => {
    const entry = { tool: toolId, result: res, date: new Date().toISOString(), input: inp };
    const updated = [entry, ...history].slice(0, 20); // Keep last 20
    setHistory(updated);
    localStorage.setItem('advolt_studio_history', JSON.stringify(updated));
  };

  const generate = useMutation({
    mutationFn: () => aiApi.studio(activeTool, input).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data.result);
      saveToHistory(activeTool, data.result, input);
    },
  });

  const tool = TOOLS.find((t) => t.id === activeTool)!;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleGenerate = () => {
    setResult(null);
    generate.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wand2 size={20} className="text-indigo-400" /> AI Create Studio
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Generate ad content from scratch using AI — no saved ad needed.
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showHistory ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:bg-white/5'
          }`}
          style={{ border: '1px solid var(--border)' }}
        >
          {showHistory ? '← Back to Studio' : `History (${history.length})`}
        </button>
      </div>

      {showHistory ? (
        <HistoryView history={history} copyText={copyText} copied={copied} onLoad={(entry) => {
          setActiveTool(entry.tool);
          setInput(entry.input);
          setResult(entry.result);
          setShowHistory(false);
        }} />
      ) : (
      <>

      {/* Tool Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTool(t.id); setResult(null); }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all ${
              activeTool === t.id
                ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50'
                : 'text-gray-400 hover:bg-white/5'
            }`}
            style={{ border: '1px solid var(--border)' }}
          >
            <t.icon size={18} />
            {t.label}
            <span className="text-[10px] opacity-60">{t.cost} tokens</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <tool.icon size={14} className="text-indigo-400" /> {tool.label}
              <span className="text-xs font-normal ml-auto" style={{ color: 'var(--text-muted)' }}>{tool.cost} tokens</span>
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tool.desc}</p>

            {/* Persona Toggle */}
            {persona && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <User size={14} className="text-indigo-400 shrink-0" />
                <span className="text-xs flex-1">Use Business Persona</span>
                <button
                  onClick={() => {
                    const next = !usePersona;
                    setUsePersona(next);
                    if (next && personaObj) {
                      setInput((prev) => ({
                        ...prev,
                        product: personaObj.product_service || personaObj.business_name || '',
                        audience: personaObj.target_audience || '',
                        tone: personaObj.tone || personaObj.brand_voice || '',
                      }));
                    } else if (next && personaStr) {
                      setInput((prev) => ({ ...prev, product: personaStr.slice(0, 200) }));
                    }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${usePersona ? 'bg-indigo-500' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${usePersona ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            )}

            <InputField label="Product / Service" field="product" input={input} setInput={setInput} placeholder="e.g. AI-powered fitness app" />
            <InputField label="Target Audience" field="audience" input={input} setInput={setInput} placeholder="e.g. Busy professionals aged 25-40" />
            <InputField label="Tone" field="tone" input={input} setInput={setInput} placeholder="e.g. Casual, energetic, professional" />

            {(activeTool === 'ad_brief' || activeTool === 'long_copy' || activeTool === 'ctas') && (
              <InputField label="Goal" field="goal" input={input} setInput={setInput} placeholder="e.g. Drive app downloads" />
            )}

            {activeTool === 'rewrite' && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Original Text</label>
                <textarea
                  rows={4}
                  value={input.original_text || ''}
                  onChange={(e) => setInput({ ...input, original_text: e.target.value })}
                  placeholder="Paste the ad copy you want to rewrite..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-1 focus:ring-indigo-500"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            )}

            {(activeTool === 'short_copy' || activeTool === 'image_prompt') && (
              <InputField label="Platform" field="platform" input={input} setInput={setInput} placeholder="e.g. Instagram, Facebook, LinkedIn" />
            )}

            <InputField label="Additional Instructions (optional)" field="instruction" input={input} setInput={setInput} placeholder="e.g. Use emojis, mention free trial" />

            <button
              onClick={handleGenerate}
              disabled={generate.isPending || (!input.product && activeTool !== 'rewrite') || (activeTool === 'rewrite' && !input.original_text)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {generate.isPending ? '⏳ Generating...' : `✨ Generate · ${tool.cost} tokens`}
            </button>

            {generate.isError && (
              <p className="text-xs text-red-400">
                {(generate.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed. Tokens refunded.'}
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold">Results</h3>
              <ResultDisplay result={result} tool={activeTool} copyText={copyText} copied={copied} />
            </div>
          ) : (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Wand2 size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Fill in the details and hit Generate to create ad content.
              </p>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function InputField({ label, field, input, setInput, placeholder }: {
  label: string; field: string; input: Record<string, string>;
  setInput: (v: Record<string, string>) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="text"
        value={input[field] || ''}
        onChange={(e) => setInput({ ...input, [field]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />
    </div>
  );
}

function ResultDisplay({ result, tool, copyText, copied }: {
  result: unknown; tool: string; copyText: (t: string, k: string) => void; copied: string;
}) {
  if (!result || typeof result !== 'object') {
    return <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>;
  }

  const data = result as Record<string, unknown>;

  // List results (hooks, ctas, copies, rewrites, prompts)
  const listKey = Object.keys(data).find((k) => Array.isArray(data[k]));
  if (listKey) {
    const items = (data[listKey] as unknown[]).map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // Extract text field if it exists
        return (obj.text || obj.copy || obj.hook || obj.cta || obj.prompt || Object.values(obj).find(v => typeof v === 'string' && (v as string).length > 10) || JSON.stringify(obj)) as string;
      }
      return String(item);
    });
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 p-3 rounded-lg group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-mono text-indigo-400 mt-0.5 shrink-0">{i + 1}.</span>
            <p className="text-sm flex-1 leading-relaxed whitespace-pre-wrap">{item}</p>
            <button
              onClick={() => copyText(item, `${i}`)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 cursor-pointer shrink-0"
              aria-label="Copy"
            >
              {copied === `${i}` ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-gray-400" />}
            </button>
          </div>
        ))}
      </div>
    );
  }

  // Text results (long_copy, video_script)
  const textKey = Object.keys(data).find((k) => typeof data[k] === 'string');
  if (textKey) {
    const text = data[textKey] as string;
    return (
      <div className="relative group">
        <div className="p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {text}
        </div>
        <button
          onClick={() => copyText(text, 'text')}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          aria-label="Copy"
        >
          {copied === 'text' ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
        </button>
      </div>
    );
  }

  // Object results (ad_brief)
  if (data.brief && typeof data.brief === 'object') {
    const brief = data.brief as Record<string, unknown>;
    return (
      <div className="space-y-3">
        {Object.entries(brief).map(([key, value]) => (
          <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs uppercase tracking-wide mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>
              {key.replace(/_/g, ' ')}
            </p>
            {Array.isArray(value) ? (
              <ul className="space-y-1">
                {(value as unknown[]).map((v, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-indigo-400">•</span> {typeof v === 'string' ? v : JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <pre className="text-xs overflow-auto p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>{JSON.stringify(data, null, 2)}</pre>;
}

function HistoryView({ history, copyText, copied, onLoad }: {
  history: Array<{ tool: string; result: unknown; date: string; input: Record<string, string> }>;
  copyText: (t: string, k: string) => void;
  copied: string;
  onLoad: (entry: { tool: string; result: unknown; input: Record<string, string> }) => void;
}) {
  if (!history.length) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Wand2 size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No generations yet. Create something first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, idx) => {
        const toolInfo = TOOLS.find((t) => t.id === entry.tool);
        const Icon = toolInfo?.icon || Wand2;
        return (
          <div key={idx} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-indigo-400" />
                <span className="text-sm font-medium">{toolInfo?.label || entry.tool}</span>
                {entry.input.product && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5" style={{ color: 'var(--text-muted)' }}>
                    {entry.input.product.slice(0, 30)}{entry.input.product.length > 30 ? '…' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => onLoad(entry)}
                  className="text-xs px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                >
                  Load
                </button>
              </div>
            </div>
            <ResultDisplay result={entry.result} tool={entry.tool} copyText={copyText} copied={copied} />
          </div>
        );
      })}
    </div>
  );
}
