'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import CampaignGenerator from '@/components/CampaignGenerator';
import {
  Zap, Users, Loader2, Check, ChevronLeft, RefreshCw, Wand2,
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
      setActiveStep(2);
    },
  });

  if (!projectId) { router.push('/dashboard/projects'); return null; }
  if (isLoading || !project) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>;
  }

  const intelligence = project.intelligence || {};
  const assets = project.assets || [];
  const hasAudience = !!intelligence.audience;

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
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-bold text-white mb-4">Tell us about your business</h3>
              <div className="space-y-3 text-base">
                <div><span className="text-gray-500 text-sm">Business</span><p className="text-white font-medium">{project.business_name}</p></div>
                <div><span className="text-gray-500 text-sm">Niche</span><p className="text-white font-medium">{project.business_niche}</p></div>
                <div><span className="text-gray-500 text-sm">Product</span><p className="text-white font-medium">{project.product_name}</p></div>
                {project.usp && <div><span className="text-gray-500 text-sm">USP</span><p className="text-gray-300 text-sm">{project.usp}</p></div>}
                {project.target_location && <div><span className="text-gray-500 text-sm">Location</span><p className="text-white font-medium">{project.target_location}</p></div>}
              </div>
              <button
                onClick={() => generateMutation.mutate({ tool: 'audience', input: input.description ? { description: input.description } : undefined })}
                disabled={generateMutation.isPending}
                className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-semibold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all">
                {generateMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Wand2 size={14} /> Generate Personas ✨</>}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {generatedOptions && generatedOptions.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Select Your Audience</h3>
                <div className="grid grid-cols-3 gap-4">
                  {generatedOptions.map((persona, i) => {
                    const isSelected = selectedAudience === persona;
                    return (
                      <div key={i} onClick={() => setSelectedAudience(persona)}
                        className={`rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/5' : ''}`}
                        style={{ border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center mb-3 mx-auto">
                          <UserCircle size={24} className="text-indigo-300" />
                        </div>
                        <p className="text-base font-bold text-white text-center">{persona.label}</p>
                        <p className="text-sm text-gray-400 text-center mt-0.5">{persona.demographics?.split(',')[0]}</p>
                        <div className="mt-3 space-y-1.5 text-sm">
                          {persona.situation && <p className="text-gray-300 text-xs">{persona.situation.slice(0, 80)}</p>}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedAudience(persona); saveMutation.mutate({ tool: 'audience', value: persona }); }}
                          disabled={saveMutation.isPending}
                          className={`w-full mt-4 py-2 rounded-xl text-sm font-semibold ${isSelected ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
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
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setActiveStep(2)} className="flex-1 py-2.5 rounded-xl text-base font-semibold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    Generate Ads →
                  </button>
                  <button onClick={() => generateMutation.mutate({ tool: 'audience' })} className="px-4 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 border border-white/10">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Users size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-lg font-medium text-gray-400">Generate your audience personas</p>
                <p className="text-base text-gray-500 mt-1">Click &quot;Generate Personas&quot; to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Generate Ads */}
      {activeStep === 2 && (
        <CampaignGenerator
          projectId={projectId!}
          assets={assets}
          activePlatform={activePlatform}
          setActivePlatform={setActivePlatform}
          generatedAsset={generatedAsset}
          setGeneratedAsset={setGeneratedAsset}
        />
      )}
    </div>
  );
}
