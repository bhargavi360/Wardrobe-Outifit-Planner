'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { AppShell } from '../../components/AppShell';

const lookbookLooks = [
  {
    image: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=1500&q=85',
    alt: 'A woman in a tailored dark suit on a city street.',
    index: '01',
    category: 'MODERN TAILORING',
    title: 'Made to move.',
    description: 'Clean lines and confident proportions for wherever the day leads.',
  },
  {
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1500&q=85',
    alt: 'An expressive street-style look captured in the city.',
    index: '02',
    category: 'THE DAILY EDIT',
    title: 'Ease, composed.',
    description: 'Everyday pieces, brought together with a point of view.',
  },
  {
    image: 'https://images.unsplash.com/photo-1693898671326-f7252fde3f0d?auto=format&fit=crop&w=1500&q=85',
    alt: 'A tailored black jacket and white shirt against a city backdrop.',
    index: '03',
    category: 'CITY UNIFORM',
    title: 'Quiet confidence.',
    description: 'Thoughtful layers for the hours between day and evening.',
  },
  {
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1500&q=85',
    alt: 'A model in a floral summer dress against a bright coastal backdrop.',
    index: '04',
    category: 'THE COASTAL EDIT',
    title: 'Somewhere in the sun.',
    description: 'A light floral look carries the ease of a day by the sea.',
  },
] as const;

const luxuryLooks = [
  {
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1100&q=85',
    alt: 'A bold contemporary fashion look styled against a bright sky.',
    title: 'A fearless point of view.',
    description: 'Let one expressive piece bring a fresh point of view to your wardrobe.',
    note: '01 / THE EDIT',
  },
  {
    image: 'https://images.unsplash.com/photo-1789899097931-a7d3ba0b113a?auto=format&fit=crop&w=1100&q=85',
    alt: 'A woman in a relaxed tailored look walking along a European city street.',
    title: 'Elegance in motion.',
    description: 'A confident silhouette can make every city street feel like a runway.',
    note: '02 / THE DETAILS',
  },
  {
    image: 'https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1100&q=85',
    alt: 'A quiet, curated capsule wardrobe in neutral tones.',
    title: 'Considered, always.',
    description: 'Build a wardrobe around quality, character, and the details you love.',
    note: '03 / YOUR SIGNATURE',
  },
  {
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1100&q=85',
    alt: 'A woman wearing a breezy white top and striped trousers in a bright summer look.',
    title: 'Summer, unhurried.',
    description: 'Airy layers and easy silhouettes that let sunny days feel effortless.',
    note: '04 / SUMMER EDIT',
  },
  {
    image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1100&q=85',
    alt: 'A tailored coat layered for a cool winter day.',
    title: 'Warmth, with purpose.',
    description: 'Thoughtful coats and soft layers make cold-weather dressing feel composed.',
    note: '05 / WINTER EDIT',
  },
  {
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1100&q=85',
    alt: 'A fresh, softly layered look for a spring day.',
    title: 'A softer beginning.',
    description: 'Welcome the new season with lighter layers and a little more color.',
    note: '06 / SPRING EDIT',
  },
] as const;

