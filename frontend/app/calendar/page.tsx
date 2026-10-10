'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/AppShell';
import { useToast } from '../../components/ToastProvider';
import { apiImageUrl, apiRequest, fetchWardrobe } from '../../lib/api';
import { localDay, monday, prettyDay, shiftDay, type CalendarDay, type SavedLook, type WardrobePiece } from '../../lib/planning';

export default function CalendarPage() {
  const toast = useToast();
  const today = localDay();
  const [week, setWeek] = useState(() => monday(today));
  const [entries, setEntries] = useState<CalendarDay[]>([]);
  const [outfits, setOutfits] = useState<SavedLook[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobePiece[]>([]);
  const [day, setDay] = useState(today);
  const [outfitId, setOutfitId] = useState('');
  const [status, setStatus] = useState<'planned' | 'worn'>('planned');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([apiRequest<CalendarDay[]>('/planning/calendar'), apiRequest<SavedLook[]>('/outfits'), fetchWardrobe<WardrobePiece>()]).then(([calendar, looks, pieces]) => {
      if (!active) return;
      setEntries(calendar); setOutfits(looks); setWardrobe(pieces);
      const requested = new URLSearchParams(window.location.search).get('outfit');
      if (requested && looks.some(look => look.id === requested)) setOutfitId(requested);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Your calendar could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  async function save(targetDay = day, targetOutfit = outfitId, targetStatus = status) {
    setBusy(true); setError('');
    try {
      const entry = await apiRequest<CalendarDay>(`/planning/calendar/${targetDay}`, { method: 'PUT', body: JSON.stringify({ outfit_id: targetOutfit, status: targetStatus }) });
      setEntries(current => [entry, ...current.filter(record => record.date !== targetDay)]);
      toast(targetStatus === 'worn' ? 'Added to your wear history.' : 'Your day is planned.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this day.'); }
    finally { setBusy(false); }
  }
  async function clear(targetDay: string) {
    setBusy(true); setError('');
    try { await apiRequest(`/planning/calendar/${targetDay}`, { method: 'DELETE' }); setEntries(current => current.filter(entry => entry.date !== targetDay)); toast('Calendar entry removed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not clear this day.'); }
    finally { setBusy(false); }
  }
  const history = entries.filter(entry => entry.status === 'worn').sort((a, b) => b.date.localeCompare(a.date));
  const wearCounts = new Map<string, number>();
  history.forEach(entry => new Set(entry.items.map(item => item.item_id)).forEach(id => wearCounts.set(id, (wearCounts.get(id) ?? 0) + 1)));
  return <AppShell><main className="thread-workspace">
    <header className="thread-page-heading"><p>A little room for the week ahead</p><h1>Your days, considered.</h1><span>Plan one look per day. Record what you wore and rediscover the pieces you reach for.</span></header>
    {error && <div role="alert" className="thread-error">{error} <button onClick={() => setRetry(value => value + 1)}>Reload</button></div>}
    {loading ? <p role="status" className="thread-panel">Loading your calendar…</p> : <>
      {!outfits.length && <div className="thread-panel thread-empty"><h2>A week of possibilities.</h2><p>Save your first outfit to start planning.</p><Link href="/outfit-planner">Create a look ↗</Link></div>}
      <section className="thread-panel" aria-label="Schedule an outfit"><h2>Make a little plan.</h2><form className="thread-form-grid" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }}>
        <label>Date<input type="date" value={day} onChange={event => { setDay(event.target.value); if (event.target.value > today) setStatus('planned'); }} required /></label>
        <label>Saved outfit<select value={outfitId} onChange={event => setOutfitId(event.target.value)} required><option value="">Choose a look</option>{outfits.map(outfit => <option key={outfit.id} value={outfit.id}>{outfit.name}</option>)}</select></label>
        <label>Record as<select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="planned">Planned</option><option value="worn" disabled={day > today}>Worn</option></select></label>
        <button className="thread-button" disabled={busy || !outfits.length}>{busy ? 'Saving…' : 'Save day'}</button>
      </form><p className="thread-small-note">Saving another look for a date replaces that day’s entry.</p></section>
      <section className="thread-panel" aria-label="Weekly outfit calendar"><div className="thread-section-top"><h2>{prettyDay(week)} — {prettyDay(shiftDay(week, 6))}</h2><div className="thread-actions"><button disabled={busy} onClick={() => setWeek(shiftDay(week, -7))}>Previous week</button><button onClick={() => setWeek(monday(today))}>Today</button><button disabled={busy} onClick={() => setWeek(shiftDay(week, 7))}>Next week</button></div></div>
        <div className="thread-week-grid">{Array.from({ length: 7 }, (_, index) => {
          const date = shiftDay(week, index); const entry = entries.find(record => record.date === date);
          return <article key={date} className={`thread-day${date === today ? ' is-today' : ''}`}><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</time>
            {entry ? <><span className="thread-tag">{entry.status}</span><strong>{entry.name}</strong><div className="thread-day-photos">{entry.items.slice(0, 3).map(item => { const piece = wardrobe.find(value => value.id === item.item_id); return piece ? <img key={item.item_id} src={apiImageUrl(piece.image_url)} alt={item.name} /> : null; })}</div>
              {entry.status === 'planned' && date <= today && <button disabled={busy} onClick={() => void save(date, entry.outfit_id, 'worn')}>Mark worn</button>}
              <button disabled={busy} onClick={() => void clear(date)}>Remove entry</button></> : <><p>A fresh start.</p><button onClick={() => { setDay(date); setStatus('planned'); document.querySelector<HTMLSelectElement>('.thread-form-grid select')?.focus(); }}>Plan this day</button></>}
          </article>;
        })}</div>
      </section>
      <section className="thread-panel" aria-label="Wear history"><div className="thread-section-top"><h2>The looks you lived in.</h2><span>{history.length} {history.length === 1 ? 'day' : 'days'} recorded · {wearCounts.size} different {wearCounts.size === 1 ? 'piece' : 'pieces'} worn</span></div>
        {history.length ? <div className="thread-history">{history.map(entry => <article key={entry.id}><time dateTime={entry.date}>{prettyDay(entry.date)}</time><strong>{entry.name}</strong><p>{entry.items.map(item => item.name).join(' · ')}</p><button disabled={busy} onClick={() => void clear(entry.date)}>Remove wear record</button></article>)}</div> : <p className="thread-small-note">Mark a planned outfit as worn, or record a past day above. Planning alone does not count as wearing.</p>}
        {wearCounts.size > 0 && <div className="thread-wear-stats">{[...wearCounts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => <span key={id}>{wardrobe.find(item => item.id === id)?.name ?? 'Removed piece'} <strong>{count} {count === 1 ? 'wear' : 'wears'}</strong></span>)}</div>}
      </section>
    </>}
  </main></AppShell>;
}
