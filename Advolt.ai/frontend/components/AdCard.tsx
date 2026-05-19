'use client';

import Link from 'next/link';
import { Heart, Zap } from 'lucide-react';
import { truncate, formatDate } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adsApi } from '@/lib/api';

interface Ad {
  ad_id: string;
  advertiser_name: string;
  primary_text?: string;
  headline?: string;
  image_urls?: string[];
  favorite?: boolean;
  ai_analysis_status?: string;
  created_at: string;
  tags?: string[];
}

export default function AdCard({ ad }: { ad: Ad }) {
  const qc = useQueryClient();

  const toggleFav = useMutation({
    mutationFn: () => adsApi.update(ad.ad_id, { favorite: !ad.favorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  });

  const statusColor: Record<string, string> = {
    completed: 'text-green-400',
    processing: 'text-yellow-400',
    pending: 'text-gray-500',
    failed: 'text-red-400',
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col group transition-all hover:ring-1 hover:ring-indigo-500/50"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-900 overflow-hidden">
        {ad.image_urls?.[0] ? (
          <img
            src={ad.image_urls[0]}
            alt={ad.advertiser_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
            No image
          </div>
        )}
        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); toggleFav.mutate(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Toggle favorite"
        >
          <Heart
            size={14}
            className={ad.favorite ? 'text-red-400 fill-red-400' : 'text-gray-400'}
          />
        </button>
      </div>

      {/* Content */}
      <Link href={`/dashboard/ads/${ad.ad_id}`} className="flex-1 p-4 block">
        <p className="text-xs font-semibold text-indigo-400 mb-1">{ad.advertiser_name}</p>
        <p className="text-sm leading-snug mb-3" style={{ color: 'var(--text)' }}>
          {truncate(ad.primary_text || ad.headline || '—', 80)}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(ad.created_at)}
          </span>
          <span className={`flex items-center gap-1 text-xs ${statusColor[ad.ai_analysis_status || 'pending']}`}>
            <Zap size={10} />
            {ad.ai_analysis_status || 'pending'}
          </span>
        </div>

        {/* Tags */}
        {ad.tags?.length ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {ad.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </Link>
    </div>
  );
}
