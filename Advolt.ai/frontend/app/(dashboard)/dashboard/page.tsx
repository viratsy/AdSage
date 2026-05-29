'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi, projectsApi } from '@/lib/api';
import { Zap, FolderKanban, TrendingUp, Plus, Wand2, Globe, Search, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const projects = (projectsData?.projects || []) as Array<{
    project_id: string; project_name: string; business_niche: string;
    intelligence?: { audience?: unknown }; assets?: unknown[];
  }>;

  const totalCampaigns = projects.reduce((sum, p) => sum + (p.assets?.length || 0), 0);

  const stats = [
    { label: 'Projects Created', value: projects.length, icon: FolderKanban, gradient: 'from-indigo-500/20 to-indigo-600/5', iconBg: 'bg-indigo-500/20', iconColor: 'text-indigo-400' },
    { label: 'Campaigns Generated', value: totalCampaigns, icon: Rocket, gradient: 'from-purple-500/20 to-purple-600/5', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400' },
    { label: 'Ads Saved', value: billing?.ads_saved_count ?? 0, icon: Search, gradient: 'from-emerald-500/20 to-emerald-600/5', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
    { label: 'AI Tokens', value: billing ? `${((billing.monthly_tokens ?? 0) + (billing.purchased_tokens ?? 0)).toLocaleString()}` : '—', icon: Zap, gradient: 'from-amber-500/20 to-amber-600/5', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400' },
  ];

  const quickActions = [
    { href: '/dashboard/projects', label: 'New Project', desc: 'Start a new campaign', icon: Plus, bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', iconColor: 'text-indigo-400' },
    { href: '/dashboard/create', label: 'Generate Campaign', desc: 'AI-powered campaign generation', icon: Wand2, bg: 'bg-purple-500/10', border: 'border-purple-500/20', iconColor: 'text-purple-400' },
    { href: '/dashboard/library', label: 'Analyze Competitor Ad', desc: 'Extract winning insights', icon: Search, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
    { href: '#', label: 'Chrome Extension', desc: 'Capture ads from Meta Library', icon: Globe, bg: 'bg-orange-500/10', border: 'border-orange-500/20', iconColor: 'text-orange-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-7 py-2 2xl:max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Good morning! 👋</h1>
          <p className="text-sm mt-1 text-gray-400">Let&apos;s build high-converting campaigns today.</p>
        </div>
        <Link href="/dashboard/projects" className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-lg shadow-indigo-500/20">
          <Plus size={15} /> New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 2xl:gap-5">
        {stats.map(({ label, value, icon: Icon, gradient, iconBg, iconColor }) => (
          <div key={label} className={`rounded-2xl p-5 2xl:p-6 bg-gradient-to-br ${gradient}`} style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 2xl:w-12 2xl:h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon size={18} className={iconColor} />
              </div>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-3xl 2xl:text-4xl font-bold text-white">{value}</p>
            <p className="text-xs 2xl:text-sm text-gray-400 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-5 gap-6 2xl:gap-8">
        {/* Recent Projects */}
        <div className="col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Recent Projects</h2>
            <Link href="/dashboard/projects" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">See all →</Link>
          </div>
          <div className="space-y-2.5">
            {projects.length > 0 ? projects.slice(0, 4).map((project) => {
              const step = !project.intelligence?.audience ? 1 : !(project.assets?.length) ? 3 : 4;
              const status = step === 4 ? 'Active' : 'In Progress';
              return (
                <Link key={project.project_id} href={`/dashboard/projects/studio?id=${project.project_id}`}
                  className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:bg-white/[0.03] group"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <FolderKanban size={16} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">{project.project_name}</p>
                    <p className="text-xs text-gray-500">{project.business_niche}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">Step {step} of 4</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      status === 'Active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                    }`}>
                      {status}
                    </span>
                  </div>
                </Link>
              );
            }) : (
              <div className="p-10 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <FolderKanban size={28} className="mx-auto text-gray-600 mb-3" />
                <p className="text-sm text-gray-400">No projects yet</p>
                <Link href="/dashboard/projects" className="text-xs text-indigo-400 mt-2 inline-block font-medium">Create your first project →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-white">Quick Actions</h2>
          <div className="space-y-2.5">
            {quickActions.map(({ href, label, desc, icon: Icon, bg, border, iconColor }) => (
              <Link key={label} href={href}
                className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all hover:scale-[1.01] ${bg} border ${border}`}>
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon size={15} className={iconColor} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-[10px] text-gray-400">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
