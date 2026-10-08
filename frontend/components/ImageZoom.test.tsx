import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageLightbox, type LightboxItem, ZoomableImageCard } from './ImageZoom';

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const stripMotionProps = (Component: 'div' | 'img') => {
    const MotionElement = ({
      children,
      layoutId: _layoutId,
      transition: _transition,
      whileHover: _whileHover,
      ...props
    }: { children?: React.ReactNode; [key: string]: unknown }) =>
      Component === 'img'
        ? React.createElement('img', props as React.ImgHTMLAttributes<HTMLImageElement>)
        : React.createElement('div', props as React.HTMLAttributes<HTMLDivElement>, children);
    MotionElement.displayName = `MockMotion${Component}`;
    return MotionElement;
  };

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: stripMotionProps('div'),
      img: stripMotionProps('img'),
      article: stripMotionProps('div'),
    },
  };
});

vi.mock('react-zoom-pan-pinch', async () => {
  const React = await import('react');

  const TransformWrapper = ({
    children,
    onInit,
    onTransform,
  }: {
    children: (ref: { setTransform: (x: number, y: number, scale: number, time?: number) => void; state: { scale: number } }) => React.ReactNode;
    onInit?: (ref: unknown) => void;
    onTransform?: (ref: unknown, state: { scale: number }) => void;
  }) => {
    const [scale, setScale] = React.useState(1);
    const state = { scale };
    const instanceRef = React.useRef<{
      state: { scale: number };
      setTransform: (x: number, y: number, nextScale: number) => void;
      zoomToPoint: (nextScale: number) => void;
      resetTransform: () => void;
      fitToView: () => void;
      panBy: ReturnType<typeof vi.fn>;
    } | null>(null);
    if (!instanceRef.current) {
      instanceRef.current = {
        state,
        setTransform: (_x, _y, nextScale) => setScale(nextScale),
        zoomToPoint: (nextScale) => setScale(nextScale),
        resetTransform: () => setScale(1),
        fitToView: () => setScale(1),
        panBy: vi.fn(),
      };
    }
    const ref = instanceRef.current;
    ref.state = state;

    React.useEffect(() => {
      onTransform?.(ref, state);
    }, [scale]);
    React.useEffect(() => {
      onInit?.(ref);
    }, [onInit, ref]);

    return React.createElement(
      'div',
      null,
      children({ setTransform: ref.setTransform, state }),
    );
  };

  const TransformComponent = ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children);

  return { TransformWrapper, TransformComponent };
});

const lightboxItems: LightboxItem[] = [
  {
    src: '/top.webp',
    alt: 'Ivory shirt',
    title: 'Ivory shirt',
    sharedId: 'item-top',
  },
  {
    src: '/bottom.webp',
    alt: 'Plum trousers',
    title: 'Plum trousers',
    sharedId: 'item-bottom',
  },
];

describe('ZoomableImageCard', () => {
  it('opens its image when activated', () => {
    const onOpen = vi.fn();
    render(
      <ZoomableImageCard
        id="item-top"
        image="/top.webp"
        title="Ivory shirt"
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open image: Ivory shirt' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe('ImageLightbox', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('zooms in by 50% and supports reset and fit controls', () => {
    render(<ImageLightbox items={lightboxItems} initialIndex={0} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('200%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('keeps keyboard zoom within the supported range', () => {
    render(<ImageLightbox items={lightboxItems} initialIndex={0} onClose={vi.fn()} />);

    for (let step = 0; step < 12; step += 1) {
      fireEvent.keyDown(window, { key: '+' });
    }
    expect(screen.getByText('500%')).toBeTruthy();

    for (let step = 0; step < 12; step += 1) {
      fireEvent.keyDown(window, { key: '-' });
    }
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('moves between images with arrow keys and closes with Escape', () => {
    const onClose = vi.fn();
    render(<ImageLightbox items={lightboxItems} initialIndex={0} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Plum trousers' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
