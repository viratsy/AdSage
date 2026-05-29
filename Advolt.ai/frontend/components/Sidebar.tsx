'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, Wand2, Library, Search,
  Palette, MessageSquare, Settings, LogOut, Zap, Chrome, User
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/library', label: 'Ad Library', icon: Library },
  { href: '/dashboard/create', label: 'Creative Studio', icon: Wand2 },
];

const toolsNav = [
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
    <aside
      className="w-60 flex flex-col py-5 px-3 shrink-0 h-screen"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Zap size={16} className="text-indigo-400" />
        </div>
        <span className="font-bold text-base text-white">Advolt AI</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium ml-auto">Pro</span>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        {mainNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive(href)
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        {/* Divider */}
        <div className="pt-4 pb-2">
          <div className="h-px" style={{ background: 'var(--border)' }} />
        </div>

        {toolsNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive(href)
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Chrome Extension CTA */}
      <div className="mx-1 mb-4 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Chrome size={14} className="text-indigo-400" />
          <span className="text-xs font-medium text-white">Chrome Extension</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">Capture ads in one click from Meta Ad Library</p>
        <button className="mt-2 text-[10px] font-medium text-indigo-300 hover:text-indigo-200 transition-colors">
          Add to Chrome →
        </button>
      </div>

      {/* User + Logout */}
      <div className="px-1">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut size={14} />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </aside>
  );
}
