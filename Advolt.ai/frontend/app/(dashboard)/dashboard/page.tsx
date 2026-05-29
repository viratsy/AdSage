'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi, adsApi, projectsApi } from '@/lib/api';
import { Zap, BookImage, FolderKanban, TrendingUp, Plus, Wand2, Globe, Search } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const projects = projectsData?.projects || [];

  const stats = [
    { label: 'Projects Created', value: projects.length, icon: FolderKanban, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Campaigns Generated', value: projects.reduce((sum: number, p: { assets?: unknown[] }) => sum + (p.assets?.length || 0), 0), icon: Wand2, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Ads Saved', value: billing?.ads_saved_count ?? 0, icon: BookImage, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'AI Tokens', value: billing ? `${((billing.monthly_tokens ?? 0) + (billing.purchased_tokens ?? 0)).toLocaleString()}` : '—', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Good morning! 👋</h1>
          <p className="text-sm mt-1 text-gray-400">Let&apos;s build high-converting campaigns today.</p>
        </div>
        <Link href="/dashboard/projects" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
          <Plus size={14} /> New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={16} className={color} />
              </div>
              <TrendingUp size={12} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Recent Projects */}
        <div className="col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Projects</h2>
            <Link href="/dashboard/projects" className="text-xs text-indigo-400 hover:text-indigo-300">See all →</Link>
          </div>
          <div className="space-y-2">
            {projects.length > 0 ? projects.slice(0, 4).map((project: { project_id: string; project_name: string; business_niche: string; intelligence?: { audience?: unknown }; assets?: unknown[] }) => (
              <Link key={project.project_id} href={`/dashboard/projects/studio?id=${project.project_id}`}
                className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:bg-white/5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <FolderKanban size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{project.project_name}</p>
                  <p className="text-xs text-gray-400">{project.business_niche}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                    project.assets && project.assets.length > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                  }`}>
                    {project.intelligence?.audience ? (project.assets?.length ? 'Active' : 'In Progress') : 'New'}
                  </span>
                </div>
              </Link>
            )) : (
              <div className="p-8 rounded-xl text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <FolderKanban size={24} className="mx-auto text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">No projects yet</p>
                <Link href="/dashboard/projects" className="text-xs text-indigo-400 mt-2 inline-block">Create your first project →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/dashboard/projects" className="flex items-center gap-3 p-4 rounded-xl transition-colors hover:bg-white/5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Plus size={14} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">New Project</p>
                <p className="text-[10px] text-gray-400">Start a new campaign</p>
              </div>
            </Link>
            <Link href="/dashboard/create" className="flex items-center gap-3 p-4 rounded-xl transition-colors hover:bg-white/5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Wand2 size={14} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Generate Campaign</p>
                <p className="text-[10px] text-gray-400">AI-powered campaign generation</p>
              </div>
            </Link>
            <Link href="/dashboard/library" className="flex items-center gap-3 p-4 rounded-xl transition-colors hover:bg-white/5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Search size={14} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Analyze Competitor Ad</p>
                <p className="text-[10px] text-gray-400">Extract winning insights</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Globe size={14} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Chrome Extension</p>
                <p className="text-[10px] text-gray-400">Capture ads from Meta Library</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
