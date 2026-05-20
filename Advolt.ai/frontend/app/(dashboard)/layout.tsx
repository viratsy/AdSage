'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import LimitBanner from '@/components/LimitBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => billingApi.status().then((r) => r.data),
    enabled: isLoggedIn,
  });

  useEffect(() => {
    if (!isLoggedIn) { router.replace('/login'); return; }
    // Redirect to onboarding if no business profile (skip if already on onboarding)
    if (billing && !billing.business_profile && !pathname.includes('/onboarding')) {
      router.replace('/dashboard/onboarding');
    }
  }, [isLoggedIn, billing, pathname, router]);

  if (!isLoggedIn) return null;

  // Don't show sidebar on onboarding
  if (pathname.includes('/onboarding')) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <LimitBanner />
        {children}
      </main>
    </div>
  );
}
