'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { AppShell } from '../../components/AppShell';
import { ImageLightbox } from '../../components/ImageZoom';
import { useToast } from '../../components/ToastProvider';
import { apiRequest, API_URL } from '../../lib/api';

type ClothingCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear' | 'accessory';
type ClothingSeason = 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season';

type WardrobeItem = {
  id: string;
  name: string;
  category: ClothingCategory;
  sub_type: string | null;
  dominant_colors: string[];
  dominant_color_hex: string[];
  image_url: string;
  season: ClothingSeason;
  occasion_tags: string[];
  user_notes: string;
  created_at: string;
  pattern: 'solid' | 'striped' | 'checked' | 'unknown' | null;
  sleeve_length: 'short' | 'long' | 'unknown' | null;
  attribute_summary: string | null;
};

type WardrobeForm = {
  name: string;
  category: ClothingCategory;
  sub_type: string;
  dominant_colors: string;
  season: ClothingSeason;
  occasion_tags: string;
  user_notes: string;
};

type ClassificationResult = {
  category: ClothingCategory;
  confidence: number;
};

type ClassificationStatus = 'idle' | 'loading' | 'ready' | 'error';

const categoryLabels: Record<ClothingCategory, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  outerwear: 'Outerwear',
  footwear: 'Footwear',
  accessory: 'Accessories',
};

const seasonLabels: Record<ClothingSeason, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  'all-season': 'All season',
};

const emptyForm: WardrobeForm = {
  name: '',
  category: 'top',
  sub_type: '',
  dominant_colors: '',
  season: 'all-season',
  occasion_tags: '',
  user_notes: '',
};

function splitTags(value: string): string[] {
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
}

function imageSource(imageUrl: string): string {
  return new URL(imageUrl, `${API_URL}/`).toString();
}

