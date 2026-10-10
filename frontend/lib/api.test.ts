import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000/api/');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('wardrobe image URLs', () => {
  it('defaults to the frontend proxy for requests and private images', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetch);
    const { API_URL, apiImageUrl, apiRequest } = await import('./api');
    expect(API_URL).toBe('/api');
    expect(apiImageUrl('/api/wardrobe/item/image')).toBe('/api/wardrobe/item/image');
    await apiRequest('/health');
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'include' }));
  });
  it('uses the backend origin for protected images when the API is on another port', async () => {
    const { apiImageUrl } = await import('./api');
    expect(apiImageUrl('/api/wardrobe/item/image')).toBe(
      'http://localhost:8000/api/wardrobe/item/image',
    );
    expect(apiImageUrl('wardrobe/item/image')).toBe(
      'http://localhost:8000/api/wardrobe/item/image',
    );
  });

  it('supports the same-origin /api proxy without constructing an invalid URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '/api');
    const { apiImageUrl } = await import('./api');
    expect(apiImageUrl('/api/wardrobe/item/image')).toBe('/api/wardrobe/item/image');
    expect(apiImageUrl('wardrobe/item/image')).toBe('/api/wardrobe/item/image');
  });

  it.each(['http://localhost:8000/api', '/api'])('preserves external image URLs with %s', async (base) => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', base);
    const { apiImageUrl } = await import('./api');
    expect(apiImageUrl('https://images.unsplash.com/photo-example')).toBe(
      'https://images.unsplash.com/photo-example',
    );
  });
});

describe('backend connection errors', () => {
  it.each([500, 502, 504])('explains how to recover from a non-JSON proxy failure (%s)', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    const { apiRequest } = await import('./api');
    await expect(apiRequest('/auth/login')).rejects.toThrow('Start the backend and MongoDB');
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('wardrobe pagination', () => {
  it('loads items beyond the first 100 with the authenticated session', async () => {
    const firstPage = Array.from({ length: 100 }, (_, id) => ({ id }));
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse([{ id: 100 }]));
    vi.stubGlobal('fetch', fetch);
    const { fetchWardrobe } = await import('./api');

    const items = await fetchWardrobe<{ id: number }>();
    expect(items).toHaveLength(101);
    expect(items[100].id).toBe(100);
    expect(fetch).toHaveBeenNthCalledWith(1,
      'http://localhost:8000/api/wardrobe?skip=0&limit=100',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2,
      'http://localhost:8000/api/wardrobe?skip=100&limit=100',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops at an empty page when the wardrobe contains exactly 100 items', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(Array.from({ length: 100 }, (_, id) => ({ id }))))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetch);
    const { fetchWardrobe } = await import('./api');
    expect(await fetchWardrobe()).toHaveLength(100);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns an empty wardrobe after one request', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetch);
    const { fetchWardrobe } = await import('./api');
    expect(await fetchWardrobe()).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a failed later page instead of presenting an incomplete wardrobe', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(Array.from({ length: 100 }, (_, id) => ({ id }))))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Wardrobe unavailable.' }, 503));
    vi.stubGlobal('fetch', fetch);
    const { fetchWardrobe } = await import('./api');
    await expect(fetchWardrobe()).rejects.toThrow('Wardrobe unavailable.');
  });
});
