import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { WeatherPicker } from './WeatherPicker';

vi.mock('../lib/api', () => ({ apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const cities = [{ id: 1, name: 'Hyderabad, India', latitude: 17.3, longitude: 78.4 }];

describe('automatic weather', () => {
  it('applies weather only after choosing a city and requesting it', async () => {
    const apply = vi.fn();
    const weather = { temperature_c: 28.5, condition: 'sunny', observed_at: '2026-10-10T19:30', timezone: 'Asia/Kolkata' };
    vi.mocked(apiRequest).mockResolvedValueOnce(cities).mockResolvedValueOnce(weather);
    render(<WeatherPicker onApply={apply} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'City' }), { target: { value: 'Hyderabad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find city' }));
    await screen.findByRole('combobox', { name: 'Choose location' });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use live weather' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(weather));
    expect(screen.getByRole('status').textContent).toContain('Hyderabad');
  });
  it('keeps manual settings unchanged if the weather service is unavailable', async () => {
    const apply = vi.fn();
    vi.mocked(apiRequest).mockResolvedValueOnce(cities).mockRejectedValueOnce(new Error('Enter temperature and conditions manually.'));
    render(<WeatherPicker onApply={apply} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'City' }), { target: { value: 'Hyderabad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find city' }));
    await screen.findByRole('combobox', { name: 'Choose location' });
    fireEvent.click(screen.getByRole('button', { name: 'Use live weather' }));
    await screen.findByRole('alert');
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Use live weather' }).hasAttribute('disabled')).toBe(false);
  });
});
