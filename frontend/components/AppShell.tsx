'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../app/providers';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/wardrobe', label: 'Wardrobe' },
  { href: '/outfit-planner', label: 'Outfit Planner' },
  { href: '/saved-outfits', label: 'Saved Outfits' },
  { href: '/profile', label: 'Profile' },
] as const;

const editorialBanners: Record<string, { image: string; alt: string; title: string }> = {
  '/wardrobe': {
    image: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1600&q=85',
    alt: 'A carefully arranged selection of wardrobe pieces.',
    title: 'Pieces with presence.',
  },
  '/saved-outfits': {
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1600&q=85',
    alt: 'A considered street-style look captured in the city.',
    title: 'The art of repeat dressing.',
  },
  '/profile': {
    image: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=1600&q=85',
    alt: 'A tailored dark suit styled for the city.',
    title: 'Your style, in focus.',
  },
  '/preferences': {
    image: 'https://images.unsplash.com/photo-1518717283029-d622d998185a?auto=format&fit=crop&w=1600&q=85',
    alt: 'An elegant street-style outfit in a city setting.',
    title: 'A palette of your own.',
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const editorialBanner = editorialBanners[pathname];

  return (
    <div className={`app-shell min-h-screen bg-slate-100 text-slate-900${pathname === '/dashboard' ? ' app-shell-dashboard' : ''}`}>
      <div className="app-shell-inner mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="app-header sticky top-0 z-30 mb-6 border border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="app-header-inner flex flex-col gap-4 lg:flex-row lg:items-center">
            <Link
              href="/dashboard"
              className={`app-brand text-2xl font-semibold tracking-tight text-slate-900${pathname === '/dashboard' ? ' app-brand-dashboard' : ''}`}
            >
              Thread<span className="text-thread-gold">.</span>
            </Link>

            <nav aria-label="Account navigation" className="app-nav flex flex-1 flex-wrap items-center gap-2 overflow-x-auto">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    aria-current={active ? 'page' : undefined}
                    href={item.href}
                    className={`app-nav-link px-3 py-2 text-sm font-medium transition ${active ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3 lg:justify-end">
              <Link
                href="/profile"
                className="app-member hidden border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 sm:block"
              >
                You
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="app-signout border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {editorialBanner ? (
          <section
            className={`app-editorial-banner${pathname === '/wardrobe' ? ' app-editorial-banner-wardrobe' : ''}`}
            aria-label={editorialBanner.title}
          >
            <Image
              src={editorialBanner.image}
              alt={editorialBanner.alt}
              fill
              sizes="(max-width: 767px) 100vw, 1400px"
              className="app-editorial-banner-image"
            />
            <div className="app-editorial-banner-copy">
              <span>THREAD / STYLE NOTES</span>
              <h1>{editorialBanner.title}</h1>
            </div>
          </section>
        ) : null}

        {children}
        <footer className="app-footer">
          <div className="app-footer-links">
            <div>
              <span className="app-footer-heading">Explore</span>
              <Link href="/dashboard#dashboard-edit">The edit</Link>
              <Link href="/outfit-planner">Outfit planner</Link>
              <Link href="/wardrobe">Wardrobe</Link>
            </div>
            <div>
              <span className="app-footer-heading">Your account</span>
              <Link href="/profile">Profile</Link>
              <Link href="/preferences">Preferences</Link>
              <Link href="/saved-outfits">Saved outfits</Link>
            </div>
            <div>
              <span className="app-footer-heading">Thread</span>
              <Link href="/">About Thread</Link>
              <a href="mailto:kandulabhargavi36@gmail.com">Reach out: kandulabhargavi36@gmail.com</a>
            </div>
          </div>
          <Link href="/dashboard" className="app-footer-wordmark" aria-label="Thread. Back to dashboard">
            Thread<span>.</span>
          </Link>
          <div className="app-footer-bottom">
            <span>Thread</span>
            <span>© 2026 Thread</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
