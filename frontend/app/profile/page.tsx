'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../providers';
import { useToast } from '../../components/ToastProvider';
import { apiRequest, fetchWardrobe } from '../../lib/api';
import type { CalendarDay, Trip, WardrobePiece } from '../../lib/planning';
type Preferences = { favorite_colors: string[]; preferred_styles: string[]; disliked_colors: string[]; gender_fit_notes: string };
type Totals = { wardrobe: number; outfits: number; favorites: number; worn: number; laundry: number; trips: number };
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => { setDisplayName(user?.display_name ?? ''); setCity(user?.city ?? ''); setBio(user?.bio ?? ''); }, [user]);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadingError('');
    Promise.all([apiRequest<Preferences>('/preferences'), fetchWardrobe<WardrobePiece>(), apiRequest<{ is_favorite: boolean }[]>('/outfits'), apiRequest<CalendarDay[]>('/planning/calendar'), apiRequest<Trip[]>('/planning/trips')]).then(([prefs, wardrobe, outfits, calendar, trips]) => {
      if (!active) return;
      setPreferences(prefs); setTotals({ wardrobe: wardrobe.length, outfits: outfits.length, favorites: outfits.filter(look => look.is_favorite).length, worn: calendar.filter(day => day.status === 'worn').length, laundry: wardrobe.filter(piece => piece.availability === 'laundry').length, trips: trips.length });
    }).catch(cause => { if (active) setLoadingError(cause instanceof Error ? cause.message : 'Could not load your style summary.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  async function perform(action: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(action); setError(''); setNotice('');
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your changes.'); }
    finally { setBusy(''); }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await perform('profile', async () => {
      await apiRequest('/auth/me', { method: 'PATCH', body: JSON.stringify({ display_name: displayName, city, bio }) });
      await refreshUser(); setNotice('Your profile has been saved.'); toast('Your profile has been saved.');
    });
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    if (newPassword !== confirmation) { setError('Your new passwords do not match.'); return; }
    if (newPassword === currentPassword) { setError('Choose a new password different from your current password.'); return; }
    if (new TextEncoder().encode(newPassword).length > 72) { setError('Your password must be no more than 72 UTF-8 bytes.'); return; }
    await perform('password', async () => {
      await apiRequest('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setNotice('Password updated. Your other sessions have been signed out.'); toast('Your password has been updated.');
    });
  }
  async function download() {
    await perform('export', async () => {
      const data = await apiRequest('/auth/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'thread-account-data.json'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your account data download is ready.');
    });
  }
  const stats = [ ['Wardrobe pieces', totals?.wardrobe, '/wardrobe'], ['Saved outfits', totals?.outfits, '/saved-outfits'], ['Favorite looks', totals?.favorites, '/saved-outfits'], ['Days worn', totals?.worn, '/calendar'], ['In laundry', totals?.laundry, '/wardrobe'], ['Trips planned', totals?.trips, '/trips'] ] as const;
  return <AppShell><main className="thread-workspace">
    <header className="thread-page-heading"><p>A wardrobe that feels like you</p><h1>{user?.display_name ? `${user.display_name}’s profile.` : 'Your profile.'}</h1><span>Your details, your style, and the looks you keep coming back to.</span></header>
    {error && <p role="alert" className="thread-error">{error}</p>}{notice && <p role="status" className="thread-success">{notice}</p>}
    <div className="thread-profile-layout">
      <section className="thread-panel" aria-label="Personal details"><div className="thread-profile-identity"><span aria-hidden="true">{(user?.display_name || user?.email || 'T').slice(0, 1).toUpperCase()}</span><div><h2>{user?.display_name || 'Make it yours.'}</h2><p>{user?.email}</p><small>Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'}</small></div></div>
        <form onSubmit={event => void saveProfile(event)}><fieldset className="thread-form-grid thread-single-form" disabled={!!busy}>
          <label>Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} autoComplete="nickname" placeholder="What should we call you?" /></label>
          <label>City<input value={city} onChange={event => setCity(event.target.value)} maxLength={120} autoComplete="address-level2" placeholder="Your home city" /></label>
          <label>About your style<textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={500} rows={4} placeholder="A little about you and the way you dress." /></label>
          <button className="thread-button">{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
        </fieldset></form>
      </section>
      <section className="thread-panel" aria-label="Wardrobe overview"><h2>Your wardrobe, at a glance.</h2>
        {loadingError && <div role="alert" className="thread-error">{loadingError} <button onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {loading ? <p role="status">Loading your wardrobe summary…</p> : <div className="thread-profile-stats">{stats.map(([label, count, href]) => <Link key={label} href={href}><span>{label}</span><strong>{count ?? '—'}</strong></Link>)}</div>}
        <div className="thread-section-top thread-profile-style-heading"><h3>Style DNA.</h3><Link href="/preferences">Edit preferences ↗</Link></div>
        {preferences && <dl className="thread-style-summary">{[['Favorite colors', preferences.favorite_colors], ['Preferred styles', preferences.preferred_styles], ['Disliked colors', preferences.disliked_colors]].map(([label, values]) => <div key={String(label)}><dt>{label}</dt><dd>{(values as string[]).join(' · ') || 'None saved yet'}</dd></div>)}<div><dt>Fit notes</dt><dd>{preferences.gender_fit_notes || 'No fit notes added yet.'}</dd></div></dl>}
      </section>
      <section className="thread-panel" aria-label="Account security"><h2>A fresh password.</h2><p className="thread-small-note">Use at least 8 characters. Changing your password signs out other sessions and keeps this one active.</p>
        <form onSubmit={event => void changePassword(event)}><fieldset className="thread-form-grid thread-single-form" disabled={!!busy}>
          <label>Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="current-password" /></label>
          <label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <label>Confirm new password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <button className="thread-button">{busy === 'password' ? 'Updating…' : 'Change password'}</button>
        </fieldset></form>
      </section>
      <section className="thread-panel" aria-label="Account data"><h2>Your collection, to keep.</h2><p className="thread-small-note">Download your profile, wardrobe details, saved looks, preferences, wear history, and trip lists as a JSON file. Clothing photos are not included.</p><button className="thread-button thread-export-button" disabled={!!busy} onClick={() => void download()}>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button><p className="thread-small-note">Looking for your next look? <Link href="/outfit-planner">Open the outfit planner ↗</Link></p></section>
    </div>
  </main></AppShell>;
}
