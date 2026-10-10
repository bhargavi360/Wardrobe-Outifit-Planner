'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, apiImageUrl, fetchWardrobe } from '../../lib/api';
import { AppShell } from '../../components/AppShell';
import { ImageLightbox, ZoomableImageCard } from '../../components/ImageZoom';
import { useToast } from '../../components/ToastProvider';
import { OutfitPreview } from '../../components/OutfitPreview';
import { WeatherPicker } from '../../components/WeatherPicker';
import { useAuth } from '../providers';

type WardrobeItem = {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear' | 'accessory';
  dominant_colors: string[];
  image_url: string;
  sub_type: string | null;
  availability?: 'available' | 'laundry';
};

type Recommendation = {
  rank: number;
  score: number;
  items: Array<{
    id: string;
    name: string;
    category: string;
    dominant_colors: string[];
    sub_type: string | null;
  }>;
  reasons: Array<{ label: string; score: number }>;
};

type StylingTips = {
  styling_tip: string;
  accessory_suggestions: string[];
  why_it_works: string;
  source: 'gemini' | 'fallback';
};

type SavedOutfit = {
  id: string;
  name: string;
  occasion: string;
  items: Array<{
    item_id: string;
    category: string;
    name: string;
    dominant_colors: string[];
    sub_type: string | null;
  }>;
  notes: string;
  is_favorite: boolean;
};

const occasions = ['casual', 'formal', 'party', 'gym', 'ethnic'] as const;
const weatherOptions = ['sunny', 'cloudy', 'rainy', 'windy', 'cold'] as const;
const builderCategories = ['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory'] as const;

function recommendationKey(recommendation: Recommendation): string {
  return `${recommendation.rank}-${recommendation.items.map((item) => item.id).sort().join('-')}`;
}

