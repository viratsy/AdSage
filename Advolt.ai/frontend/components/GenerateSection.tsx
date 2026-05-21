'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';
import { Copy, RefreshCw, Plus, Loader2 } from 'lucide-react';

interface Props {
  adId: string;
  operation: string;
  title: string;
  tokenCost: number;
  initialData?: string[] | string | null;
  type: 'list' | 'text';
  canGenerateMore?: boolean;
}

export default function GenerateSection({ adId, operation, title, tokenCost, initialData, type, canGenerateMore }: Props) {
  const [items, setItems] = useState<string[]>(
    Array.isArray(initialData) ? initialData : initialData ? [initialData] : []
  );
  const [instruction, setInstruction] = useState('');
  const [copied, setCopied] = useState('');
  const [showInstruction, setShowInstruction] = useState(false);

  const generate = useMutation({
    mutationFn: (mode: 'regenerate' | 'more') => {
      const count = mode === 'more' ? 5 : undefined;
      return aiApi.generate(adId, operation, instruction || undefined, count).then((r) => r.data);
    },
    onSuccess: (data, mode) => {
      const result = data.result;
      let newItems: string[] = [];
      if (result.hooks) newItems = result.hooks;
      else if (result.ctas) newItems = result.ctas;
      else if (result.short_copy) newItems = [result.short_copy];
      else if (result.long_copy) newItems = [result.long_copy];
      else if (result.image_prompt) newItems = [result.image_prompt];
      else if (result.video_script) newItems = [result.video_script];

      if (mode === 'more') {
        setItems([...items, ...newItems]);
      } else {
        setItems(newItems);
      }
      setInstruction('');
      setShowInstruction(false);
    },
  });

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const hasContent = items.length > 0;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>{title}</p>
        {hasContent && (
          <button onClick={() => setShowInstruction(!showInstruction)} className="text-xs text-indigo-400 hover:text-indigo-300">
            {showInstruction ? 'Cancel' : '🔄 Regenerate'}
          </button>
        )}
      </div>

      {/* Content */}
      {hasContent && type === 'list' && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-2 group">
              <p className="text-sm leading-snug">{item}</p>
              <button onClick={() => copyText(item, `${operation}-${i}`)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy">
                <Copy size={12} className={copied === `${operation}-${i}` ? 'text-green-400' : 'text-gray-500'} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasContent && type === 'text' && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="group">
              <div className="flex justify-end mb-1">
                <button onClick={() => copyText(item, `${operation}-${i}`)} className="text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: copied === `${operation}-${i}` ? 'rgba(34,197,94,0.2)' : 'var(--surface-2)', color: copied === `${operation}-${i}` ? '#22c55e' : 'var(--text-muted)' }}>
                  {copied === `${operation}-${i}` ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      )}

      {/* Instruction input for regeneration */}
      {showInstruction && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Add instructions... e.g. more urgency, shorter, mention discount"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <button
            onClick={() => generate.mutate('regenerate')}
            disabled={generate.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {generate.isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Regenerate · {tokenCost} tokens
          </button>
        </div>
      )}

      {/* Generate / Generate More buttons */}
      {!hasContent && !showInstruction && (
        <button
          onClick={() => generate.mutate('regenerate')}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50 w-full justify-center"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          {generate.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          Generate · {tokenCost} tokens
        </button>
      )}

      {hasContent && canGenerateMore && !showInstruction && (
        <button
          onClick={() => generate.mutate('more')}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          {generate.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          + 5 More · {tokenCost} tokens
        </button>
      )}

      {generate.isError && <p className="text-xs text-red-400">Failed. Tokens refunded.</p>}
    </div>
  );
}
