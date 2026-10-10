import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { apiRequest, fetchWardrobe } from '../../lib/api';
import OutfitPlannerPage from './page';

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn(), fetchWardrobe: vi.fn(), apiImageUrl: (url: string) => url }));
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../components/ToastProvider', () => ({ useToast: () => () => {} }));
vi.mock('../providers', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../components/ImageZoom', () => ({ ImageLightbox: () => null, ZoomableImageCard: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));

const wardrobe = [
  { id: 'top-a', name: 'Ivory shirt', category: 'top', image_url: '/top-a.jpg', dominant_colors: ['Ivory'], sub_type: null },
  { id: 'top-b', name: 'Rose blouse', category: 'top', image_url: '/top-b.jpg', dominant_colors: ['Pink'], sub_type: null },
  { id: 'bottom', name: 'Trousers', category: 'bottom', image_url: '/bottom.jpg', dominant_colors: ['Black'], sub_type: null },
];
const response = (label = 'Latest look') => ({ recommendations: [{ rank: 1, score: 8, items: [wardrobe[0], wardrobe[2]], reasons: [{ label, score: 8 }] }] });
const api = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchWardrobe).mockResolvedValue(wardrobe);
  api.mockResolvedValue(response());
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Outfit Planner', () => {
  it('ignores an older response even when abort does not stop it', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    const old = new Promise(resolve => { resolveOld = resolve; });
    api.mockImplementation((_path, init) => {
      const body = JSON.parse(String(init?.body));
      return body.occasion === 'formal' ? old : Promise.resolve(response(`${body.occasion} look`));
    });
    render(<OutfitPlannerPage />);
    await screen.findByText('casual look');
    fireEvent.change(screen.getByRole('combobox', { name: 'Occasion' }), { target: { value: 'formal' } });
    await waitFor(() => expect(api.mock.calls.some(([, init]) => JSON.parse(String(init?.body)).occasion === 'formal')).toBe(true));
    const olderSignal = api.mock.calls.at(-1)?.[1]?.signal;
    fireEvent.change(screen.getByRole('combobox', { name: 'Occasion' }), { target: { value: 'gym' } });
    await screen.findByText('gym look');
    expect(olderSignal?.aborted).toBe(true);
    resolveOld(response('Stale formal result'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByText('Stale formal result')).toBeNull();
    expect(screen.getByText('gym look')).toBeTruthy();
  });

  it('does not submit blank or out-of-range temperatures and recovers with valid input', async () => {
    render(<OutfitPlannerPage />);
    await screen.findByText('Latest look');
    for (const invalid of ['', '80', '-31']) {
      const count = api.mock.calls.length;
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Temperature (°C)' }), { target: { value: invalid } });
      expect(screen.getByText('Enter a temperature between −30°C and 60°C.')).toBeTruthy();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(api.mock.calls.length).toBe(count);
      expect(screen.queryByRole('button', { name: 'Customize this look' })).toBeNull();
    }
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Temperature (°C)' }), { target: { value: '22.5' } });
    await screen.findByText('Latest look');
    expect(JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body)).weather.temperature_c).toBe(22.5);
  });

  it('sends the selected starting piece and clears the constraint when requested', async () => {
    render(<OutfitPlannerPage />);
    await screen.findByText('Latest look');
    fireEvent.change(screen.getByRole('combobox', { name: 'Build around this piece' }), { target: { value: 'top-b' } });
    await screen.findByText('Latest look');
    expect(JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body)).required_item_id).toBe('top-b');
    fireEvent.click(screen.getByRole('button', { name: 'Clear piece' }));
    await screen.findByText('Latest look');
    expect(JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body)).required_item_id).toBeUndefined();
  });

  it('previews swapped pieces and saves them with the original outfit occasion', async () => {
    render(<OutfitPlannerPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize this look' }));
    const preview = screen.getByRole('region', { name: 'Live outfit preview' });
    expect(within(preview).getByRole('img', { name: 'Ivory shirt' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'top' }), { target: { value: 'top-b' } });
    expect(within(preview).queryByRole('img', { name: 'Ivory shirt' })).toBeNull();
    expect(within(preview).getByRole('img', { name: 'Rose blouse' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Occasion' }), { target: { value: 'party' } });
    await screen.findByText('Latest look');
    fireEvent.click(screen.getByRole('button', { name: 'Save outfit' }));
    await screen.findByText(/Your look is saved. Find it in Saved Outfits./);
    const savedCall = api.mock.calls.find(([path]) => path === '/outfits');
    const saved = JSON.parse(String(savedCall?.[1]?.body));
    expect(saved.occasion).toBe('casual');
    expect(saved.items.map((item: { item_id: string }) => item.item_id)).toEqual(['top-b', 'bottom']);
  });
});