export default function OutfitPlannerPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [occasion, setOccasion] = useState<(typeof occasions)[number]>('casual');
  const [temperatureInput, setTemperatureInput] = useState('22');
  const temperature = Number(temperatureInput);
  const validTemperature = temperatureInput.trim() !== '' && Number.isFinite(temperature) && temperature >= -30 && temperature <= 60;
  const temperatureError = validTemperature ? '' : 'Enter a temperature between −30°C and 60°C.';
  const [condition, setCondition] = useState<(typeof weatherOptions)[number]>('sunny');
  const [requiredItemId, setRequiredItemId] = useState('');
  const requiredItem = wardrobe.find(item => item.id === requiredItemId);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [stylingTips, setStylingTips] = useState<Record<string, StylingTips>>({});
  const [stylingErrors, setStylingErrors] = useState<Record<string, string>>({});
  const [stylingLoadingKey, setStylingLoadingKey] = useState<string | null>(null);
  const [builderItems, setBuilderItems] = useState<Record<string, string>>({});
  const [builderName, setBuilderName] = useState('');
  const [builderOccasion, setBuilderOccasion] = useState<(typeof occasions)[number]>('casual');
  const [builderOpen, setBuilderOpen] = useState(false);
  const builderRef = useRef<HTMLElement>(null);
  const requestVersion = useRef(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadWardrobe = async () => {
      try {
        const items = await fetchWardrobe<WardrobeItem>();
        setWardrobe(items.map((item) => ({ ...item, image_url: apiImageUrl(item.image_url) })));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load your closet.');
      } finally {
        setLoading(false);
      }
    };

    void loadWardrobe();
  }, []);

  const promptSummary = useMemo(
    () => `${occasion} · ${validTemperature ? temperature : '—'}°C · ${condition}`,
    [condition, occasion, temperature, validTemperature],
  );

  useEffect(() => {
    requestVersion.current += 1;
    setRecommendations([]);
    setStylingTips({});
    setStylingErrors({});
    setStylingLoadingKey(null);
    setActiveImageIndex(null);
    if (loading || wardrobe.length === 0 || !validTemperature) {
      setIsGenerating(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setError('');
    setIsGenerating(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest<{ recommendations: Recommendation[] }>('/outfits/recommend', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            occasion,
            weather: { temperature_c: temperature, condition },
            required_item_id: requiredItemId || undefined,
          }),
        });
        if (active) setRecommendations(response.recommendations);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to generate outfit recommendations.');
      } finally {
        if (active) setIsGenerating(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [condition, loading, occasion, temperature, validTemperature, wardrobe, requiredItemId]);

  const requestStylingTips = async (recommendation: Recommendation) => {
    const version = requestVersion.current;
    const key = recommendationKey(recommendation);
    setStylingLoadingKey(key);
    setStylingErrors((current) => ({ ...current, [key]: '' }));
    try {
      const result = await apiRequest<StylingTips>('/outfits/styling-tips', {
        method: 'POST',
        body: JSON.stringify({
          occasion,
          weather: {
            temperature_c: temperature,
            condition,
          },
          items: recommendation.items,
        }),
      });
      if (version === requestVersion.current) setStylingTips((current) => ({ ...current, [key]: result }));
    } catch (caught) {
      if (version === requestVersion.current) setStylingErrors((current) => ({
        ...current,
        [key]: caught instanceof Error ? caught.message : 'Unable to load styling suggestions.',
      }));
    } finally {
      if (version === requestVersion.current) setStylingLoadingKey(null);
    }
  };

  const openBuilder = (recommendation: Recommendation) => {
    const selected: Record<string, string> = {};
    recommendation.items.forEach((item) => {
      selected[item.category] = item.id;
    });
    setBuilderItems(selected);
    setBuilderName(`${occasion[0].toUpperCase()}${occasion.slice(1)} look`);
    setBuilderOccasion(occasion);
    setBuilderOpen(true);
    setSaveMessage('');
  };

  const selectedBuilderItems = builderCategories
    .map(category => wardrobe.find(item => item.id === builderItems[category]))
    .filter((item): item is WardrobeItem => item !== undefined);

  useEffect(() => {
    if (builderOpen) builderRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, [builderOpen]);

  const saveCustomizedOutfit = async () => {
    if (!builderName.trim()) {
      setError('Give your outfit a name before saving it.');
      return;
    }
    if (selectedBuilderItems.length === 0) {
      setError('Choose at least one wardrobe piece for your outfit.');
      return;
    }
    setIsSavingOutfit(true);
    setError('');
    try {
      await apiRequest<SavedOutfit>('/outfits', {
        method: 'POST',
        body: JSON.stringify({
          name: builderName.trim(),
          occasion: builderOccasion,
          items: selectedBuilderItems.map((item) => ({
            item_id: item.id,
            category: item.category,
            name: item.name,
            dominant_colors: item.dominant_colors,
            sub_type: item.sub_type,
          })),
        }),
      });
      setSaveMessage('Your look is saved. Find it in Saved Outfits.');
      showToast('Your look is saved.');
      setBuilderOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this outfit.');
    } finally {
      setIsSavingOutfit(false);
    }
  };

  const lightboxItems = useMemo(
    () =>
      recommendations.flatMap((recommendation, recommendationIndex) =>
        recommendation.items.map((piece, pieceIndex) => ({
          src:
            wardrobe.find((item) => item.id === piece.id)?.image_url ??
            'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
          alt: piece.name,
          title: piece.name,
          subtitle: `${piece.category} · ${piece.sub_type ?? 'Style piece'}`,
          sharedId: `outfit-${recommendationIndex}-${pieceIndex}-${piece.id}`,
        })),
      ),
    [recommendations, wardrobe],
  );

  return (
    <AppShell>
      <main className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div id="daily-outfit-controls" className="planner-controls-anchor">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-thread-gold">Today’s composition</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your outfit, considered.</h1>
              </div>
              <div className="rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">{promptSummary}</div>
            </div>

            <WeatherPicker initialCity={user?.city} onApply={weather => { setTemperatureInput(String(weather.temperature_c)); setCondition(weather.condition); }} />
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Occasion</span>
                <select
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value as (typeof occasions)[number])}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                >
                  {occasions.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span id="planner-temperature-label" className="mb-2 block text-sm font-medium text-slate-600">Temperature (°C)</span>
                <input
                  type="number"
                  min={-30}
                  max={60}
                  step="any"
                  value={temperatureInput}
                  aria-labelledby="planner-temperature-label"
                  aria-invalid={!validTemperature}
                  aria-describedby={temperatureError ? 'planner-temperature-error' : undefined}
                  onChange={(event) => setTemperatureInput(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                />
                {temperatureError && <span id="planner-temperature-error" role="alert" className="mt-2 block text-sm text-red-700">{temperatureError}</span>}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Condition</span>
                <select
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as (typeof weatherOptions)[number])}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                >
                  {weatherOptions.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="planner-anchor-control">
              <label>
                <span>Build around this piece</span>
                <select value={requiredItemId} disabled={loading || wardrobe.length === 0} onChange={event => setRequiredItemId(event.target.value)} aria-describedby="planner-anchor-help">
                  <option value="">Any piece — surprise me</option>
                  {builderCategories.map(category => {
                    const pieces = wardrobe.filter(item => item.category === category);
                    return pieces.length ? <optgroup key={category} label={category}>{pieces.map(piece => <option key={piece.id} value={piece.id} disabled={piece.availability === 'laundry'}>{piece.name}{piece.availability === 'laundry' ? ' · In laundry' : ''}</option>)}</optgroup> : null;
                  })}
                </select>
              </label>
              <p id="planner-anchor-help">Choose a piece you want to wear. Every suggestion will include it.</p>
              {requiredItem && <div className="planner-anchor-piece">
                <img src={requiredItem.image_url} alt={requiredItem.name} />
                <div><span>Your starting point</span><strong>{requiredItem.name}</strong></div>
                <button type="button" onClick={() => setRequiredItemId('')}>Clear piece</button>
              </div>}
            </div>
          </div>
        </section>

        <div id="daily-outfit-recommendations" className="planner-recommendations">
        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading || isGenerating ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="h-32 rounded-2xl bg-slate-200" />
                <div className="mt-4 h-5 w-20 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-full rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : !validTemperature ? (
          <p className="planner-guidance">Choose a valid temperature above to generate your looks.</p>
        ) : recommendations.length === 0 ? (
          <div className="planner-editorial-empty">
            <div className="planner-editorial-image">
              <Image
                src="https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=900&q=85"
                alt="A tailored black suit styled for a polished city look."
                fill
                sizes="(max-width: 767px) 100vw, 420px"
              />
            </div>
            <div className="planner-editorial-copy">
              <p className="planner-editorial-kicker">A LOOK TAKES SHAPE</p>
              <h2>No outfit ideas yet.</h2>
              <p>{requiredItem ? `Add a matching top and bottom, or a dress, to build a complete look around ${requiredItem.name}. You can also clear this piece to explore other looks.` : 'Start with a top and bottom, or a dress. Add shoes and layers for more combinations.'}</p>
              {requiredItem && <button type="button" className="planner-clear-anchor" onClick={() => setRequiredItemId('')}>Explore all pieces</button>}
              <Link href="/wardrobe">Visit your wardrobe <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((item, recommendationIndex) => {
              const key = recommendationKey(item);
              const tips = stylingTips[key];
              return (
              <article key={`${item.rank}-${item.score}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Rank #{item.rank}</p>
                    <h2 className="mt-1 text-xl font-semibold">{item.score.toFixed(1)} score</h2>
                  </div>
                  <div className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {item.items.length} pieces
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openBuilder(item)}
                  className="mb-3 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-50"
                >
                  Customize this look
                </button>

                <div className="grid gap-2 sm:grid-cols-2">
                  {item.items.map((piece, pieceIndex) => {
                    const media = wardrobe.find((wardrobeItem) => wardrobeItem.id === piece.id);
                    const image = media?.image_url ?? 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80';
                    const sharedId = `outfit-${recommendationIndex}-${pieceIndex}-${piece.id}`;
                    const lightboxIndex =
                      recommendations
                        .slice(0, recommendationIndex)
                        .reduce((sum, recommendation) => sum + recommendation.items.length, 0) + pieceIndex;
                    return (
                      <ZoomableImageCard
                        key={sharedId}
                        id={sharedId}
                        image={image}
                        title={piece.name}
                        subtitle={piece.sub_type ?? undefined}
                        tags={piece.dominant_colors.slice(0, 3)}
                        accent={piece.category}
                        imageSize="compact"
                        onOpen={() => setActiveImageIndex(lightboxIndex)}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2">
                  {item.reasons.map((reason) => (
                    <div key={`${item.rank}-${reason.label}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-600">{reason.label}</span>
                      <span className="font-semibold text-slate-900">
                        {reason.score > 0 ? '+' : ''}{reason.score.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {tips ? (
                    <div className="rounded-2xl bg-rose-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Styling notes</h3>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-rose-700">
                          {tips.source === 'gemini' ? 'Personalized' : 'Quick guide'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{tips.styling_tip}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Accessories
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {tips.accessory_suggestions.map((suggestion) => (
                          <li key={suggestion} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs leading-5 text-slate-600">{tips.why_it_works}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={stylingLoadingKey !== null}
                      onClick={() => void requestStylingTips(item)}
                      className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {stylingLoadingKey === key ? 'Styling your look…' : 'Get styling tips'}
                    </button>
                  )}
                  {stylingErrors[key] ? (
                    <p role="alert" className="mt-2 text-xs text-red-700">{stylingErrors[key]}</p>
                  ) : null}
                </div>
              </article>
              );
            })}
          </div>
        )}
        {saveMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {saveMessage} <Link href="/saved-outfits" className="font-semibold underline">View collection</Link>
          </p>
        ) : null}
        {builderOpen ? (
          <section ref={builderRef} className="planner-builder rounded-3xl border border-rose-200 bg-white p-5 shadow-sm" aria-label="Outfit customizer">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Make it yours</p>
                <h2 className="mt-1 text-xl font-semibold">Customize this look</h2>
                <p className="mt-1 text-sm text-slate-600">Swap any piece for another item from your wardrobe.</p>
              </div>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
              >
                Close
              </button>
            </div>
            <OutfitPreview items={selectedBuilderItems} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {builderCategories.map((category) => {
                const options = wardrobe.filter((item) => item.category === category && item.availability !== 'laundry');
                if (options.length === 0) return null;
                return (
                  <label key={category} className="block">
                    <span className="mb-2 block text-sm font-medium capitalize text-slate-600">{category}</span>
                    <select
                      value={builderItems[category] ?? ''}
                      onChange={(event) => setBuilderItems((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700"
                    >
                      <option value="">No {category}</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="mb-2 block text-sm font-medium text-slate-600">Name your outfit</span>
                <input
                  value={builderName}
                  maxLength={80}
                  onChange={(event) => setBuilderName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700"
                />
              </label>
              <button
                type="button"
                disabled={isSavingOutfit}
                onClick={() => void saveCustomizedOutfit()}
                className="self-end rounded-full bg-rose-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {isSavingOutfit ? 'Saving…' : 'Save outfit'}
              </button>
            </div>
          </section>
        ) : null}
        </div>
      </main>
      {activeImageIndex !== null && lightboxItems.length > 0 && <ImageLightbox items={lightboxItems} initialIndex={activeImageIndex} onClose={() => setActiveImageIndex(null)} />}
    </AppShell>
  );
}
