import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { apiRequest, fetchWardrobe } from '../../lib/api';
import TripsPage from './page';

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn(), fetchWardrobe: vi.fn(), apiImageUrl: (url: string) => url }));
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../components/ToastProvider', () => ({ useToast: () => () => {} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('updates a packed checkbox immediately and restores it if saving fails', async () => {
  const trip = { id: 'trip', name: 'Weekend', destination: 'City', start_date: '2026-10-10', end_date: '2026-10-11', outfit_ids: ['look'], outfit_names: ['Saved look'], packed_item_ids: [], items: [{ item_id: 'shirt', name: 'Ivory shirt', category: 'top', outfit_names: ['Saved look'] }] };
  let rejectSave: (reason: Error) => void = () => {};
  const pending = new Promise((_resolve, reject) => { rejectSave = reject; });
  vi.mocked(fetchWardrobe).mockResolvedValue([{ id: 'shirt', name: 'Ivory shirt', image_url: '/shirt.jpg', category: 'top' }]);
  vi.mocked(apiRequest).mockImplementation((path, init) => {
    if (init?.method === 'PATCH') return pending;
    return Promise.resolve(path === '/planning/trips' ? [trip] : [{ id: 'look', name: 'Saved look', occasion: 'casual', items: [{ item_id: 'shirt' }] }]);
  });
  render(<TripsPage />);
  const checkbox = await screen.findByRole('checkbox', { name: /Ivory shirt/ });
  fireEvent.click(checkbox);
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  await act(async () => rejectSave(new Error('Your data is temporarily unavailable.')));
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole('alert').textContent).toContain('temporarily unavailable');
});
