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
        <p>A little less searching <span aria-hidden="true">·</span> A little more you</p>
      </div>

      <header className={`landing-nav${isScrolled ? ' landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link className="thread-wordmark" href="/" aria-label="Thread. Home">
            Thread<span>.</span>
          </Link>

          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#method">Method</a>
            <a href="#todays-edit">Today&apos;s Edit</a>
            <Link href="/wardrobe">Your wardrobe</Link>
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
                Rediscover what you own. Bring your favorite pieces together.
                Make getting dressed the best part of your morning.
              </p>
            </Reveal>
            <Reveal reduceMotion={reduceMotion} delay={0.45}>
              <div className="landing-hero-actions">
                <Link className="landing-primary" href="/register">
                  Create your wardrobe <span aria-hidden="true">↗</span>
                </Link>
                <a className="landing-secondary" href="#method">Explore the method <span aria-hidden="true">↓</span></a>
              </div>
              <p className="landing-hero-note">YOUR CLOTHES. A FRESH PERSPECTIVE.</p>
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
                  src="/images/thread-luxury-editorial.png"
                  alt="An ivory suit styled in a warm, luxurious dressing room."
                  fill
                  priority
                  sizes="(max-width: 767px) 90vw, (max-width: 1199px) 44vw, 520px"
                  className="landing-look-photo"
                />
                <div className="landing-look-inset" aria-hidden="true" />
                <figcaption className="landing-look-caption">
                  <span>The considered edit</span>
                  <span>Ivory <i aria-hidden="true">·</i> Tailoring</span>
                </figcaption>
              </div>
            </motion.figure>
            <div className="landing-photo-note"><span aria-hidden="true">✦</span><div>A new way to see<br /><strong>what is already yours.</strong></div></div>
          </div>
        </div>
        <span className="landing-hero-index" aria-hidden="true">T / 001</span>
      </section>
      <section id="method" className="landing-method landing-section" aria-labelledby="method-title">
        <Reveal reduceMotion={reduceMotion}>
          <div className="landing-section-heading">
            <div><Eyebrow>02 / The Method</Eyebrow><h2 id="method-title">Less guesswork.<br /><em>More possibility.</em></h2></div>
            <p>A simple ritual for a wardrobe that works for you. Start with what you have, then find new ways to wear it.</p>
          </div>
        </Reveal>
        <div className="landing-method-grid">
          {[
            { number: '01', title: 'Collect your pieces.', text: 'Upload your clothing photos. Organize by color, season, and occasion so everything has its place.' },
            { number: '02', title: 'Find your combinations.', text: 'Choose your occasion and weather. Discover outfit ideas shaped around your wardrobe and preferences.' },
            { number: '03', title: 'Keep the good ones.', text: 'Save the looks you love. Return to your favorites and make everyday dressing a little easier.' },
          ].map((step, index) => (
            <Reveal key={step.number} reduceMotion={reduceMotion} delay={index * 0.1}>
              <article className="landing-method-step"><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>
            </Reveal>
          ))}
        </div>
      </section>
      <section id="todays-edit" className="landing-edit" aria-labelledby="edit-title">
        <div className="landing-edit-inner landing-section">
          <Reveal reduceMotion={reduceMotion}>
            <div className="landing-edit-copy">
              <Eyebrow>03 / Today&apos;s Edit</Eyebrow>
              <h2 id="edit-title">An everyday look.<br /><em>Entirely your own.</em></h2>
              <p>A soft neutral. A little contrast. One favorite layer. Sometimes a fresh outfit starts with a different way of seeing familiar pieces.</p>
              <p className="landing-edit-disclaimer">STYLE INSPIRATION / BUILD YOUR OWN IN THE PLANNER</p>
              <Link className="landing-begin" href="/outfit-planner">Find your next look <span aria-hidden="true">↗</span></Link>
            </div>
          </Reveal>
          <Reveal reduceMotion={reduceMotion} delay={0.15}>
            <div className="landing-capsule">
              <div className="landing-capsule-top"><span>THE NEUTRAL STUDY</span><span>01—03</span></div>
              <div className="landing-capsule-pieces">
                <div><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M40 18 23 27 6 63l23 12 7-20-2 89h52l-2-89 7 20 23-12-17-36-17-9-20 10Z" fill="#e5d7be" stroke="#b6a180" strokeWidth="1.5"/><path d="m40 18 20 28 20-28M60 46v98M45 100h-9m48 0h-9" fill="none" stroke="#b6a180" strokeWidth="1.5"/></svg><span>01 / THE LAYER</span><strong>Ivory tailoring</strong></div>
                <div><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M33 16h54l10 128H66L60 65l-6 79H23Z" fill="#47413b" stroke="#302c27" strokeWidth="1.5"/><path d="M33 24h54M60 24v41M36 24l-2 18m50-18 2 18" fill="none" stroke="#75695b" strokeWidth="1.5"/></svg><span>02 / THE FOUNDATION</span><strong>Charcoal trousers</strong></div>
                <div><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M18 84 43 72l18-28 17 8-5 35 29 16 7 15H15Z" fill="#9a704b" stroke="#6b4a30" strokeWidth="1.5"/><path d="M15 118h94v9H15Zm4-34 24 17h39M62 52l13 5" fill="none" stroke="#6b4a30" strokeWidth="2"/></svg><span>03 / THE FINISH</span><strong>Warm leather</strong></div>
              </div>
              <div className="landing-capsule-bottom"><span className="landing-swatch" /><span>Ivory · Charcoal · Cognac</span><span>Considered, together.</span></div>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="landing-closing landing-section">
        <Reveal reduceMotion={reduceMotion}><Eyebrow>A WARDROBE WITH YOUR NAME ON IT</Eyebrow><h2>Your next favorite outfit<br /><em>might already be yours.</em></h2><Link className="landing-primary" href="/register">Make room for possibility <span aria-hidden="true">↗</span></Link></Reveal>
      </section>
      <footer className="landing-footer landing-section">
        <Link className="thread-wordmark" href="/" aria-label="Thread home">Thread<span>.</span></Link>
        <p>Considered style, every day.</p>
        <div><Link href="/login">Sign in</Link><Link href="/register">Join Thread</Link><span>© 2026 Thread</span></div>
      </footer>
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
      initial={false}
      whileInView={reduceMotion ? undefined : { opacity: [0, 1], y: [28, 0] }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? undefined : { ...revealTransition, delay }}
    >
      {children}
    </motion.div>
  );
}