export default function DashboardDetailsPage() {
  const reduceMotion = useReducedMotion();
  const afterglowRef = useRef<HTMLElement>(null);
  const isAfterglowInView = useInView(afterglowRef, { amount: 0.25 });

  return (
    <AppShell>
      <main className="dashboard-main">
        <section className="dashboard-editorial" aria-labelledby="dashboard-editorial-title">
          <Image
            src="https://images.unsplash.com/photo-1693898671326-f7252fde3f0d?auto=format&fit=crop&w=1400&q=85"
            alt="Tailored black jacket and white shirt styled against an evening city backdrop."
            fill
            priority
            sizes="100vw"
            className="dashboard-editorial-image"
          />
          <div className="dashboard-editorial-content">
            <h2 id="dashboard-editorial-title" className="dashboard-editorial-title">
              <span>A quieter kind of</span>
              <span className="dashboard-editorial-title-accent">statement.</span>
            </h2>
            <p>Thoughtful layers. Confident lines. Looks shaped around what is already yours.</p>
            <Link className="editorial-highlight-link" href="/wardrobe" aria-label="Explore your wardrobe">
              Explore your wardrobe <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>

        <section className="dashboard-lookbook" id="dashboard-edit" aria-labelledby="dashboard-lookbook-title">
          <div className="dashboard-lookbook-heading">
            <div>
              <h2 id="dashboard-lookbook-title">Looks to linger over.</h2>
            </div>
          </div>

          <div className="dashboard-lookbook-list">
            {lookbookLooks.map((look, index) => (
              <motion.figure
                key={look.index}
                className="dashboard-lookbook-card"
                initial={reduceMotion ? false : { opacity: 0.65 }}
                whileInView={reduceMotion ? undefined : { opacity: 1 }}
                viewport={{ once: true, amount: 0.22 }}
                transition={reduceMotion ? undefined : { duration: 1, ease: [0.22, 1, 0.36, 1] }}
              >
                <figcaption>
                  <span className="dashboard-lookbook-caption-index">{look.index} / {look.category}</span>
                  <strong>{look.title}</strong>
                  {look.index === '03' || look.index === '04' ? (
                    <p className="dashboard-lookbook-description">{look.description}</p>
                  ) : null}
                </figcaption>
                <div className="dashboard-lookbook-photo">
                  <Image
                    src={look.image}
                    alt={look.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 68vw"
                  />
                </div>
              </motion.figure>
            ))}
          </div>

          <section className="planner-daily-editorial" aria-labelledby="dashboard-daily-title">
            <Image
              src="https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=1600&q=85"
              alt="A polished dark tailored look for daily outfit inspiration."
              fill
              sizes="(max-width: 767px) 100vw, 1400px"
              className="planner-daily-editorial-image"
            />
            <div className="planner-daily-editorial-copy">
              <p className="planner-editorial-kicker">YOUR DAILY EDIT <span>·</span> THREAD</p>
              <h2 id="dashboard-daily-title">Today, <em>well dressed.</em></h2>
              <p>A considered look, composed from your wardrobe.</p>
              <Link className="editorial-highlight-link" href="/outfit-planner">
                Plan today’s outfit <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <span className="planner-daily-editorial-note">A STUDY IN MODERN TAILORING</span>
          </section>

          <section className="dashboard-next-editorial" aria-labelledby="dashboard-next-title">
            <div className="dashboard-next-editorial-photo">
              <Image
                src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1800&q=85"
                alt="A confident street-style look in a softly lit city."
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="dashboard-next-editorial-image"
              />
            </div>
            <div className="dashboard-next-editorial-copy">
              <p className="planner-editorial-kicker">STYLE, YOUR WAY <span>·</span> THREAD</p>
              <h2 id="dashboard-next-title">Make room for <em>yourself.</em></h2>
              <p>Personal style is never standing still. Keep what feels like you, and let the rest evolve.</p>
              <Link className="dashboard-next-editorial-link editorial-highlight-link" href="/saved-outfits">
                Saved outfits <span aria-hidden="true">↗</span>
              </Link>
              <span className="dashboard-next-editorial-note">A MOMENT, ALL YOUR OWN</span>
            </div>
          </section>

          <section className="dashboard-luxury" aria-labelledby="dashboard-luxury-title">
            <div className="dashboard-luxury-heading">
              <p className="planner-editorial-kicker">A CLOSER LOOK <span>·</span> THREAD</p>
              <h2 id="dashboard-luxury-title">The details make the <span>feeling</span>.</h2>
              <p>Thoughtful choices. Beautifully worn. A little inspiration for what comes next.</p>
            </div>
            <div className="dashboard-luxury-viewport" role="region" aria-label="Seasonal outfit looks">
              <div className="dashboard-luxury-track">
                {[false, true].map((isClone) => (
                  <div
                    key={isClone ? 'duplicate' : 'original'}
                    className="dashboard-luxury-group"
                    aria-hidden={isClone || undefined}
                  >
                    {luxuryLooks.map((look) => (
                      <figure className="dashboard-luxury-card" key={look.note}>
                        <div className="dashboard-luxury-photo">
                          <Image
                            src={look.image}
                            alt={isClone ? '' : look.alt}
                            fill
                            sizes="(max-width: 767px) 84vw, (max-width: 1100px) 44vw, 31vw"
                          />
                        </div>
                        <figcaption>
                          <span>{look.note}</span>
                          <h3>{look.title}</h3>
                          <p>{look.description}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section
            className="dashboard-afterglow"
            aria-labelledby="dashboard-afterglow-title"
            ref={afterglowRef}
          >
            <motion.div
              className="dashboard-afterglow-photo"
              initial={false}
              animate={{ scale: reduceMotion ? 1.08 : isAfterglowInView ? 1.2 : 1.02 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            >
              <Image
                src="https://images.unsplash.com/photo-1510084294146-114631c6d1ae?auto=format&fit=crop&w=2400&q=90"
                alt=""
                fill
                sizes="100vw"
              />
            </motion.div>
            <div className="dashboard-afterglow-copy">
              <p className="planner-editorial-kicker">A WARDROBE, MORE YOU <span>·</span> THREAD</p>
              <h2 id="dashboard-afterglow-title">Wear what feels like <em>you.</em></h2>
            </div>
          </section>
          <section className="dashboard-fashion-section" aria-labelledby="dashboard-fashion-title">
            <div className="dashboard-fashion-card">
              <p className="dashboard-fashion-kicker">A NOTE ON PERSONAL STYLE</p>
              <div>
                <h2 id="dashboard-fashion-title">Fashion Glimpse</h2>
                <p>
                  Your best looks start with the pieces you already love. Bring them together,
                  try a new combination, and make it your own.
                </p>
              </div>
              <Link className="editorial-highlight-link" href="/outfit-planner">
                Find your next look <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </section>
        </section>
      </main>
    </AppShell>
  );
}
