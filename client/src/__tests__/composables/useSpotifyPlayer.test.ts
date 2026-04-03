import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSpotivoreStore } from '@/stores/spotivore'

// Mock API functions used by the composable
vi.mock('@/api/backend', () => ({
  getToken: vi.fn().mockResolvedValue('mock-token'),
  play: vi.fn().mockResolvedValue(undefined),
  saveSession: vi.fn().mockResolvedValue(undefined),
}))

// Mock lodash-es shuffle to return a predictable order
vi.mock('lodash-es', () => ({
  shuffle: vi.fn((arr: unknown[]) => [...arr].reverse()),
}))

// Helpers to capture listeners registered on the mock player
type ListenerMap = Record<string, (arg: unknown) => void>

function makeMockPlayer(): { instance: ReturnType<typeof buildPlayerMock>; listeners: ListenerMap } {
  const listeners: ListenerMap = {}
  const instance = buildPlayerMock(listeners)
  return { instance, listeners }
}

function buildPlayerMock(listeners: ListenerMap) {
  return {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    addListener: vi.fn((event: string, cb: (arg: unknown) => void) => {
      listeners[event] = cb
    }),
    togglePlay: vi.fn().mockResolvedValue(undefined),
    previousTrack: vi.fn().mockResolvedValue(undefined),
    nextTrack: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
  }
}

function setupSpotifySDK() {
  const { instance, listeners } = makeMockPlayer()
  window.Spotify = {
    Player: vi.fn().mockImplementation(() => instance) as unknown as typeof window.Spotify.Player,
  }
  // Trigger the SDK ready callback immediately when the script is "loaded"
  // by overriding createElement to call onSpotifyWebPlaybackSDKReady
  const origCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreateElement(tag)
    if (tag === 'script') {
      // After script is appended to head, fire the SDK ready callback
      const origDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'appendChild')
      const origAppendChild = origDescriptor?.value
      el.appendChild = origAppendChild
      // Use a getter trick: fire callback synchronously when src is set
      Object.defineProperty(el, 'src', {
        set: (_v: string) => {
          setTimeout(() => window.onSpotifyWebPlaybackSDKReady?.(), 0)
        },
        configurable: true,
      })
    }
    return el
  })
  return { instance, listeners }
}

