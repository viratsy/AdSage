'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, Wand2, Library,
  Settings, LogOut, Zap, Globe
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/library', label: 'Ad Library', icon: Library },
  { href: '/dashboard/create', label: 'Creative Studio', icon: Wand2 },
];

const bottomNav = [
  { href: '/dashboard/profile', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 flex flex-col py-5 px-3 shrink-0 h-screen" style={{ background: '#0f1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-bold text-base text-white tracking-tight">Advolt AI</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold ml-auto">Pro</span>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        {mainNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
              isActive(href)
                ? 'bg-indigo-500/15 text-white shadow-sm'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            )}
            style={isActive(href) ? { border: '1px solid rgba(99,102,241,0.2)' } : { border: '1px solid transparent' }}
          >
            <Icon size={16} className={isActive(href) ? 'text-indigo-400' : ''} />
            {label}
          </Link>
        ))}

        <div className="pt-5 pb-2">
          <div className="h-px bg-white/5" />
        </div>

        {bottomNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
              isActive(href)
                ? 'bg-indigo-500/15 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            )}
            style={{ border: '1px solid transparent' }}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Chrome Extension CTA */}
      <div className="mx-1 mb-3 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Globe size={13} className="text-indigo-400" />
          <span className="text-xs font-semibold text-white">Chrome Extension</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">Capture ads in one click from Meta Ad Library</p>
        <span className="text-[10px] font-semibold text-indigo-300 cursor-pointer hover:text-indigo-200">Add to Chrome →</span>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors mx-1"
      >
        <LogOut size={14} />
        Logout
      </button>
    </aside>
  );
}
