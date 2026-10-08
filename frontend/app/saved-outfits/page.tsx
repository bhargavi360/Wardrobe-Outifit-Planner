'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError } from '../../lib/api';
import { useAuth } from '../providers';
import { AppShell } from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';

type WardrobeCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear' | 'accessory';

type WardrobeItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  sub_type: string | null;
  dominant_colors: string[];
  image_url: string;
};

type SavedOutfitItem = {
  item_id: string;
  category: string;
  name: string;
  dominant_colors: string[];
  sub_type?: string | null;
};

type SavedOutfit = {
  id: string;
  user_id: string;
  name: string;
  occasion: string;
  items: SavedOutfitItem[];
  notes: string;
  is_favorite: boolean;
};

const categorySlots: Array<{ key: WardrobeCategory; label: string }> = [
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'dress', label: 'Dress' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Footwear' },
  { key: 'accessory', label: 'Accessory' },
];

export default function SavedOutfitsPage() {
  const showToast = useToast();
  const { user } = useAuth();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [selected, setSelected] = useState<Record<WardrobeCategory, string>>({
    top: '',
    bottom: '',
    dress: '',
    outerwear: '',
    footwear: '',
    accessory: '',
  });
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('casual');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOutfitId, setEditingOutfitId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewingOutfitId, setViewingOutfitId] = useState<string | null>(null);

  const selectedItems = useMemo(
    () =>
      categorySlots
        .map(({ key }) => {
          const itemId = selected[key];
          if (!itemId) return null;
          const wardrobeItem = wardrobe.find((entry) => entry.id === itemId);
          if (!wardrobeItem) return null;
          return {
            item_id: wardrobeItem.id,
            category: wardrobeItem.category,
            name: wardrobeItem.name,
            dominant_colors: wardrobeItem.dominant_colors,
            sub_type: wardrobeItem.sub_type,
          } satisfies SavedOutfitItem;
        })
        .filter(Boolean) as SavedOutfitItem[],
    [selected, wardrobe],
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [items, outfits] = await Promise.all([
          apiRequest<WardrobeItem[]>('/wardrobe'),
          apiRequest<SavedOutfit[]>('/outfits'),
        ]);
        setWardrobe(items);
        setSavedOutfits(outfits);
      } catch (caught) {
        const message = caught instanceof ApiError ? caught.message : 'Unable to load wardrobe data.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const saveOutfit = async () => {
    if (!name.trim()) {
      setError('Give the outfit a name before saving it.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Choose at least one wardrobe item for the outfit.');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        occasion,
        items: selectedItems,
        notes: notes.trim(),
        is_favorite: false,
      };
      const saved = await apiRequest<SavedOutfit>('/outfits', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSavedOutfits((current) => [saved, ...current]);
      setName('');
      setNotes('');
      setSelected({ top: '', bottom: '', dress: '', outerwear: '', footwear: '', accessory: '' });
      setError('');
      showToast('Your outfit has been saved.');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not save the outfit.';
      setError(message);
    }
  };

  const toggleFavorite = async (outfit: SavedOutfit) => {
    try {
      const updated = await apiRequest<SavedOutfit>(`/outfits/${outfit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_favorite: !outfit.is_favorite }),
      });
      setSavedOutfits((current) => current.map((entry) => (entry.id === outfit.id ? updated : entry)));
      showToast(updated.is_favorite ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not update the outfit.';
      setError(message);
    }
  };

  const renameOutfit = async (outfit: SavedOutfit) => {
    if (!editingName.trim()) {
      setError('An outfit name cannot be empty.');
      return;
    }
    try {
      const updated = await apiRequest<SavedOutfit>(`/outfits/${outfit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setSavedOutfits((current) => current.map((entry) => (entry.id === outfit.id ? updated : entry)));
      setEditingOutfitId(null);
      setEditingName('');
      setError('');
      showToast('Your outfit was renamed.');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not rename the outfit.';
      setError(message);
    }
  };

  const deleteOutfit = async (outfitId: string) => {
    try {
      await apiRequest<void>(`/outfits/${outfitId}`, { method: 'DELETE' });
      setSavedOutfits((current) => current.filter((entry) => entry.id !== outfitId));
      showToast('Saved outfit deleted.');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not delete the outfit.';
      setError(message);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <main className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Sit with it</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved outfits</h1>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Outfit name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                placeholder="Sunday brunch set"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Occasion</span>
                <select
                  value={occasion}
                  onChange={(event) => setOccasion(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                >
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="party">Party</option>
                  <option value="gym">Gym</option>
                  <option value="ethnic">Ethnic</option>
                </select>
              </label>
            </div>

            <div className="space-y-3">
              {categorySlots.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
                  <select
                    value={selected[key]}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                  >
                    <option value="">Select {label.toLowerCase()}</option>
                    {wardrobe
                      .filter((item) => item.category === key)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-slate-300 focus:bg-white"
                placeholder="Add context or a mood note."
              />
            </label>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected
              </div>
              <button
                type="button"
                onClick={() => void saveOutfit()}
                className="rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Save outfit
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Your collection</h2>
          {loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : savedOutfits.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No saved looks yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {savedOutfits.map((outfit) => (
                <div key={outfit.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      {editingOutfitId === outfit.id ? (
                        <input
                          aria-label={`New name for ${outfit.name}`}
                          value={editingName}
                          maxLength={80}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void renameOutfit(outfit);
                            if (event.key === 'Escape') setEditingOutfitId(null);
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-900"
                        />
                      ) : (
                        <p className="font-medium text-slate-900">{outfit.name}</p>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{outfit.occasion}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(outfit)}
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        outfit.is_favorite ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {outfit.is_favorite ? 'Favorite' : 'Save'}
                    </button>
                  </div>

                  {outfit.items.some((item) => wardrobe.some((piece) => piece.id === item.item_id && piece.image_url)) ? (
                    <div className="saved-look-images" aria-label={`${outfit.name} item photos`}>
                      {outfit.items.slice(0, 4).map((item) => {
                        const imageUrl = wardrobe.find((piece) => piece.id === item.item_id)?.image_url;
                        if (!imageUrl) return null;

                        return (
                          <div className="saved-look-image" key={item.item_id}>
                            <Image src={imageUrl} alt={item.name} fill sizes="72px" unoptimized />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mb-2 flex flex-wrap gap-2">
                    {outfit.items.map((item) => (
                      <span key={item.item_id} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                        {item.name}
                      </span>
                    ))}
                  </div>

                  {outfit.notes ? <p className="mb-3 text-sm text-slate-600">{outfit.notes}</p> : null}

                  {viewingOutfitId === outfit.id ? (
                    <div className="mb-3 rounded-xl bg-rose-50/70 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">Look details</p>
                      <ul className="space-y-1">
                        {outfit.items.map((item) => (
                          <li key={item.item_id} className="text-xs text-slate-700">
                            <span className="capitalize">{item.category}</span>
                            {item.sub_type ? ` · ${item.sub_type}` : ''} — {item.name}
                            {item.dominant_colors.length ? ` · ${item.dominant_colors.join(', ')}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() => setViewingOutfitId((current) => current === outfit.id ? null : outfit.id)}
                      className="text-sm font-medium text-slate-700 underline underline-offset-2"
                    >
                      {viewingOutfitId === outfit.id ? 'Hide details' : 'View details'}
                    </button>
                    {editingOutfitId === outfit.id ? (
                      <>
                        <button type="button" onClick={() => void renameOutfit(outfit)} className="text-sm font-medium text-rose-800">
                          Save name
                        </button>
                        <button type="button" onClick={() => setEditingOutfitId(null)} className="text-sm text-slate-500">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOutfitId(outfit.id);
                          setEditingName(outfit.name);
                        }}
                        className="text-sm font-medium text-rose-800"
                      >
                        Rename
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteOutfit(outfit.id)}
                      className="text-sm font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>
    </AppShell>
  );
}
