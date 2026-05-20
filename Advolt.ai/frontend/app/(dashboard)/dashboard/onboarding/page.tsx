'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';
const NICHE_OPTIONS = ['E-commerce', 'SaaS / Software', 'Coaching / Consulting', 'Education / EdTech', 'Healthcare / Medical', 'Real Estate', 'Finance', 'Food & Restaurant', 'Fitness / Wellness', 'Agency / Marketing', 'Local Business', 'Other'];
const CURRENCIES = ['\u20b9', '$', '\u20ac', '\u00a3', 'AED'];
type Phase = 'form' | 'generating' | 'review' | 'follow_up' | 'saving' | 'done';
export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('form');
  const [form, setForm] = useState({ business_name: '', niche: '', target_customer: '', product_service: '', pain_point: '', price_range: '', location: '' });
  const [currency, setCurrency] = useState('\u20b9');
  const [persona, setPersona] = useState<Record<string, unknown> | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState('');
  const [error, setError] = useState('');
  const update = (key: string, val: string) => setForm({ ...form, [key]: val });
  const handleSubmit = async () => {
    if (!form.business_name || !form.product_service) { setError('Please fill business name and product/service.'); return; }
    setError('');
    const answers = { ...form };
    if (answers.price_range) answers.price_range = `${currency}${answers.price_range}`;
    setPhase('generating');
    try { const { data } = await profileApi.generatePersona(answers); setPersona(data.persona); setPhase(data.needs_follow_up ? 'follow_up' : 'review'); }
    catch { setError('AI generation failed.'); setPhase('form'); }
  };
  const handleFollowUp = async () => {
    if (!followUpAnswers.trim()) { setError('Please answer.'); return; }
    setPhase('generating');
    try { const { data } = await profileApi.generatePersona({ ...form, follow_up_answers: followUpAnswers }); setPersona(data.persona); setPhase('review'); }
    catch { setPhase('review'); }
  };
  const handleSave = async () => {
    setPhase('saving');
    try { await profileApi.savePersona(form, persona!); qc.invalidateQueries({ queryKey: ['billing'] }); setPhase('done'); setTimeout(() => router.push('/dashboard'), 1500); }
    catch { setError('Save failed.'); setPhase('review'); }
  };
  const refined = persona?.refined_profile as Record<string, string> | undefined;
  const followUpQs = persona?.follow_up_questions as string[] | undefined;
  const suggestions = persona?.suggestions as string[] | undefined;
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2"><Zap size={20} className="text-indigo-400" /><span className="font-bold text-indigo-400 text-lg">Advolt.ai</span></div>
          <h1 className="text-xl font-bold">{phase === 'form' && 'Set up your business profile'}{phase === 'generating' && 'AI is analyzing...'}{phase === 'follow_up' && 'A few more details'}{phase === 'review' && 'Your Business Persona'}{phase === 'saving' && 'Saving...'}{phase === 'done' && 'All set!'}</h1>
        </div>
        {phase === 'form' && (<div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div><label className="text-xs font-medium block mb-2">Business Name *</label><input type="text" placeholder="e.g. Advolt.ai, SmileDent Clinic..." value={form.business_name} onChange={(e) => update('business_name', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          <div><label className="text-xs font-medium block mb-2">Business Niche</label><div className="flex flex-wrap gap-1.5 mb-2">{NICHE_OPTIONS.map((opt) => (<button key={opt} onClick={() => update('niche', opt)} type="button" className={`text-xs px-2.5 py-1 rounded-full ${form.niche === opt ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500' : ''}`} style={{ border: '1px solid var(--border)', color: form.niche === opt ? undefined : 'var(--text-muted)' }}>{opt}</button>))}</div><input type="text" placeholder="Or type your niche..." value={NICHE_OPTIONS.includes(form.niche) ? '' : form.niche} onChange={(e) => update('niche', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          <div><label className="text-xs font-medium block mb-2">Target Customer</label><input type="text" placeholder="e.g. Business owners aged 30-50, Students..." value={form.target_customer} onChange={(e) => update('target_customer', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          <div><label className="text-xs font-medium block mb-2">Main Product / Service *</label><input type="text" placeholder="e.g. Painless dental treatments, 1:1 coaching..." value={form.product_service} onChange={(e) => update('product_service', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          <div><label className="text-xs font-medium block mb-2">Customer Pain Point</label><input type="text" placeholder="e.g. Fear of dentists, Can not get clients..." value={form.pain_point} onChange={(e) => update('pain_point', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          <div><label className="text-xs font-medium block mb-2">Price Range</label><div className="flex gap-2"><select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select><input type="text" placeholder="e.g. 500-2000 per visit" value={form.price_range} onChange={(e) => update('price_range', e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div></div>
          <div><label className="text-xs font-medium block mb-2">Location / Market</label><input type="text" placeholder="e.g. Mumbai, Pan-India, Global..." value={form.location} onChange={(e) => update('location', e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" style={inputStyle} /></div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={handleSubmit} type="button" className="w-full py-3 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Generate Business Persona</button>
        </div>)}
        {phase === 'generating' && (<div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><Loader2 size={32} className="text-indigo-400 mx-auto animate-spin" /><p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>Creating your business persona...</p></div>)}
        {phase === 'follow_up' && followUpQs && (<div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI needs more context:</p><ul className="space-y-1">{followUpQs.map((q, i) => <li key={i} className="text-sm">{q}</li>)}</ul><textarea rows={4} placeholder="Answer here..." value={followUpAnswers} onChange={(e) => setFollowUpAnswers(e.target.value)} className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none" style={inputStyle} />{error && <p className="text-xs text-red-400">{error}</p>}<div className="flex gap-3"><button onClick={() => setPhase('review')} type="button" className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Skip</button><button onClick={handleFollowUp} type="button" className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Refine</button></div></div>)}
        {phase === 'review' && persona && (<div className="space-y-4"><div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Your Business Persona</p><p className="text-sm leading-relaxed">{String(persona.persona_summary || '')}</p><div className="flex items-center gap-2 mt-3"><div className="h-1.5 flex-1 rounded-full bg-gray-800"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Number(persona.confidence_score) || 0}%` }} /></div><span className="text-xs text-indigo-400">{String(persona.confidence_score || 0)}%</span></div></div>{refined && (<div className="rounded-xl p-5 grid grid-cols-2 gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>{Object.entries(refined).map(([key, value]) => (<div key={key}><p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</p><p className="text-xs font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value || '')}</p></div>))}</div>)}{suggestions && suggestions.length > 0 && (<div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Suggestions</p>{suggestions.map((s, i) => <p key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>{String(s)}</p>)}</div>)}{error && <p className="text-xs text-red-400">{error}</p>}<div className="flex gap-3"><button onClick={() => setPhase('form')} type="button" className="px-4 py-2.5 rounded-lg text-sm text-gray-400" style={{ border: '1px solid var(--border)' }}>Edit</button><button onClick={handleSave} type="button" className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'var(--accent)' }}><CheckCircle size={14} /> Confirm Persona</button></div></div>)}
        {phase === 'saving' && <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><Loader2 size={24} className="text-indigo-400 mx-auto animate-spin" /></div>}
        {phase === 'done' && <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}><CheckCircle size={32} className="text-green-400 mx-auto" /><p className="text-sm font-semibold mt-2">Persona saved!</p></div>}
        {phase === 'form' && <button onClick={() => router.push('/dashboard')} type="button" className="w-full text-center text-xs mt-4 hover:text-white" style={{ color: 'var(--text-muted)' }}>Skip for now</button>}
      </div>
    </div>
  );
}
