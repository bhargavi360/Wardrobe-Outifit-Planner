import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { apiRequest, fetchWardrobe } from '../../lib/api';
import ProfilePage from './page';
const mocks = vi.hoisted(() => ({ refreshUser: vi.fn(), user: { id: 'user', email: 'qa@example.com', display_name: 'Bhargavi', city: 'Hyderabad', bio: 'Soft colors', created_at: '2026-10-10' } }));
vi.mock('../../lib/api', () => ({ apiRequest: vi.fn(), fetchWardrobe: vi.fn() }));
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../components/ToastProvider', () => ({ useToast: () => () => {} }));
vi.mock('../providers', () => ({ useAuth: () => ({ user: mocks.user, refreshUser: mocks.refreshUser }) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.refreshUser.mockResolvedValue({});
  vi.mocked(fetchWardrobe).mockResolvedValue([{ availability: 'laundry' }]);
  vi.mocked(apiRequest).mockImplementation((path, init) => {
    if (init?.method) return Promise.resolve(undefined);
    if (path === '/preferences') return Promise.resolve({ favorite_colors: ['ivory'], preferred_styles: [], disliked_colors: [], gender_fit_notes: '' });
    return Promise.resolve([]);
  });
});
afterEach(cleanup);
it('saves editable profile fields and refreshes the shared account details', async () => {
  render(<ProfilePage />);
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(mocks.refreshUser).toHaveBeenCalled());
  expect(apiRequest).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ display_name: 'New name', city: 'Hyderabad', bio: 'Soft colors' }) }));
});
it('rejects mismatched new passwords without calling the password endpoint', async () => {
  render(<ProfilePage />);
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Oldpass123' } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Newpass123' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Different123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  await screen.findByText('Your new passwords do not match.');
  expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path === '/auth/password')).toBe(false);
});
