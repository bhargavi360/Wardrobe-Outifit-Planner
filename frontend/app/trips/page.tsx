'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';
import { apiImageUrl, apiRequest, fetchWardrobe } from '../../lib/api';
import { localDay, prettyDay, type SavedLook, type Trip, type WardrobePiece } from '../../lib/planning';

export default function TripsPage() {
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [outfits, setOutfits] = useState<SavedLook[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobePiece[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState(localDay());
  const [end, setEnd] = useState(localDay());
  const [outfitIds, setOutfitIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const selected = trips.find(trip => trip.id === selectedId);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([apiRequest<Trip[]>('/planning/trips'), apiRequest<SavedLook[]>('/outfits'), fetchWardrobe<WardrobePiece>()]).then(([lists, looks, pieces]) => {
      if (!active) return;
      setTrips(lists); setOutfits(looks); setWardrobe(pieces); setSelectedId(current => lists.some(trip => trip.id === current) ? current : lists[0]?.id ?? '');
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Trips could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  function reset() { setEditingId(''); setName(''); setDestination(''); setOutfitIds([]); setStart(localDay()); setEnd(localDay()); }
  function store(trip: Trip) { setTrips(current => [trip, ...current.filter(value => value.id !== trip.id)]); setSelectedId(trip.id); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (end < start || !outfitIds.length || !name.trim()) { setError('Name your trip, choose at least one outfit, and check the dates.'); return; }
    setBusy(true); setError('');
    try {
      const trip = await apiRequest<Trip>(editingId ? `/planning/trips/${editingId}` : '/planning/trips', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify({ name, destination, start_date: start, end_date: end, outfit_ids: outfitIds }) });
      store(trip); reset(); toast('Your packing list is ready.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your trip.'); }
    finally { setBusy(false); }
  }
  async function toggle(itemId: string, packed: boolean) {
    if (!selected) return;
    const previous = selected;
    const packedIds = packed ? [...new Set([...selected.packed_item_ids, itemId])] : selected.packed_item_ids.filter(id => id !== itemId);
    setTrips(current => current.map(trip => trip.id === selected.id ? { ...trip, packed_item_ids: packedIds } : trip));
    setBusy(true); setError('');
    try { store(await apiRequest<Trip>(`/planning/trips/${selected.id}/packing`, { method: 'PATCH', body: JSON.stringify({ item_id: itemId, packed }) })); }
    catch (cause) { setTrips(current => current.map(trip => trip.id === previous.id ? previous : trip)); setError(cause instanceof Error ? cause.message : 'Could not update the checklist.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true); setError('');
    try { await apiRequest(`/planning/trips/${selected.id}`, { method: 'DELETE' }); setTrips(current => current.filter(trip => trip.id !== selected.id)); setSelectedId(trips.find(trip => trip.id !== selected.id)?.id ?? ''); if (editingId === selected.id) reset(); toast('Trip removed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the trip.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!selected) return;
    const content = [selected.name, selected.destination, `${selected.start_date} — ${selected.end_date}`, '', ...selected.items.map(item => `${selected.packed_item_ids.includes(item.item_id) ? '[x]' : '[ ]'} ${item.name} (${item.category})`)].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'thread-packing-list.txt'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <AppShell><main className="thread-workspace">
    <header className="thread-page-heading"><p>Room for a little adventure</p><h1>Pack less. Wear more.</h1><span>Choose your saved looks. We’ll bring their pieces into one checklist, counting shared pieces once.</span></header>
    {error && <div role="alert" className="thread-error">{error} <button onClick={() => setRetry(value => value + 1)}>Reload</button></div>}
    {loading ? <p role="status" className="thread-panel">Loading your trips…</p> : <>
      {!outfits.length && <div className="thread-panel thread-empty"><h2>Start with a look you love.</h2><p>Save outfits before creating a packing list.</p><Link href="/outfit-planner">Find a look ↗</Link></div>}
      <div className="thread-trip-layout">
        <section className="thread-panel"><h2>{editingId ? 'Refine your trip.' : 'Where to next?'}</h2><form onSubmit={event => void save(event)}><fieldset disabled={busy} className="thread-form-grid">
          <label>Trip name<input value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder="A weekend away" /></label>
          <label>Destination<input value={destination} onChange={event => setDestination(event.target.value)} maxLength={120} placeholder="Where you’re headed" /></label>
          <label>Departure date<input type="date" value={start} onChange={event => setStart(event.target.value)} required /></label>
          <label>Return date<input type="date" value={end} onChange={event => setEnd(event.target.value)} min={start} required /></label>
          <div className="thread-outfit-options"><p>Choose saved outfits</p>{outfits.map(outfit => <label key={outfit.id}><input type="checkbox" checked={outfitIds.includes(outfit.id)} onChange={event => setOutfitIds(current => event.target.checked ? [...current, outfit.id] : current.filter(id => id !== outfit.id))} /><span><strong>{outfit.name}</strong><small>{outfit.items.length} pieces · {outfit.occasion}</small></span></label>)}</div>
          <button className="thread-button" disabled={busy || !outfits.length || !outfitIds.length}>{busy ? 'Saving…' : editingId ? 'Save trip changes' : 'Create packing list'}</button>
          {editingId && <button type="button" onClick={reset}>Cancel edit</button>}
        </fieldset></form></section>
        <section className="thread-panel" aria-label="Trip packing checklist"><div className="thread-section-top"><h2>Your journeys.</h2><span>{trips.length} saved</span></div>
          {trips.length ? <><label className="thread-trip-select">Open trip<select value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label>
            {selected && <><div className="thread-trip-summary"><h3>{selected.name}</h3><p>{selected.destination} · {prettyDay(selected.start_date)} — {prettyDay(selected.end_date)}</p><p>{selected.outfit_names.join(' · ')}</p><div className="thread-actions"><button disabled={busy} onClick={() => { setEditingId(selected.id); setName(selected.name); setDestination(selected.destination); setStart(selected.start_date); setEnd(selected.end_date); setOutfitIds(selected.outfit_ids); }}>Edit trip</button><button onClick={download}>Download checklist</button><button disabled={busy} onClick={() => void remove()}>Delete trip</button></div></div>
              <label className="thread-pack-progress">{selected.packed_item_ids.length} of {selected.items.length} pieces packed<progress aria-label="Packing progress" max={selected.items.length || 1} value={selected.packed_item_ids.length} /></label>
              <div className="thread-packing-items">{selected.items.map(item => { const piece = wardrobe.find(value => value.id === item.item_id); return <label key={item.item_id} className={selected.packed_item_ids.includes(item.item_id) ? 'is-packed' : ''}><input type="checkbox" checked={selected.packed_item_ids.includes(item.item_id)} disabled={busy} onChange={event => void toggle(item.item_id, event.target.checked)} />{piece && <img src={apiImageUrl(piece.image_url)} alt="" />}<span><strong>{item.name}</strong><small>{item.category} · Used in {item.outfit_names.length} {item.outfit_names.length === 1 ? 'look' : 'looks'}</small>{piece?.availability === 'laundry' && <em>In laundry — clean before packing</em>}{!piece && <em>Removed from wardrobe</em>}</span></label>; })}</div>
            </>}
          </> : <p className="thread-small-note">Create your first trip to see its packing checklist here.</p>}
        </section>
      </div>
    </>}
  </main></AppShell>;
}
