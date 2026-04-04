import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/csrf', () => ({
  getCsrfToken: () => 'mock-csrf-token',
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(status: number, data: unknown, ok?: boolean) {
  return {
    status,
    ok: ok ?? (status >= 200 && status < 300),
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  }
}

describe('backend API', () => {
  let locationHref = ''

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch.mockReset()
    locationHref = ''
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window.location, 'href', {
      get: () => locationHref,
      set: (v: string) => { locationHref = v },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getConnection', () => {
    it('returns connection data on 200', async () => {
      const { getConnection } = await import('@/api/backend')
      const data = { csrf_token: 'token', connected: true }
      mockFetch.mockResolvedValueOnce(mockResponse(200, data))
      const result = await getConnection()
      expect(result).toEqual(data)
    })

    it('redirects to login on 403 and returns null', async () => {
      const { getConnection } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(403, null, false))
      const result = await getConnection()
      expect(result).toBeNull()
      expect(locationHref).toBe('/accounts/login/?next=/')
    })
  })

  describe('getAuthUrl', () => {
    it('returns authorize_url on success', async () => {
      const { getAuthUrl } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, { authorize_url: 'https://spotify.com/auth' }))
      const url = await getAuthUrl()
      expect(url).toBe('https://spotify.com/auth')
    })

    it('redirects and throws on 403', async () => {
      const { getAuthUrl } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(403, null, false))
      await expect(getAuthUrl()).rejects.toThrow('Unauthenticated')
      expect(locationHref).toBe('/accounts/login/?next=/')
    })

    it('throws server error on 500', async () => {
      const { getAuthUrl } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(500, null, false))
      await expect(getAuthUrl()).rejects.toThrow('server error 500')
    })

    it('throws on other non-ok responses', async () => {
      const { getAuthUrl } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(404, null, false))
      await expect(getAuthUrl()).rejects.toThrow('404')
    })

    it('throws when authorize_url is missing', async () => {
      const { getAuthUrl } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, { other: 'data' }))
      await expect(getAuthUrl()).rejects.toThrow('missing authorize_url')
    })
  })

  describe('getPlaylists', () => {
    it('returns playlists on 200', async () => {
      const { getPlaylists } = await import('@/api/backend')
      const playlists = [{ spotify_id: 'pl1', name: 'Playlist 1', track_count: 3 }]
      mockFetch.mockResolvedValueOnce(mockResponse(200, playlists))
      const result = await getPlaylists()
      expect(result).toEqual(playlists)
    })

    it('returns null on non-ok response', async () => {
      const { getPlaylists } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(502, null, false))
      const result = await getPlaylists()
      expect(result).toBeNull()
    })
  })

  describe('getTracks', () => {
    it('returns tracks on 200', async () => {
      const { getTracks } = await import('@/api/backend')
      const tracks = [{ position: 0, spotify_id: 'tr1', name: 'Track 1', artists: ['A'], album: 'B', uri: 'spotify:track:tr1' }]
      mockFetch.mockResolvedValueOnce(mockResponse(200, tracks))
      const result = await getTracks('pl123')
      expect(result).toEqual(tracks)
      expect(mockFetch).toHaveBeenCalledWith('/api/playlists/pl123/tracks/')
    })

    it('returns null on non-ok response', async () => {
      const { getTracks } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(404, null, false))
      const result = await getTracks('pl123')
      expect(result).toBeNull()
    })
  })

  describe('getToken', () => {
    it('returns access_token on 200', async () => {
      const { getToken } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, { access_token: 'tok123' }))
      const result = await getToken()
      expect(result).toBe('tok123')
    })

    it('throws on non-ok response', async () => {
      const { getToken } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(401, null, false))
      await expect(getToken()).rejects.toThrow('Failed to fetch Spotify token')
    })

    it('throws when access_token is missing', async () => {
      const { getToken } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, { other: 'field' }))
      await expect(getToken()).rejects.toThrow('missing access_token')
    })
  })

  describe('play', () => {
    it('sends PUT with uris, device_id, and CSRF header', async () => {
      const { play } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, null))
      await play(['spotify:track:a', 'spotify:track:b'], 'dev-1')
      expect(mockFetch).toHaveBeenCalledWith('/api/spotify/play/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': 'mock-csrf-token',
        },
        body: JSON.stringify({ uris: ['spotify:track:a', 'spotify:track:b'], device_id: 'dev-1' }),
      })
    })

    it('includes position_ms when provided', async () => {
      const { play } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, null))
      await play(['spotify:track:a'], 'dev-1', { positionMs: 15000 })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.position_ms).toBe(15000)
    })

    it('does not throw on non-ok response (logs error)', async () => {
      const { play } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(503, null, false))
      await expect(play(['spotify:track:a'], 'dev-1')).resolves.toBeUndefined()
    })
  })

  describe('getSession', () => {
    it('returns session data on 200', async () => {
      const { getSession } = await import('@/api/backend')
      const data = { current_track_uri: 'spotify:track:a', position_ms: 1000, track_uris: ['spotify:track:a'] }
      mockFetch.mockResolvedValueOnce(mockResponse(200, data))
      const result = await getSession('pl1')
      expect(result).toEqual(data)
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/pl1/')
    })

    it('returns null on 404', async () => {
      const { getSession } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(404, null, false))
      const result = await getSession('pl1')
      expect(result).toBeNull()
    })

    it('returns null on other errors', async () => {
      const { getSession } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(500, null, false))
      const result = await getSession('pl1')
      expect(result).toBeNull()
    })
  })

  describe('saveSession', () => {
    it('sends PUT with session data and CSRF header', async () => {
      const { saveSession } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(200, null))
      const data = { current_track_uri: 'spotify:track:a', position_ms: 5000, track_uris: ['spotify:track:a'] }
      await saveSession('pl1', data)
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/pl1/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': 'mock-csrf-token',
        },
        body: JSON.stringify(data),
      })
    })

    it('does not throw on non-ok response (logs error)', async () => {
      const { saveSession } = await import('@/api/backend')
      mockFetch.mockResolvedValueOnce(mockResponse(500, null, false))
      await expect(
        saveSession('pl1', { current_track_uri: 'u', position_ms: 0, track_uris: [] })
      ).resolves.toBeUndefined()
    })
  })
})
