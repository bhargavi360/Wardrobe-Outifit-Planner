'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

type ZoomableImageCardProps = {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  tags?: string[];
  accent?: string;
  imageSize?: 'compact' | 'standard';
  onOpen: () => void;
};

export function ZoomableImageCard({
  id,
  image,
  title,
  subtitle,
  tags,
  accent,
  imageSize = 'standard',
  onOpen,
}: ZoomableImageCardProps) {
  const [lensPosition, setLensPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const handleHoverMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setLensPosition({
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
      width: bounds.width,
      height: bounds.height,
    });
  };

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden border border-[var(--thread-hairline)] bg-[var(--thread-surface)]"
    >
      <button
        type="button"
        aria-label={`Open image: ${title}`}
        className="group relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--thread-gold)]"
        onMouseMove={handleHoverMove}
        onMouseLeave={() => setLensPosition(null)}
        onClick={onOpen}
      >
        <motion.img
          layoutId={`wardrobe-image-${id}`}
          src={image}
          alt={title}
          className={`${imageSize === 'compact' ? 'h-28' : 'h-64'} w-full cursor-zoom-in object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.06]`}
          draggable={false}
        />

        {lensPosition ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute hidden h-24 w-24 rounded-full border border-white/90 shadow-[0_14px_32px_rgba(31,23,29,0.28)] md:block"
            style={{
              top: clamp(lensPosition.y - 48, 0, lensPosition.height - 96),
              left: clamp(lensPosition.x - 48, 0, lensPosition.width - 96),
              backgroundImage: `url("${image}")`,
              backgroundSize: `${lensPosition.width * 2.5}px ${lensPosition.height * 2.5}px`,
              backgroundPosition: `${48 - lensPosition.x * 2.5}px ${48 - lensPosition.y * 2.5}px`,
            }}
          />
        ) : null}

        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1e1621]/70 to-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
          <span className="block text-[10px] font-medium uppercase tracking-[0.24em] text-[#f6e7d4]">
            {accent ?? 'Wardrobe'}
          </span>
          <span className="mt-1 block text-lg font-semibold">{title}</span>
          {subtitle ? <span className="block text-sm text-white/80">{subtitle}</span> : null}
        </span>
      </button>

      {tags && tags.length ? (
        <div className="flex flex-wrap gap-2 p-4 pt-3">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={`${id}-${tag}`}
              className="border border-[var(--thread-hairline)] bg-[#19191a] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--thread-gold-soft)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
}

export type LightboxItem = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  sharedId: string;
};

type ImageLightboxProps = {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
};

