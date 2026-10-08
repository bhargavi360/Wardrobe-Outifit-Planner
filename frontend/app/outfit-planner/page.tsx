 'use client';

 import Image from 'next/image';
 import Link from 'next/link';
 import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { AppShell } from '../../components/AppShell';
import { ImageLightbox, ZoomableImageCard } from '../../components/ImageZoom';
import { useToast } from '../../components/ToastProvider';

type WardrobeItem = {
  id: string;
  name: string;
  category: 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear' | 'accessory';
  dominant_colors: string[];
  image_url: string;
  sub_type: string | null;
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
  const showToast = useToast();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [occasion, setOccasion] = useState<(typeof occasions)[number]>('casual');
  const [temperature, setTemperature] = useState(22);
  const [condition, setCondition] = useState<(typeof weatherOptions)[number]>('sunny');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [stylingTips, setStylingTips] = useState<Record<string, StylingTips>>({});
  const [stylingErrors, setStylingErrors] = useState<Record<string, string>>({});
  const [stylingLoadingKey, setStylingLoadingKey] = useState<string | null>(null);
  const [builderItems, setBuilderItems] = useState<Record<string, string>>({});
  const [builderName, setBuilderName] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadWardrobe = async () => {
      try {
        const items = await apiRequest<WardrobeItem[]>('/wardrobe');
        setWardrobe(items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load your closet.');
      } finally {
        setLoading(false);
      }
    };

    void loadWardrobe();
  }, []);

  const promptSummary = useMemo(
    () => `${occasion} · ${temperature}°C · ${condition}`,
    [condition, occasion, temperature],
  );

  const generateRecommendations = useCallback(async () => {
    if (loading) {
      return;
    }

    if (wardrobe.length === 0) {
      setRecommendations([]);
      return;
    }

    try {
      setError('');
      setIsGenerating(true);
      const response = await apiRequest<{ recommendations: Recommendation[] }>('/outfits/recommend', {
        method: 'POST',
        body: JSON.stringify({
          occasion,
          weather: {
            temperature_c: temperature,
            condition,
          },
        }),
      });
      setRecommendations(response.recommendations);
      setStylingTips({});
      setStylingErrors({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate outfit recommendations.');
      setRecommendations([]);
    } finally {
      setIsGenerating(false);
    }
  }, [condition, loading, occasion, temperature, wardrobe]);

  const requestStylingTips = async (recommendation: Recommendation) => {
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
      setStylingTips((current) => ({ ...current, [key]: result }));
    } catch (caught) {
      setStylingErrors((current) => ({
        ...current,
        [key]: caught instanceof Error ? caught.message : 'Unable to load styling suggestions.',
      }));
    } finally {
      setStylingLoadingKey(null);
    }
  };

  const openBuilder = (recommendation: Recommendation) => {
    const selected: Record<string, string> = {};
    recommendation.items.forEach((item) => {
      selected[item.category] = item.id;
    });
    setBuilderItems(selected);
    setBuilderName(`${occasion[0].toUpperCase()}${occasion.slice(1)} look`);
    setBuilderOpen(true);
    setSaveMessage('');
  };

  const saveCustomizedOutfit = async () => {
    const selectedItems = builderCategories
      .map((category) => wardrobe.find((item) => item.id === builderItems[category]))
      .filter((item): item is WardrobeItem => item !== undefined);
    if (!builderName.trim()) {
      setError('Give your outfit a name before saving it.');
      return;
    }
    if (selectedItems.length === 0) {
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
          occasion,
          items: selectedItems.map((item) => ({
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

  useEffect(() => {
    void generateRecommendations();
  }, [generateRecommendations]);

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
                <span className="mb-2 block text-sm font-medium text-slate-600">Temperature</span>
                <input
                  type="number"
                  min={-30}
                  max={60}
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                />
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
          </div>
        </section>

        <div id="daily-outfit-recommendations" className="planner-recommendations">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <p>Add wardrobe pieces to begin composing looks around your occasion and the day ahead.</p>
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
          <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {builderCategories.map((category) => {
                const options = wardrobe.filter((item) => item.category === category);
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
    </AppShell>
  );
}
