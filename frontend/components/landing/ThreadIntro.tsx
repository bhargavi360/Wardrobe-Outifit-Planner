'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

const letters = [...'Thread.'];

export function ThreadIntro() {
  const router = useRouter();
  const [phase, setPhase] = useState<'writing' | 'leaving' | 'done'>('writing');
  const [ready, setReady] = useState(false);
  const finished = phase === 'done';

  useEffect(() => {
    router.prefetch('/register');
  }, [router]);

  useEffect(() => {
    if (finished) router.replace('/register');
  }, [finished, router]);

  useEffect(() => {
    setReady(true);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const honorPreference = () => {
      if (preference.matches) setPhase('done');
    };
    honorPreference();
    preference.addEventListener('change', honorPreference);
    return () => preference.removeEventListener('change', honorPreference);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const skipWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPhase('done');
      }
    };
    window.addEventListener('keydown', skipWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', skipWithEscape);
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') return;
    // Continue to registration even if the browser cancels an animation.
    const fallback = window.setTimeout(() => setPhase('done'), phase === 'writing' ? 3500 : 1000);
    return () => window.clearTimeout(fallback);
  }, [phase]);

  return (
    <main
      className={`thread-intro${phase !== 'writing' ? ' is-leaving' : ''}`}
      aria-label="Welcome to Thread"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'thread-intro-exit') setPhase('done');
      }}
    >
      <p className="thread-intro-wordmark" aria-label="Thread.">
        {letters.map((letter, index) => (
          <span
            key={index}
            aria-hidden="true"
            style={{ '--letter-index': index } as CSSProperties}
            onAnimationEnd={(event) => {
              if (index === letters.length - 1 && event.animationName === 'thread-intro-write') {
                setPhase(current => current === 'writing' ? 'leaving' : current);
              }
            }}
          >{letter}</span>
        ))}
      </p>
      <button className="thread-intro-skip" type="button" disabled={!ready || finished} onClick={() => {
        setPhase('done');
      }}>Skip intro <span aria-hidden="true">↗</span></button>
    </main>
  );
}
