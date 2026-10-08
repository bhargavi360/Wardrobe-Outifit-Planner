'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../providers';
import { apiRequest } from '../../lib/api';

type Preferences = {
  favorite_colors: string[];
  preferred_styles: string[];
  disliked_colors: string[];
  gender_fit_notes: string;
};

type ProfileCounts = {
  wardrobe: number;
  savedOutfits: number;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, wardrobe, savedOutfits] = await Promise.all([
          apiRequest<Preferences>('/preferences'),
          apiRequest<unknown[]>('/wardrobe'),
          apiRequest<unknown[]>('/outfits'),
        ]);
        if (cancelled) return;
        setPreferences(data);
        setCounts({ wardrobe: wardrobe.length, savedOutfits: savedOutfits.length });
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Your profile could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  return (
    <AppShell>
      <main className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Profile</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-rose-100 text-2xl font-semibold text-rose-800">
              {user?.email?.slice(0, 1).toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <h1 className="break-all text-2xl font-semibold tracking-tight">{user?.email ?? 'Your profile'}</h1>
              <p className="text-sm text-slate-500">Your wardrobe, your point of view.</p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                  role="status"
                  aria-label="Loading profile totals"
                />
              ))
            ) : !counts ? (
              <>
                <div className="rounded-2xl bg-rose-50/70 p-4">
                  <p className="text-sm text-slate-600">Wardrobe pieces</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">—</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Saved outfits</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">—</p>
                </div>
              </>
            ) : (
              <>
                <Link href="/wardrobe" className="rounded-2xl bg-rose-50/70 p-4 transition hover:bg-rose-100">
                  <p className="text-sm text-slate-600">Wardrobe pieces</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{counts.wardrobe}</p>
                </Link>
                <Link href="/saved-outfits" className="rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100">
                  <p className="text-sm text-slate-600">Saved outfits</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{counts.savedOutfits}</p>
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-thread-gold">Style DNA</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Preference summary</h2>
            </div>
            <Link href="/preferences" className="shrink-0 text-sm font-medium text-thread-gold hover:text-thread-gold-soft">
              Edit preferences
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Loading style preferences">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : preferences ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-600">Favorite colors</p>
                <div className="flex flex-wrap gap-2">
                  {preferences.favorite_colors.length === 0 ? (
                    <span className="text-sm text-slate-400">No favorite colors saved yet.</span>
                  ) : (
                    preferences.favorite_colors.map((color) => (
                      <span key={color} className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800">
                        {color}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-600">Preferred styles</p>
                <div className="flex flex-wrap gap-2">
                  {preferences.preferred_styles.length === 0 ? (
                    <span className="text-sm text-slate-400">No style preferences saved yet.</span>
                  ) : (
                    preferences.preferred_styles.map((style) => (
                      <span key={style} className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800">
                        {style}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-600">Disliked colors</p>
                <div className="flex flex-wrap gap-2">
                  {preferences.disliked_colors.length === 0 ? (
                    <span className="text-sm text-slate-400">No disliked colors saved.</span>
                  ) : (
                    preferences.disliked_colors.map((color) => (
                      <span key={color} className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
                        {color}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-600">Fit notes</p>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {preferences.gender_fit_notes || 'No fit notes added yet.'}
                </div>
              </div>
            </div>
          ) : !error ? (
            <p className="text-sm text-slate-500">Add your preferences to make outfit ideas feel more personal.</p>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
