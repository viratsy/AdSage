'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Library, User, LogOut, Zap, Wand2, FolderKanban } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/library', label: 'Ad Library', icon: Library },
  { href: '/dashboard/create', label: 'Create Studio', icon: Wand2 },
  { href: '/dashboard/projects', label: 'Creator Studio', icon: FolderKanban },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside
      className="w-56 flex flex-col py-6 px-4 shrink-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 mb-8">
        <Zap size={20} className="text-indigo-400" />
        <span className="font-bold text-base text-indigo-400">Advolt.ai</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
      >
        <LogOut size={16} />
        Logout
      </button>
    </aside>
  );
}