type TouchStart = {
  x: number;
  y: number;
  time: number;
  moved: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function ImageLightbox({ items, initialIndex, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(MIN_SCALE);
  const zoomRef = useRef<ReactZoomPanPinchRef | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<TouchStart | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const activeItem = items[currentIndex] ?? items[0];
  const isSingle = items.length <= 1;

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex((index + items.length) % items.length);
    setZoomLevel(MIN_SCALE);
  }, [items.length]);

  const setZoomBy = useCallback((delta: number) => {
    const ref = zoomRef.current;
    if (!ref) return;

    const nextScale = clamp(
      Math.round((ref.state.scale + delta) / ZOOM_STEP) * ZOOM_STEP,
      MIN_SCALE,
      MAX_SCALE,
    );
    const bounds = canvasRef.current?.getBoundingClientRect();
    setZoomLevel(nextScale);
    if (bounds) {
      void ref.zoomToPoint(nextScale, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, 180);
    } else {
      void ref.setTransform(0, 0, nextScale, 180);
    }
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(MIN_SCALE);
    void zoomRef.current?.resetTransform(200);
  }, []);

  const fitToScreen = useCallback(() => {
    setZoomLevel(MIN_SCALE);
    void zoomRef.current?.fitToView({
      mode: 'contain',
      minScale: MIN_SCALE,
      maxScale: MIN_SCALE,
      animationTime: 200,
    });
  }, []);

  const togglePointZoom = useCallback((clientX: number, clientY: number) => {
    const ref = zoomRef.current;
    if (!ref) return;

    const nextScale = ref.state.scale > 1.05 ? MIN_SCALE : 2.5;
    setZoomLevel(nextScale);
    if (nextScale === MIN_SCALE) {
      void ref.setTransform(0, 0, MIN_SCALE, 180);
    } else {
      void ref.zoomToPoint(nextScale, clientX, clientY, 180);
    }
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoomBy(ZOOM_STEP);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setZoomBy(-ZOOM_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        resetZoom();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (zoomLevel > 1.05) {
          void zoomRef.current?.panBy(64, 0, 120);
        } else if (!isSingle) {
          goToIndex(currentIndex - 1);
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (zoomLevel > 1.05) {
          void zoomRef.current?.panBy(-64, 0, 120);
        } else if (!isSingle) {
          goToIndex(currentIndex + 1);
        }
      } else if (event.key === 'ArrowUp' && zoomLevel > 1.05) {
        event.preventDefault();
        void zoomRef.current?.panBy(0, 64, 120);
      } else if (event.key === 'ArrowDown' && zoomLevel > 1.05) {
        event.preventDefault();
        void zoomRef.current?.panBy(0, -64, 120);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, goToIndex, isSingle, onClose, resetZoom, setZoomBy, zoomLevel]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      moved: false,
    };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) {
      start.moved = true;
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || event.touches.length > 0) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (zoomLevel <= 1.02 && deltaY > 100 && Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      onClose();
      return;
    }

    if (start.moved) return;
    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (lastTap && now - lastTap.time < 320 && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 28) {
      lastTapRef.current = null;
      togglePointZoom(touch.clientX, touch.clientY);
      return;
    }
    lastTapRef.current = { x: touch.clientX, y: touch.clientY, time: now };
  };

  if (!activeItem) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b0c]/80 p-2 backdrop-blur-xl sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.title ?? 'Image viewer'}
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative flex h-[94dvh] w-full max-w-6xl items-center justify-center overflow-hidden border border-white/15 bg-[#141415]/90 sm:h-[92vh]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(198,169,105,0.08),_transparent_60%)]" />

          {!isSingle ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => goToIndex(currentIndex - 1)}
                className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20 sm:left-5 sm:h-11 sm:w-11"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => goToIndex(currentIndex + 1)}
                className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20 sm:right-5 sm:h-11 sm:w-11"
              >
                ›
              </button>
            </>
          ) : null}

          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1.5 border border-white/15 bg-[#141415]/80 px-2 py-1.5 text-sm text-white backdrop-blur-md sm:top-5 sm:gap-2 sm:px-3 sm:py-2">
            <button type="button" aria-label="Zoom out" onClick={() => setZoomBy(-ZOOM_STEP)} className="h-8 w-8 rounded-full border border-white/10 bg-white/10 hover:bg-white/15">−</button>
            <button type="button" aria-label="Zoom in" onClick={() => setZoomBy(ZOOM_STEP)} className="h-8 w-8 rounded-full border border-white/10 bg-white/10 hover:bg-white/15">＋</button>
            <button type="button" onClick={resetZoom} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 hover:bg-white/15 sm:px-3">Reset</button>
            <button type="button" onClick={fitToScreen} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 hover:bg-white/15 sm:px-3">Fit</button>
            <span aria-live="polite" className="min-w-[48px] text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#f7eadb]">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          <div
            ref={canvasRef}
            className="relative h-full w-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartRef.current = null;
            }}
          >
            <TransformWrapper
              key={activeItem.sharedId}
              initialScale={MIN_SCALE}
              minScale={MIN_SCALE}
              maxScale={MAX_SCALE}
              centerOnInit
              wheel={{ step: ZOOM_STEP }}
              pinch={{ step: ZOOM_STEP, allowPanning: true }}
              panning={{ velocityDisabled: false }}
              velocityAnimation={{ inertia: 0.25, animationTime: 400 }}
              doubleClick={{ disabled: true }}
              onTransform={(_ref, state) => setZoomLevel(Number(state.scale.toFixed(2)))}
              onInit={(ref) => {
                zoomRef.current = ref;
              }}
            >
              {({ setTransform, state }) => (
                <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
                  <motion.img
                    key={activeItem.sharedId}
                    layoutId={`wardrobe-image-${activeItem.sharedId}`}
                    src={activeItem.src}
                    alt={activeItem.alt}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      const nextScale = state.scale > 2.4 ? MIN_SCALE : 2.5;
                      setZoomLevel(nextScale);
                      if (nextScale === MIN_SCALE) {
                        void setTransform(0, 0, MIN_SCALE, 180);
                      } else {
                        void zoomRef.current?.zoomToPoint(nextScale, event.clientX, event.clientY, 180);
                      }
                    }}
                    className="max-h-[82dvh] max-w-full select-none object-contain"
                    draggable={false}
                  />
                </TransformComponent>
              )}
            </TransformWrapper>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[70%] border border-white/10 bg-[#141415]/80 px-4 py-3 text-white backdrop-blur-md sm:bottom-6 sm:left-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#f7d8b0]">Detail view</p>
            <p className="mt-1 text-lg font-semibold sm:mt-2 sm:text-xl">{activeItem.title ?? 'Wardrobe item'}</p>
            {activeItem.subtitle ? <p className="mt-1 text-sm text-white/75">{activeItem.subtitle}</p> : null}
          </div>

          <button
            type="button"
            aria-label="Close image viewer"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center border border-white/15 bg-[#141415]/80 text-lg text-white backdrop-blur-md transition hover:border-[var(--thread-gold)] sm:right-5 sm:top-5"
          >
            ×
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
