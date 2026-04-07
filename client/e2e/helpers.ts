import type { Page } from '@playwright/test'

// ── Fixture data ─────────────────────────────────────────────────────────────

export const PLAYLISTS = [
  { spotify_id: 'pl-abc', name: 'My Chill Playlist', track_count: 3 },
  { spotify_id: 'pl-xyz', name: 'Workout Bangers', track_count: 2 },
]

export const TRACKS = [
  {
    position: 0,
    spotify_id: 'tr1',
    name: 'Song One',
    artists: ['Artist A'],
    album: 'Album X',
    uri: 'spotify:track:tr1',
  },
  {
    position: 1,
    spotify_id: 'tr2',
    name: 'Song Two',
    artists: ['Artist B', 'Artist C'],
    album: 'Album Y',
    uri: 'spotify:track:tr2',
  },
  {
    position: 2,
    spotify_id: 'tr3',
    name: 'Song Three',
    artists: ['Artist A'],
    album: 'Album X',
    uri: 'spotify:track:tr3',
  },
]

export const SESSION = {
  current_track_uri: 'spotify:track:tr2',
  position_ms: 42000,
  track_uris: ['spotify:track:tr1', 'spotify:track:tr2', 'spotify:track:tr3'],
  shuffled: false,
}

// ── Individual mock helpers ───────────────────────────────────────────────────

export async function mockConnection(
  page: Page,
  options: { connected: boolean; csrf_token?: string } = {
    connected: true,
    csrf_token: 'test-csrf',
  },
): Promise<void> {
  await page.route('/api/spotify/connection/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options),
    }),
  )
}

export async function mockAuthUrl(
  page: Page,
  url = 'https://accounts.spotify.com/fake-auth',
): Promise<void> {
  await page.route('/api/spotify/auth-url/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authorize_url: url }),
    }),
  )
}

export async function mockPlaylists(page: Page, playlists = PLAYLISTS): Promise<void> {
  await page.route('/api/spotify/playlists/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(playlists),
    }),
  )
}

export async function mockTracks(page: Page, tracks = TRACKS): Promise<void> {
  await page.route('/api/playlists/*/tracks/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tracks),
    }),
  )
}

export async function mockSession(
  page: Page,
  session: typeof SESSION | null = null,
): Promise<void> {
  await page.route('/api/sessions/*/', (route) =>
    route.fulfill(
      session === null
        ? { status: 404, body: '' }
        : { status: 200, contentType: 'application/json', body: JSON.stringify(session) },
    ),
  )
}

export async function mockSaveSession(page: Page): Promise<void> {
  await page.route(
    '/api/sessions/*/',
    (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 204, body: '' })
      } else {
        route.fallback()
      }
    },
  )
}

export async function mockToken(page: Page): Promise<void> {
  await page.route('/api/spotify/token/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake-access-token' }),
    }),
  )
}

export async function mockPlay(page: Page): Promise<void> {
  await page.route('/api/spotify/play/', (route) =>
    route.fulfill({ status: 204, body: '' }),
  )
}

// ── Spotify Web Playback SDK stub ─────────────────────────────────────────────

/**
 * Intercepts the Spotify Web Playback SDK script and returns a minimal stub.
 *
 * The stub defines window.Spotify.Player and calls
 * window.onSpotifyWebPlaybackSDKReady() so that loadSDK() resolves.
 * The player instance is exposed at window.__spotifyPlayer so tests can
 * trigger SDK events via page.evaluate().
 *
 * Usage in tests:
 *   await page.evaluate(() => {
 *     window.__spotifyPlayer._emit('ready', { device_id: 'test-device' })
 *   })
 */
export async function mockSpotifySDK(page: Page): Promise<void> {
  await page.route('https://sdk.scdn.co/spotify-player.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (function() {
          function SpotifyPlayer(options) {
            this._options = options;
            this._listeners = {};
            window.__spotifyPlayer = this;
          }
          SpotifyPlayer.prototype.addListener = function(event, cb) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(cb);
          };
          SpotifyPlayer.prototype._emit = function(event, data) {
            var cbs = this._listeners[event] || [];
            for (var i = 0; i < cbs.length; i++) { cbs[i](data); }
          };
          SpotifyPlayer.prototype.connect = function() { return Promise.resolve(true); };
          SpotifyPlayer.prototype.disconnect = function() {};
          SpotifyPlayer.prototype.togglePlay = function() { return Promise.resolve(); };
          SpotifyPlayer.prototype.previousTrack = function() { return Promise.resolve(); };
          SpotifyPlayer.prototype.nextTrack = function() { return Promise.resolve(); };
          SpotifyPlayer.prototype.seek = function() { return Promise.resolve(); };
          SpotifyPlayer.prototype.getCurrentState = function() { return Promise.resolve(null); };

          window.Spotify = { Player: SpotifyPlayer };

          if (typeof window.onSpotifyWebPlaybackSDKReady === 'function') {
            window.onSpotifyWebPlaybackSDKReady();
          }
        })();
      `,
    }),
  )
}

// ── Composite setup helpers ───────────────────────────────────────────────────

/**
 * Full setup for an authenticated home-page test. Call before page.goto('/').
 */
export async function setupAuthenticatedHome(
  page: Page,
  overrides: {
    playlists?: typeof PLAYLISTS
    tracks?: typeof TRACKS
    session?: typeof SESSION | null
  } = {},
): Promise<void> {
  await mockSpotifySDK(page)
  await mockConnection(page, { connected: true, csrf_token: 'test-csrf' })
  await mockPlaylists(page, overrides.playlists ?? PLAYLISTS)
  await mockTracks(page, overrides.tracks ?? TRACKS)
  await mockSession(page, overrides.session ?? null)
  await mockSaveSession(page)
  await mockToken(page)
  await mockPlay(page)
}

/**
 * Wait for initSpotifyPlayer() to finish so window.__spotifyPlayer is set.
 * Call this after page.goto('/') before using page.evaluate() to emit SDK events.
 */
export async function waitForSpotifyPlayer(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as Record<string, unknown>).__spotifyPlayer)
}

/**
 * Setup for the login page. Call before page.goto('/login') or page.goto('/').
 */
export async function setupLoginPage(page: Page): Promise<void> {
  await mockSpotifySDK(page)
  await mockConnection(page, { connected: false })
  await mockAuthUrl(page)
}
