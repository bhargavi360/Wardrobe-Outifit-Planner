'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import Lenis from 'lenis';

const revealTransition = {
  duration: 1.15,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function LandingExperience() {
  const reduceMotion = useReducedMotion();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;

    const lenis = new Lenis({
      autoRaf: true,
      anchors: true,
      lerp: 0.08,
      smoothWheel: true,
    });

    return () => lenis.destroy();
  }, [reduceMotion]);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <main className="landing-page">
      <div className="landing-grain" aria-hidden="true" />
      <div className="landing-announcement">
        <p>Private beta <span aria-hidden="true">·</span> By invitation only</p>
      </div>

      <header className={`landing-nav${isScrolled ? ' landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link className="thread-wordmark" href="/" aria-label="Thread. Home">
            Thread<span>.</span>
          </Link>

          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#method">Method</a>
            <a href="#todays-edit">Today&apos;s Edit</a>
            <Link href="/profile">Profile</Link>
          </nav>

          <Link className="landing-signin" href="/login">
            Sign in
            <span aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <Reveal reduceMotion={reduceMotion} delay={0}>
              <Eyebrow>01 / The Digital Wardrobe</Eyebrow>
            </Reveal>
            <Reveal reduceMotion={reduceMotion} delay={0.15}>
              <h1 id="landing-title">
                Your wardrobe,
                <br />
                <GoldText>in focus.</GoldText>
              </h1>
            </Reveal>
            <Reveal reduceMotion={reduceMotion} delay={0.3}>
              <p className="landing-hero-description">
                A considered wardrobe, shaped around what you own and how you want to feel.
              </p>
            </Reveal>
            <Reveal reduceMotion={reduceMotion} delay={0.45}>
              <Link className="landing-begin" href="/register">
                Begin <span aria-hidden="true">↗</span>
              </Link>
            </Reveal>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-hero-glow" aria-hidden="true" />
            <motion.figure
              className="landing-look-frame"
              animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
              whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
              transition={reduceMotion ? undefined : { duration: 9, ease: 'easeInOut', repeat: Infinity }}
            >
              <div className="landing-look-image">
                <Image
                  src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
                  alt="Thread look 03: an expressive street-style outfit layered for an evening out."
                  fill
                  priority
                  sizes="(max-width: 767px) 82vw, (max-width: 1199px) 42vw, 490px"
                  className="landing-look-photo"
                />
                <div className="landing-look-inset" aria-hidden="true" />
                <figcaption className="landing-look-caption">
                  <span>Look 03</span>
                  <span>Street <i aria-hidden="true">·</i> 14°C</span>
                </figcaption>
              </div>
            </motion.figure>
          </div>
        </div>
        <span className="landing-hero-index" aria-hidden="true">T / 001</span>
      </section>

    </main>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="landing-eyebrow">{children}</p>;
}

export function GoldText({ children }: { children: ReactNode }) {
  return <span className="landing-gold-text">{children}</span>;
}

export function Reveal({
  children,
  delay = 0,
  reduceMotion = false,
}: {
  children: ReactNode;
  delay?: number;
  reduceMotion?: boolean | null;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? undefined : { ...revealTransition, delay }}
    >
      {children}
    </motion.div>
  );
}
