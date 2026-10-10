'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiRequest, apiImageUrl, fetchWardrobe } from '../../lib/api';
import { AppShell } from '../../components/AppShell';
import { OutfitPreview } from '../../components/OutfitPreview';
import { useToast } from '../../components/ToastProvider';
type Piece = { id: string; name: string; category: string; image_url: string; sub_type: string | null; dominant_colors: string[]; availability?: string };
type LookItem = { item_id: string; name: string; category: string; dominant_colors: string[]; sub_type?: string | null };
type Look = { id: string; name: string; occasion: string; notes: string; is_favorite: boolean; items: LookItem[]; created_at?: string | null; updated_at?: string | null };
const occasions = ['casual', 'formal', 'party', 'gym', 'ethnic'];
const categories = ['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory'];
export default function SavedOutfitsPage() {
  const toast = useToast();
  const editor = useRef<HTMLElement>(null);
  const [wardrobe, setWardrobe] = useState<Piece[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('casual');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [draftItems, setDraftItems] = useState<LookItem[]>([]);
  const [query, setQuery] = useState('');
  const [occasionFilter, setOccasionFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [expanded, setExpanded] = useState('');
  const [deleting, setDeleting] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([fetchWardrobe<Piece>(), apiRequest<Look[]>('/outfits')]).then(([pieces, outfits]) => {
      if (!active) return;
      setWardrobe(pieces.map(piece => ({ ...piece, image_url: apiImageUrl(piece.image_url) }))); setLooks(outfits);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your collection.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return looks.filter(look => (!favoritesOnly || look.is_favorite) && (occasionFilter === 'all' || look.occasion === occasionFilter) && [look.name, look.notes, ...look.items.map(item => item.name)].join(' ').toLocaleLowerCase().includes(search)).sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'favorites' && a.is_favorite !== b.is_favorite) return Number(b.is_favorite) - Number(a.is_favorite);
      const timestamp = (look: Look) => { const value = Date.parse((sort === 'updated' ? look.updated_at : look.created_at) ?? ''); return Number.isFinite(value) ? value : 0; };
      return timestamp(b) - timestamp(a);
    });
  }, [looks, query, favoritesOnly, occasionFilter, sort]);
  function reset() { setEditingId(''); setName(''); setOccasion('casual'); setNotes(''); setFavorite(false); setDraftItems([]); }
  function store(look: Look) { setLooks(current => [look, ...current.filter(entry => entry.id !== look.id)]); }
  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The outfit could not be updated.'); }
    finally { setBusy(false); }
  }
  function edit(look: Look) {
    setEditingId(look.id); setName(look.name); setOccasion(look.occasion); setNotes(look.notes); setFavorite(look.is_favorite); setDraftItems(look.items); setError('');
    editor.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    editor.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !draftItems.length) { setError('Name your outfit and choose at least one piece.'); return; }
    if (draftItems.some(item => !wardrobe.some(piece => piece.id === item.item_id))) { setError('Remove or replace missing wardrobe pieces before saving.'); return; }
    await perform(async () => {
      const look = await apiRequest<Look>(editingId ? `/outfits/${editingId}` : '/outfits', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ name, occasion, notes, is_favorite: favorite, items: draftItems }) });
      store(look); reset(); toast(editingId ? 'Your outfit has been updated.' : 'Your outfit has been saved.');
    });
  }
  async function duplicate(look: Look) {
    await perform(async () => {
      const copy = await apiRequest<Look>('/outfits', { method: 'POST', body: JSON.stringify({ name: `${look.name.slice(0, 73)} (copy)`, occasion: look.occasion, notes: look.notes, items: look.items, is_favorite: false }) });
      store(copy); edit(copy); toast('Outfit duplicated. Make it your own.');
    });
  }
  const selectedPieces = draftItems.flatMap(item => { const piece = wardrobe.find(value => value.id === item.item_id); return piece ? [piece] : []; });
  return <AppShell><main className="thread-workspace">
    <header className="thread-page-heading"><p>Keep the looks you love</p><h1>Saved outfits.</h1><span>Find a favorite, refine the details, or give a familiar look a new direction.</span><div className="thread-actions"><Link href="/calendar">Outfit calendar ↗</Link><Link href="/trips">Trip packing lists ↗</Link></div></header>
    {error && <div role="alert" className="thread-error">{error} <button disabled={busy} onClick={() => setRetry(value => value + 1)}>Reload collection</button></div>}
    {loading ? <p role="status" className="thread-panel">Loading your looks…</p> : <div className="thread-saved-layout">
      <section ref={editor} className="thread-panel thread-look-editor" aria-label="Outfit editor"><h2>{editingId ? 'Refine this look.' : 'Compose a look.'}</h2>
        {!wardrobe.length && <p className="thread-small-note">Add clothing to <Link href="/wardrobe">your wardrobe</Link> to compose your first look.</p>}
        <form onSubmit={event => void save(event)}><fieldset className="thread-form-grid thread-single-form" disabled={busy}>
          <label>Outfit name<input value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder="Sunday brunch set" /></label>
          <label>Occasion<select value={occasion} onChange={event => setOccasion(event.target.value)}>{occasions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <OutfitPreview items={selectedPieces} />
          <label>Add a wardrobe piece<select value="" disabled={draftItems.length >= 12 || !wardrobe.length} onChange={event => { const piece = wardrobe.find(value => value.id === event.target.value); if (piece) setDraftItems(current => [...current, { item_id: piece.id, name: piece.name, category: piece.category, dominant_colors: piece.dominant_colors, sub_type: piece.sub_type }]); }}>
            <option value="">Choose a piece</option>{categories.map(category => <optgroup key={category} label={category}>{wardrobe.filter(piece => piece.category === category && !draftItems.some(item => item.item_id === piece.id)).map(piece => <option key={piece.id} value={piece.id}>{piece.name}{piece.availability === 'laundry' ? ' · In laundry' : ''}</option>)}</optgroup>)}
          </select></label>
          <div className="thread-selected-pieces">{draftItems.map(item => { const piece = wardrobe.find(value => value.id === item.item_id); return <div key={item.item_id}><span>{piece?.name ?? item.name}{!piece ? ' · Removed from wardrobe' : piece.availability === 'laundry' ? ' · In laundry' : ''}</span><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setDraftItems(current => current.filter(value => value.item_id !== item.item_id))}>Remove</button></div>; })}</div>
          <label>Notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} maxLength={500} placeholder="Styling ideas, a favorite occasion, or a finishing touch." /></label>
          <label className="thread-check-label"><input type="checkbox" checked={favorite} onChange={event => setFavorite(event.target.checked)} />Add to favorites</label>
          <button className="thread-button" disabled={busy || !draftItems.length}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save outfit'}</button>
          {editingId && <button type="button" onClick={reset}>Cancel edit</button>}
        </fieldset></form>
      </section>
      <section className="thread-panel" aria-label="Saved outfit collection"><div className="thread-section-top"><h2>Your collection.</h2><span>{filtered.length} of {looks.length} looks</span></div>
        <div className="thread-collection-controls">
          <label>Search outfits<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, notes, or a piece" /></label>
          <label>Filter by occasion<select value={occasionFilter} onChange={event => setOccasionFilter(event.target.value)}><option value="all">All occasions</option>{occasions.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Sort outfits<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="favorites">Favorites first</option></select></label>
          <label className="thread-check-label"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} />Favorites only</label>
        </div>
        {!filtered.length ? <div className="thread-empty"><p>{looks.length ? 'No looks match these filters.' : 'Your first saved look belongs here.'}</p>{looks.length ? <button onClick={() => { setQuery(''); setOccasionFilter('all'); setFavoritesOnly(false); }}>Clear filters</button> : <Link href="/outfit-planner">Discover an outfit ↗</Link>}</div> : <div className="thread-look-collection">{filtered.map(look => {
          const missing = look.items.filter(item => !wardrobe.some(piece => piece.id === item.item_id));
          const laundry = look.items.filter(item => wardrobe.find(piece => piece.id === item.item_id)?.availability === 'laundry');
          return <article key={look.id} className="thread-look-card" aria-label={look.name}>
            <div className="thread-section-top"><div><h3>{look.name}</h3><p className="thread-small-note">{look.occasion} · {look.items.length} pieces</p></div><button aria-label={`${look.is_favorite ? 'Unfavorite' : 'Favorite'} ${look.name}`} aria-pressed={look.is_favorite} disabled={busy} onClick={() => void perform(async () => { store(await apiRequest<Look>(`/outfits/${look.id}`, { method: 'PATCH', body: JSON.stringify({ is_favorite: !look.is_favorite }) })); })}>{look.is_favorite ? '♥ Favorite' : '♡ Favorite'}</button></div>
            <div className="saved-look-images">{look.items.map(item => { const piece = wardrobe.find(value => value.id === item.item_id); return piece ? <figure key={item.item_id}><img src={piece.image_url} alt={piece.name} /><figcaption>{piece.name}</figcaption></figure> : null; })}</div>
            {look.notes && <p className="thread-look-notes">{look.notes}</p>}
            <p className={missing.length || laundry.length ? 'thread-availability-warning' : 'thread-ready-note'}>{missing.length ? `${missing.length} removed ${missing.length === 1 ? 'piece' : 'pieces'} · edit this look to replace them.` : laundry.length ? `${laundry.length} ${laundry.length === 1 ? 'piece is' : 'pieces are'} in laundry.` : 'Ready to wear'}</p>
            {expanded === look.id && <ul className="thread-look-details">{look.items.map(item => <li key={item.item_id}>{item.category} · {item.name}{item.dominant_colors.length ? ` · ${item.dominant_colors.join(', ')}` : ''}</li>)}</ul>}
            <div className="thread-actions"><button aria-expanded={expanded === look.id} onClick={() => setExpanded(current => current === look.id ? '' : look.id)}>{expanded === look.id ? 'Hide details' : 'View details'}</button><button disabled={busy} onClick={() => edit(look)}>Edit outfit</button><button disabled={busy || !!missing.length} onClick={() => void duplicate(look)}>Duplicate</button><Link href={missing.length ? '/wardrobe' : `/calendar?outfit=${encodeURIComponent(look.id)}`}>{missing.length ? 'Replace missing pieces ↗' : 'Plan this look ↗'}</Link><button disabled={busy} onClick={() => setDeleting(look.id)}>Delete</button></div>
            {deleting === look.id && <div className="thread-delete-confirm" role="group" aria-label={`Delete ${look.name}?`}><p>Delete this saved look? Your wardrobe, wear records, and existing trip lists will stay.</p><div className="thread-actions"><button disabled={busy} onClick={() => void perform(async () => { await apiRequest(`/outfits/${look.id}`, { method: 'DELETE' }); setLooks(current => current.filter(value => value.id !== look.id)); if (editingId === look.id) reset(); setDeleting(''); toast('Saved outfit deleted.'); })}>Confirm delete</button><button disabled={busy} onClick={() => setDeleting('')}>Keep outfit</button></div></div>}
          </article>;
        })}</div>}
      </section>
    </div>}
  </main></AppShell>;
}