export default function WardrobePage() {
  const showToast = useToast();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | ClothingCategory>('all');
  const [subType, setSubType] = useState('all');
  const [season, setSeason] = useState<'all' | ClothingSeason>('all');
  const [occasion, setOccasion] = useState('all');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [form, setForm] = useState<WardrobeForm>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus>('idle');
  const [classificationError, setClassificationError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const classificationRequestId = useRef(0);
  const categoryWasEdited = useRef(false);

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const loadWardrobe = async () => {
      try {
        setLoading(true);
        const wardrobe = await apiRequest<WardrobeItem[]>('/wardrobe');
        setItems(wardrobe);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load your wardrobe.');
      } finally {
        setLoading(false);
      }
    };

    void loadWardrobe();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setIsModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen, saving]);

  const colors = useMemo(() => {
    const colorByKey = new Map<string, string>();
    items.flatMap((item) => item.dominant_colors).forEach((entry) => {
      colorByKey.set(entry.toLowerCase(), entry);
    });
    return [...colorByKey.values()].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const subTypes = useMemo(
    () => [...new Set(items.map((item) => item.sub_type).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const occasions = useMemo(
    () => [...new Set(items.flatMap((item) => item.occasion_tags))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const matchesSubType = subType === 'all' || item.sub_type?.toLowerCase() === subType.toLowerCase();
      const matchesSeason = season === 'all' || item.season === season;
      const matchesOccasion = occasion === 'all' || item.occasion_tags.some(
        (tag) => tag.toLowerCase() === occasion.toLowerCase(),
      );
      const matchesColor = selectedColors.length === 0 || item.dominant_colors.some(
        (itemColor) => selectedColors.some((selected) => selected.toLowerCase() === itemColor.toLowerCase()),
      );
      const createdDate = item.created_at.slice(0, 10);
      const matchesCreatedFrom = !createdFrom || createdDate >= createdFrom;
      const matchesCreatedTo = !createdTo || createdDate <= createdTo;
      const haystack = [
        item.name,
        item.sub_type ?? '',
        item.user_notes,
        ...item.dominant_colors,
        ...item.occasion_tags,
      ].join(' ').toLowerCase();
      return matchesCategory
        && matchesSubType
        && matchesSeason
        && matchesOccasion
        && matchesColor
        && matchesCreatedFrom
        && matchesCreatedTo
        && haystack.includes(normalizedQuery);
    });
  }, [category, createdFrom, createdTo, items, occasion, query, season, selectedColors, subType]);

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setSubType('all');
    setSeason('all');
    setOccasion('all');
    setSelectedColors([]);
    setCreatedFrom('');
    setCreatedTo('');
  };

  const classifySelectedFile = (file: File | null) => {
    const requestId = ++classificationRequestId.current;
    categoryWasEdited.current = false;
    setSelectedFile(file);
    setClassification(null);
    setClassificationError('');

    if (!file) {
      setClassificationStatus('idle');
      return;
    }

    const upload = new FormData();
    upload.set('file', file);
    setClassificationStatus('loading');
    void apiRequest<ClassificationResult>('/classify', {
      method: 'POST',
      body: upload,
    }).then((result) => {
      if (requestId !== classificationRequestId.current) return;
      setClassification(result);
      setClassificationStatus('ready');
      if (!categoryWasEdited.current) {
        setForm((current) => ({ ...current, category: result.category }));
      }
    }).catch((caught: unknown) => {
      if (requestId !== classificationRequestId.current) return;
      setClassificationStatus('error');
      setClassificationError(
        caught instanceof Error
          ? `${caught.message} Choose the category manually to continue.`
          : 'Automatic classification failed. Choose the category manually to continue.',
      );
    });
  };

  const lightboxItems = useMemo(
    () => filteredItems.map((item) => ({
      src: imageSource(item.image_url),
      alt: item.name,
      title: item.name,
      subtitle: `${categoryLabels[item.category]} · ${item.sub_type ?? 'Wardrobe piece'}`,
      sharedId: item.id,
    })),
    [filteredItems],
  );

  const closeModal = () => {
    if (saving) return;
    classificationRequestId.current += 1;
    setIsModalOpen(false);
    setEditingItem(null);
    setSelectedFile(null);
    setClassification(null);
    setClassificationStatus('idle');
    setClassificationError('');
    setForm(emptyForm);
  };

  const openCreateModal = () => {
    setError('');
    setNotice('');
    setEditingItem(null);
    classificationRequestId.current += 1;
    setSelectedFile(null);
    setClassification(null);
    setClassificationStatus('idle');
    setClassificationError('');
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (item: WardrobeItem) => {
    setError('');
    setNotice('');
    setEditingItem(item);
    setSelectedFile(null);
    setForm({
      name: item.name,
      category: item.category,
      sub_type: item.sub_type ?? '',
      dominant_colors: item.dominant_colors.join(', '),
      season: item.season,
      occasion_tags: item.occasion_tags.join(', '),
      user_notes: item.user_notes,
    });
    setIsModalOpen(true);
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!editingItem && !selectedFile) {
      setError('Choose an image to add this piece to your wardrobe.');
      return;
    }

    const dominantColors = splitTags(form.dominant_colors);
    const occasionTags = splitTags(form.occasion_tags);
    if (dominantColors.length > 5) {
      setError('Add no more than five colors.');
      return;
    }
    if (occasionTags.length > 10) {
      setError('Add no more than ten occasion tags.');
      return;
    }

    setSaving(true);
    try {
      let savedItem: WardrobeItem;
      if (editingItem) {
        savedItem = await apiRequest<WardrobeItem>(`/wardrobe/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            sub_type: form.sub_type.trim() || null,
            dominant_colors: dominantColors,
            season: form.season,
            occasion_tags: occasionTags,
            user_notes: form.user_notes,
          }),
        });
        setItems((current) => current.map((item) => item.id === savedItem.id ? savedItem : item));
        setNotice('Wardrobe piece updated.');
        showToast('Wardrobe piece updated.');
      } else {
        const upload = new FormData();
        upload.set('image', selectedFile!);
        upload.set('name', form.name);
        upload.set('category', form.category);
        if (form.sub_type.trim()) upload.set('sub_type', form.sub_type.trim());
        upload.set('season', form.season);
        upload.set('user_notes', form.user_notes);
        dominantColors.forEach((entry) => upload.append('dominant_colors', entry));
        occasionTags.forEach((entry) => upload.append('occasion_tags', entry));
        savedItem = await apiRequest<WardrobeItem>('/wardrobe', {
          method: 'POST',
          body: upload,
        });
        setItems((current) => [savedItem, ...current]);
        setNotice('Piece added to your wardrobe.');
        showToast('Piece added to your wardrobe.');
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setSelectedFile(null);
      setForm(emptyForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The wardrobe piece could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: WardrobeItem) => {
    if (!window.confirm(`Delete “${item.name}” from your wardrobe? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    setDeletingId(item.id);
    try {
      await apiRequest<void>(`/wardrobe/${item.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`${item.name} was removed from your wardrobe.`);
      showToast(`${item.name} was removed from your wardrobe.`);
      setActiveImageIndex(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The wardrobe piece could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <main className="wardrobe-page">
        <section className="wardrobe-toolbar">
          <div className="wardrobe-toolbar-heading">
            <p className="wardrobe-eyebrow">My closet · {items.length} pieces</p>
            <h1>Wardrobe</h1>
            <p className="wardrobe-intro">A considered collection of the pieces that make your style yours.</p>
          </div>
          <button className="wardrobe-primary-button" type="button" onClick={openCreateModal}>
            <span aria-hidden="true">＋</span> Add a piece
          </button>
        </section>

        <section className="wardrobe-filter-panel" aria-label="Filter wardrobe">
          <div className="wardrobe-filter-controls">
            <label className="wardrobe-search">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, color, occasion..."
              />
            </label>
            <label>
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as 'all' | ClothingCategory)}>
                <option value="all">All categories</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option value={key} key={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select value={subType} onChange={(event) => setSubType(event.target.value)}>
                <option value="all">All types</option>
                {subTypes.map((value) => <option value={value} key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Season</span>
              <select value={season} onChange={(event) => setSeason(event.target.value as 'all' | ClothingSeason)}>
                <option value="all">All seasons</option>
                {Object.entries(seasonLabels).map(([key, label]) => (
                  <option value={key} key={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Occasion</span>
              <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
                <option value="all">All occasions</option>
                {occasions.map((value) => <option value={value} key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Added from</span>
              <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
            </label>
            <label>
              <span>Added to</span>
              <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
            </label>
          </div>
          {colors.length ? (
            <fieldset className="wardrobe-color-filters">
              <legend>Dominant colors <span>(match any)</span></legend>
              <div className="wardrobe-color-options">
                {colors.map((entry) => (
                  <label className="wardrobe-color-option" key={entry}>
                    <input
                      type="checkbox"
                      checked={selectedColors.some((selected) => selected.toLowerCase() === entry.toLowerCase())}
                      onChange={(event) => setSelectedColors((current) => (
                        event.target.checked
                          ? [...current, entry]
                          : current.filter((selected) => selected.toLowerCase() !== entry.toLowerCase())
                      ))}
                    />
                    <span>{entry}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="wardrobe-filter-footer">
            <button className="wardrobe-text-button" type="button" onClick={clearFilters}>
              Clear all filters
            </button>
            <p className="wardrobe-result-count">Showing {filteredItems.length} of {items.length}</p>
          </div>
        </section>

        {error ? <div className="wardrobe-feedback is-error" role="alert">{error}</div> : null}
        {notice ? <div className="wardrobe-feedback" role="status">{notice}</div> : null}

        {loading ? (
          <div className="wardrobe-grid" aria-label="Loading wardrobe">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="wardrobe-skeleton" key={index}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <section className="wardrobe-empty">
            <span className="wardrobe-empty-mark" aria-hidden="true">T.</span>
            <h2>{items.length === 0 ? 'Your wardrobe starts here.' : 'No pieces match these filters.'}</h2>
            <p>
              {items.length === 0
                ? 'Add your first clothing image and begin building a more considered closet.'
                : 'Try clearing a filter or changing your search to see more of your collection.'}
            </p>
            {items.length === 0 ? (
              <button className="wardrobe-primary-button" type="button" onClick={openCreateModal}>Add your first piece</button>
            ) : (
              <button
                className="wardrobe-text-button"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </section>
        ) : (
          <section className="wardrobe-grid" aria-label="Wardrobe pieces">
            {filteredItems.map((item, index) => (
              <article className="wardrobe-item-card" key={item.id}>
                <button
                  className="wardrobe-item-image-button"
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`View ${item.name}`}
                >
                  <Image
                    src={imageSource(item.image_url)}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized
                  />
                  <span className="wardrobe-image-label">{categoryLabels[item.category]}</span>
                </button>
                <div className="wardrobe-item-details">
                  <div className="wardrobe-item-title-row">
                    <div>
                      <h2>{item.name}</h2>
                      {item.sub_type ? <p>{item.sub_type}</p> : null}
                    </div>
                    <span className="wardrobe-season">{seasonLabels[item.season]}</span>
                  </div>
                  {item.dominant_colors.length ? (
                    <div className="wardrobe-chip-row" aria-label="Colors">
                      {item.dominant_colors.map((entry, colorIndex) => {
                        const hex = item.dominant_color_hex?.[colorIndex];
                        const validHex = /^#[0-9a-f]{6}$/i.test(hex ?? '');
                        return (
                          <span className="wardrobe-chip" key={`${entry}-${colorIndex}`}>
                            {validHex ? (
                              <span
                                className="wardrobe-color-swatch"
                                style={{ backgroundColor: hex }}
                                aria-hidden="true"
                              />
                            ) : null}
                            {entry}
                            {validHex ? <small>{hex}</small> : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {item.pattern || item.sleeve_length || item.attribute_summary ? (
                    <div className="wardrobe-detected-attributes" aria-label="Detected attributes">
                      {item.pattern && item.pattern !== 'unknown' ? <span>{item.pattern}</span> : null}
                      {item.sleeve_length && item.sleeve_length !== 'unknown' ? (
                        <span>{item.sleeve_length} sleeves</span>
                      ) : null}
                      {item.attribute_summary ? <p>{item.attribute_summary}</p> : null}
                    </div>
                  ) : null}
                  {item.occasion_tags.length ? (
                    <p className="wardrobe-occasion">For {item.occasion_tags.join(' · ')}</p>
                  ) : null}
                  <p className="wardrobe-created-at">
                    Added {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="wardrobe-item-actions">
                    <button type="button" onClick={() => openEditModal(item)}>Edit details</button>
                    <button
                      type="button"
                      className="is-destructive"
                      onClick={() => void deleteItem(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? 'Removing…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeImageIndex !== null && lightboxItems.length > 0 ? (
          <ImageLightbox
            items={lightboxItems}
            initialIndex={activeImageIndex}
            onClose={() => setActiveImageIndex(null)}
          />
        ) : null}

        {isModalOpen ? (
          <div
            className="wardrobe-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <section
              className="wardrobe-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="wardrobe-modal-title"
            >
              <div className="wardrobe-modal-heading">
                <div>
                  <p className="wardrobe-eyebrow">{editingItem ? 'REFINE YOUR EDIT' : 'A NEW FAVOURITE'}</p>
                  <h2 id="wardrobe-modal-title">{editingItem ? 'Edit wardrobe piece' : 'Add to your wardrobe'}</h2>
                </div>
                <button className="wardrobe-modal-close" type="button" onClick={closeModal} aria-label="Close">
                  ×
                </button>
              </div>

              <form className="wardrobe-form" onSubmit={saveItem}>
                {!editingItem ? (
                  <label className="wardrobe-upload-field">
                    <span className="wardrobe-field-label">Clothing image <b>*</b></span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      onChange={(event) => classifySelectedFile(event.target.files?.[0] ?? null)}
                    />
                    {previewUrl ? (
                      <span className="wardrobe-upload-preview">
                        <Image src={previewUrl} alt="Preview of selected clothing item" fill unoptimized />
                        <span>Choose a different image</span>
                      </span>
                    ) : (
                      <span className="wardrobe-upload-prompt">
                        <b aria-hidden="true">＋</b>
                        <span>Choose an image to preview your piece</span>
                        <small>JPEG, PNG, or WebP</small>
                      </span>
                    )}
                    {classificationStatus === 'loading' ? (
                      <small className="wardrobe-classification-feedback" role="status">
                        Recognizing clothing category…
                      </small>
                    ) : null}
                    {classification ? (
                      <small className="wardrobe-classification-feedback" role="status">
                        Suggested: {categoryLabels[classification.category]} ({Math.round(classification.confidence * 100)}% confidence).
                        You can change the category below.
                      </small>
                    ) : null}
                    {classificationStatus === 'error' ? (
                      <small className="wardrobe-classification-feedback is-error" role="status">
                        {classificationError}
                      </small>
                    ) : null}
                  </label>
                ) : (
                  <p className="wardrobe-edit-image-note">Image stays the same when you edit item details.</p>
                )}

                <label>
                  <span className="wardrobe-field-label">Name <b>*</b></span>
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Ivory linen shirt"
                  />
                </label>

                <div className="wardrobe-form-row">
                  <label>
                    <span className="wardrobe-field-label">Category <b>*</b></span>
                    <select
                      value={form.category}
                      onChange={(event) => {
                        categoryWasEdited.current = true;
                        setForm((current) => ({ ...current, category: event.target.value as ClothingCategory }));
                      }}
                    >
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option value={key} key={key}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="wardrobe-field-label">Type</span>
                    <input
                      maxLength={60}
                      value={form.sub_type}
                      onChange={(event) => setForm((current) => ({ ...current, sub_type: event.target.value }))}
                      placeholder="e.g. Blazer"
                    />
                  </label>
                </div>

                <div className="wardrobe-form-row">
                  <label>
                    <span className="wardrobe-field-label">Season</span>
                    <select
                      value={form.season}
                      onChange={(event) => setForm((current) => ({ ...current, season: event.target.value as ClothingSeason }))}
                    >
                      {Object.entries(seasonLabels).map(([key, label]) => (
                        <option value={key} key={key}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="wardrobe-field-label">Colors</span>
                    <input
                      value={form.dominant_colors}
                      onChange={(event) => setForm((current) => ({ ...current, dominant_colors: event.target.value }))}
                      placeholder="Ivory, navy"
                    />
                    <small className="wardrobe-field-hint">Separate colors with commas.</small>
                  </label>
                </div>

                <label>
                  <span className="wardrobe-field-label">Occasions</span>
                  <input
                    value={form.occasion_tags}
                    onChange={(event) => setForm((current) => ({ ...current, occasion_tags: event.target.value }))}
                    placeholder="Work, weekend, evening"
                  />
                  <small className="wardrobe-field-hint">Separate tags with commas.</small>
                </label>

                <label>
                  <span className="wardrobe-field-label">Notes</span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={form.user_notes}
                    onChange={(event) => setForm((current) => ({ ...current, user_notes: event.target.value }))}
                    placeholder="Fit notes or why you love this piece"
                  />
                </label>

                {error ? <p className="wardrobe-feedback is-error" role="alert">{error}</p> : null}

                <div className="wardrobe-form-actions">
                  <button className="wardrobe-text-button" type="button" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button
                    className="wardrobe-primary-button"
                    type="submit"
                    disabled={saving || (!editingItem && classificationStatus === 'loading')}
                  >
                    {saving
                      ? 'Saving…'
                      : !editingItem && classificationStatus === 'loading'
                        ? 'Recognizing…'
                        : editingItem
                          ? 'Save changes'
                          : 'Add piece'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
