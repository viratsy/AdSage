'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adsApi } from '@/lib/api';
import AdCard from '@/components/AdCard';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Ad } from '@/lib/types';

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [filterFav, setFilterFav] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ads', 'library'],
    queryFn: () => adsApi.list({ limit: 50 }).then((r) => r.data),
  });

  const ads = data?.ads ?? [];
  const filtered: Ad[] = ads.filter((a: Ad) => {
    const matchesSearch = !search || 
      a.advertiser_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.headline?.toLowerCase().includes(search.toLowerCase()) ||
      a.primary_text?.toLowerCase().includes(search.toLowerCase());
    const matchesFav = !filterFav || a.favorite;
    return matchesSearch && matchesFav;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ad Library</h1>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} ads
        </span>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div
          className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by advertiser, headline…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        <button
          onClick={() => setFilterFav(!filterFav)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            filterFav ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:bg-white/5'
          }`}
          style={{ border: '1px solid var(--border)' }}
        >
          <SlidersHorizontal size={14} />
          Favorites
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl h-56 animate-pulse"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((ad: Ad) => (
            <AdCard key={ad.ad_id} ad={ad} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-16 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filterFav ? 'No favorites yet.' : 'No ads found.'}
          </p>
        </div>
      )}
    </div>
  );
}
