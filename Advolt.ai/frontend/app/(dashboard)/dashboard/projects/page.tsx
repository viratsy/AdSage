'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { FolderKanban, Plus, Trash2, Loader2, Sparkles, ChevronDown } from 'lucide-react';

interface Project {
  project_id: string;
  project_name: string;
  business_name: string;
  business_niche: string;
  product_name: string;
  product_description: string;
  key_features: string;
  key_benefits: string;
  usp: string;
  ai_analysis: {
    summary: string;
    target_keywords: string[];
    suggested_audiences: string[];
    tone_recommendations: string[];
    content_angles: string[];
    pain_points: string[];
    value_propositions: string[];
    competitive_edge: string;
  } | null;
  created_at: string;
}

const EMPTY_FORM = {
  project_name: '',
  business_name: '',
  business_niche: '',
  product_name: '',
  product_description: '',
  key_features: '',
  key_benefits: '',
  usp: '',
};

export default function CreatorStudioPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [prefillSource, setPrefillSource] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const projects: Project[] = data?.projects || [];

  const createMutation = useMutation({
    mutationFn: (formData: typeof EMPTY_FORM) => projectsApi.create(formData).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setPrefillSource('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProject(null);
    },
  });

  const handlePrefill = (projectId: string) => {
    setPrefillSource(projectId);
    if (!projectId) {
      setForm(EMPTY_FORM);
      return;
    }
    const source = projects.find((p) => p.project_id === projectId);
    if (source) {
      setForm({
        project_name: '',
        business_name: source.business_name,
        business_niche: source.business_niche,
        product_name: source.product_name,
        product_description: source.product_description,
        key_features: source.key_features,
        key_benefits: source.key_benefits,
        usp: source.usp,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  // Project detail view
  if (selectedProject) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedProject(null)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to projects
        </button>

        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">{selectedProject.project_name}</h1>
            <button
              onClick={() => deleteMutation.mutate(selectedProject.project_id)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Business:</span>
              <p className="font-medium">{selectedProject.business_name}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Niche:</span>
              <p className="font-medium">{selectedProject.business_niche}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Product/Service:</span>
              <p className="font-medium">{selectedProject.product_name}</p>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Created:</span>
              <p className="font-medium">{new Date(selectedProject.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {selectedProject.product_description && (
            <div className="mt-4 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Description:</span>
              <p className="mt-1">{selectedProject.product_description}</p>
            </div>
          )}
          {selectedProject.key_features && (
            <div className="mt-3 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Key Features:</span>
              <p className="mt-1">{selectedProject.key_features}</p>
            </div>
          )}
          {selectedProject.key_benefits && (
            <div className="mt-3 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Key Benefits:</span>
              <p className="mt-1">{selectedProject.key_benefits}</p>
            </div>
          )}
          {selectedProject.usp && (
            <div className="mt-3 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>USP / Differentiators:</span>
              <p className="mt-1">{selectedProject.usp}</p>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {selectedProject.ai_analysis && (
          <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-indigo-400" /> AI Analysis
            </h2>

            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {selectedProject.ai_analysis.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {selectedProject.ai_analysis.target_keywords?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Target Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProject.ai_analysis.target_keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProject.ai_analysis.suggested_audiences?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Suggested Audiences</p>
                  <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedProject.ai_analysis.suggested_audiences.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProject.ai_analysis.tone_recommendations?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Tone Recommendations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProject.ai_analysis.tone_recommendations.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProject.ai_analysis.content_angles?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Content Angles</p>
                  <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedProject.ai_analysis.content_angles.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProject.ai_analysis.pain_points?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Pain Points Addressed</p>
                  <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedProject.ai_analysis.pain_points.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProject.ai_analysis.value_propositions?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Value Propositions</p>
                  <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedProject.ai_analysis.value_propositions.map((v, i) => (
                      <li key={i}>• {v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedProject.ai_analysis.competitive_edge && (
              <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-sm font-medium text-indigo-300">Competitive Edge</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {selectedProject.ai_analysis.competitive_edge}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FolderKanban size={20} className="text-indigo-400" /> Creator Studio
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage your projects — each project stores your business & product details for AI-powered ad generation.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6 shadow-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-4">Create New Project</h2>

            {/* Prefill dropdown */}
            {projects.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Prefill from existing project
                </label>
                <div className="relative">
                  <select
                    value={prefillSource}
                    onChange={(e) => handlePrefill(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm appearance-none pr-8"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Start fresh</option>
                    {projects.map((p) => (
                      <option key={p.project_id} value={p.project_id}>
                        {p.project_name} — {p.business_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Project Name *" value={form.project_name} onChange={(v) => setForm({ ...form, project_name: v })} placeholder="e.g. Summer Campaign 2026" />
              <Field label="Business Name *" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} placeholder="e.g. Acme Corp" />
              <Field label="Business Niche *" value={form.business_niche} onChange={(v) => setForm({ ...form, business_niche: v })} placeholder="e.g. E-commerce, SaaS, Edtech" />
              <Field label="Product/Service Name *" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} placeholder="e.g. SmartLearn Pro" />
              <Field label="Brief Description" value={form.product_description} onChange={(v) => setForm({ ...form, product_description: v })} placeholder="1-2 sentences about what it is" multiline />
              <Field label="Key Features" value={form.key_features} onChange={(v) => setForm({ ...form, key_features: v })} placeholder="What it does — list main features" multiline />
              <Field label="Key Benefits" value={form.key_benefits} onChange={(v) => setForm({ ...form, key_benefits: v })} placeholder="Why it matters to the customer" multiline />
              <Field label="USP / Differentiators" value={form.usp} onChange={(v) => setForm({ ...form, usp: v })} placeholder="What makes it better or different from competitors" multiline />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setPrefillSource(''); }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !form.project_name || !form.business_name || !form.business_niche || !form.product_name}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles size={14} /> Create & Analyze</>
                  )}
                </button>
              </div>

              {createMutation.isError && (
                <p className="text-xs text-red-400 mt-2">
                  {(createMutation.error as Error)?.message || 'Failed to create project'}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <FolderKanban size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.project_id}
              onClick={() => setSelectedProject(project)}
              className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-semibold text-sm mb-2 truncate">{project.project_name}</h3>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{project.business_name}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
                  {project.business_niche}
                </span>
                {project.ai_analysis && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                    <Sparkles size={10} /> Analyzed
                  </span>
                )}
              </div>
              <p className="text-xs mt-3 truncate" style={{ color: 'var(--text-muted)' }}>
                {project.product_name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls = "w-full px-3 py-2 rounded-lg text-sm";
  const style = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' };

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={cls + ' resize-none'}
          style={style}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
          style={style}
        />
      )}
    </div>
  );
}