describe('useSpotifyPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetModules()
    // Reset SDK state
    // @ts-expect-error - reset global
    delete window.Spotify
    // @ts-expect-error - reset global
    delete window.onSpotifyWebPlaybackSDKReady
    vi.restoreAllMocks()
  })

  describe('initSpotifyPlayer', () => {
    it('creates a player, connects, and registers listeners', async () => {
      const { instance } = setupSpotifySDK()
      const { initSpotifyPlayer } = await import('@/composables/useSpotifyPlayer')
      await initSpotifyPlayer()
      await vi.runAllTimersAsync?.().catch(() => {})
      expect(instance.connect).toHaveBeenCalled()
      expect(instance.addListener).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(instance.addListener).toHaveBeenCalledWith('not_ready', expect.any(Function))
      expect(instance.addListener).toHaveBeenCalledWith('player_state_changed', expect.any(Function))
    })

    it('is a no-op if called again (singleton)', async () => {
      const { instance } = setupSpotifySDK()
      const { initSpotifyPlayer } = await import('@/composables/useSpotifyPlayer')
      await initSpotifyPlayer()
      await initSpotifyPlayer()
      expect(instance.connect).toHaveBeenCalledTimes(1)
    })
  })

  describe('player control functions', () => {
    async function getInitializedModule() {
      const { instance, listeners } = setupSpotifySDK()
      const mod = await import('@/composables/useSpotifyPlayer')
      await mod.initSpotifyPlayer()
      return { instance, listeners, mod }
    }

    it('togglePlay calls player.togglePlay', async () => {
      const { instance, mod } = await getInitializedModule()
      mod.togglePlay()
      expect(instance.togglePlay).toHaveBeenCalled()
    })

    it('previousTrack calls player.previousTrack', async () => {
      const { instance, mod } = await getInitializedModule()
      mod.previousTrack()
      expect(instance.previousTrack).toHaveBeenCalled()
    })

    it('nextTrack calls player.nextTrack', async () => {
      const { instance, mod } = await getInitializedModule()
      mod.nextTrack()
      expect(instance.nextTrack).toHaveBeenCalled()
    })

    it('seek calls player.seek with positionMs', async () => {
      const { instance, mod } = await getInitializedModule()
      mod.seek(45000)
      expect(instance.seek).toHaveBeenCalledWith(45000)
    })
  })

  describe('SDK event listeners', () => {
    async function getInitializedModule() {
      const { instance, listeners } = setupSpotifySDK()
      const mod = await import('@/composables/useSpotifyPlayer')
      await mod.initSpotifyPlayer()
      return { instance, listeners, mod }
    }

    it('ready listener sets deviceId in store', async () => {
      const { listeners } = await getInitializedModule()
      const store = useSpotivoreStore()
      listeners['ready']?.({ device_id: 'dev-abc' })
      expect(store.deviceId).toBe('dev-abc')
      expect(store.playerReady).toBe(true)
    })

    it('not_ready listener clears deviceId in store', async () => {
      const { listeners } = await getInitializedModule()
      const store = useSpotivoreStore()
      store.setDeviceId('dev-abc')
      listeners['not_ready']?.({ device_id: 'dev-abc' })
      expect(store.deviceId).toBeNull()
      expect(store.playerReady).toBe(false)
    })

    it('player_state_changed updates store state', async () => {
      const { listeners } = await getInitializedModule()
      const store = useSpotivoreStore()
      const state = {
        paused: false,
        position: 10000,
        duration: 200000,
        track_window: {
          current_track: {
            id: 'tr1',
            name: 'Song',
            uri: 'spotify:track:tr1',
            artists: [{ name: 'Artist' }],
            album: { name: 'Album', images: [{ url: 'http://img.com/art.jpg' }] },
          },
        },
      }
      listeners['player_state_changed']?.(state)
      expect(store.paused).toBe(false)
      expect(store.positionMs).toBe(10000)
      expect(store.nowPlaying?.trackId).toBe('tr1')
    })

    it('player_state_changed saves session when track changes and sessionPlaylistId is set', async () => {
      const { listeners } = await getInitializedModule()
      const { saveSession } = await import('@/api/backend')
      const store = useSpotivoreStore()
      store.setSession('pl1', ['spotify:track:tr2'])
      // Set current nowPlaying to a different track
      store.setPlayerState({
        paused: false,
        position: 0,
        duration: 100000,
        track_window: {
          current_track: {
            id: 'tr1',
            name: 'Old Song',
            uri: 'spotify:track:tr1',
            artists: [{ name: 'A' }],
            album: { name: 'B', images: [] },
          },
        },
      })
      const newState = {
        paused: false,
        position: 0,
        duration: 100000,
        track_window: {
          current_track: {
            id: 'tr2',
            name: 'New Song',
            uri: 'spotify:track:tr2',
            artists: [{ name: 'A' }],
            album: { name: 'B', images: [] },
          },
        },
      }
      listeners['player_state_changed']?.(newState)
      expect(saveSession).toHaveBeenCalledWith('pl1', expect.objectContaining({
        current_track_uri: 'spotify:track:tr2',
      }))
    })

    it('player_state_changed does not save session when track uri is unchanged', async () => {
      const { listeners } = await getInitializedModule()
      const { saveSession } = await import('@/api/backend')
      const store = useSpotivoreStore()
      store.setSession('pl1', ['spotify:track:tr1'])
      const state = {
        paused: false,
        position: 0,
        duration: 100000,
        track_window: {
          current_track: {
            id: 'tr1',
            name: 'Song',
            uri: 'spotify:track:tr1',
            artists: [{ name: 'A' }],
            album: { name: 'B', images: [] },
          },
        },
      }
      // Set same uri as current
      store.setPlayerState(state)
      vi.clearAllMocks()
      listeners['player_state_changed']?.(state)
      expect(saveSession).not.toHaveBeenCalled()
    })

    it('player_state_changed ignores null state', async () => {
      const { listeners } = await getInitializedModule()
      const store = useSpotivoreStore()
      // Should not throw
      listeners['player_state_changed']?.(null)
      expect(store.nowPlaying).toBeNull()
    })
  })

  describe('playTrack', () => {
    async function setup() {
      const { instance, listeners } = setupSpotifySDK()
      const mod = await import('@/composables/useSpotifyPlayer')
      await mod.initSpotifyPlayer()
      const store = useSpotivoreStore()
      store.setDeviceId('dev-1')
      const { play } = await import('@/api/backend')
      return { mod, store, play, instance, listeners }
    }

    const tracks = [
      { position: 0, spotify_id: 'id1', name: 'Track 1', artists: ['A'], album: 'B', uri: 'spotify:track:id1' },
      { position: 1, spotify_id: 'id2', name: 'Track 2', artists: ['A'], album: 'B', uri: 'spotify:track:id2' },
      { position: 2, spotify_id: 'id3', name: 'Track 3', artists: ['A'], album: 'B', uri: 'spotify:track:id3' },
    ]

    it('plays from clicked track to end when shuffle is off', async () => {
      const { mod, store, play } = await setup()
      store.setCurrentTracks(tracks)
      store.selectPlaylist({ spotify_id: 'pl1', name: 'PL', track_count: 3 })
      await mod.playTrack('spotify:track:id2')
      expect(play).toHaveBeenCalledWith(
        ['spotify:track:id2', 'spotify:track:id3'],
        'dev-1',
      )
    })

    it('sets session with queue uris when shuffle is off', async () => {
      const { mod, store } = await setup()
      store.setCurrentTracks(tracks)
      store.selectPlaylist({ spotify_id: 'pl1', name: 'PL', track_count: 3 })
      await mod.playTrack('spotify:track:id2')
      expect(store.sessionTrackUris).toEqual(['spotify:track:id2', 'spotify:track:id3'])
    })

    it('puts clicked track first and shuffles the rest when shuffle is on', async () => {
      const { mod, store, play } = await setup()
      store.setCurrentTracks(tracks)
      store.selectPlaylist({ spotify_id: 'pl1', name: 'PL', track_count: 3 })
      store.toggleShuffle()
      await mod.playTrack('spotify:track:id2')
      // shuffle mock reverses the remaining tracks [id1, id3] → [id3, id1]
      expect(play).toHaveBeenCalledWith(
        ['spotify:track:id2', 'spotify:track:id3', 'spotify:track:id1'],
        'dev-1',
      )
    })

    it('does nothing and does not call play when no device', async () => {
      const { mod, store, play } = await setup()
      store.setDeviceId(null)
      store.setCurrentTracks(tracks)
      await mod.playTrack('spotify:track:id1')
      expect(play).not.toHaveBeenCalled()
    })
  })

  describe('resumeSession', () => {
    async function setup() {
      const { instance, listeners } = setupSpotifySDK()
      const mod = await import('@/composables/useSpotifyPlayer')
      await mod.initSpotifyPlayer()
      const store = useSpotivoreStore()
      store.setDeviceId('dev-1')
      store.selectPlaylist({ spotify_id: 'pl1', name: 'PL', track_count: 3 })
      const { play } = await import('@/api/backend')
      return { mod, store, play, instance, listeners }
    }

    it('plays from current_track_uri with position_ms', async () => {
      const { mod, play } = await setup()
      await mod.resumeSession({
        current_track_uri: 'spotify:track:b',
        position_ms: 30000,
        track_uris: ['spotify:track:a', 'spotify:track:b', 'spotify:track:c'],
      })
      expect(play).toHaveBeenCalledWith(
        ['spotify:track:b', 'spotify:track:c'],
        'dev-1',
        { positionMs: 30000 },
      )
    })

    it('starts from beginning when current_track_uri not found in track_uris', async () => {
      const { mod, play } = await setup()
      await mod.resumeSession({
        current_track_uri: 'spotify:track:x',
        position_ms: 0,
        track_uris: ['spotify:track:a', 'spotify:track:b'],
      })
      expect(play).toHaveBeenCalledWith(
        ['spotify:track:a', 'spotify:track:b'],
        'dev-1',
        { positionMs: 0 },
      )
    })

    it('sets session in store', async () => {
      const { mod, store } = await setup()
      await mod.resumeSession({
        current_track_uri: 'spotify:track:b',
        position_ms: 0,
        track_uris: ['spotify:track:a', 'spotify:track:b'],
      })
      expect(store.sessionPlaylistId).toBe('pl1')
      expect(store.sessionTrackUris).toEqual(['spotify:track:b'])
    })

    it('does nothing when no device', async () => {
      const { mod, store, play } = await setup()
      store.setDeviceId(null)
      await mod.resumeSession({
        current_track_uri: 'spotify:track:a',
        position_ms: 0,
        track_uris: ['spotify:track:a'],
      })
      expect(play).not.toHaveBeenCalled()
    })
  })

  describe('toggleShuffle', () => {
    it('calls store.toggleShuffle', async () => {
      setupSpotifySDK()
      const { toggleShuffle } = await import('@/composables/useSpotifyPlayer')
      const store = useSpotivoreStore()
      expect(store.shuffleEnabled).toBe(false)
      toggleShuffle()
      expect(store.shuffleEnabled).toBe(true)
    })
  })
})
