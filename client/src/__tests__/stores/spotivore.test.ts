import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSpotivoreStore } from '@/stores/spotivore'

describe('spotivore store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useSpotivoreStore()
      expect(store.playlists).toEqual([])
      expect(store.selectedPlaylist).toBeNull()
      expect(store.csrfToken).toBe('')
      expect(store.shuffleEnabled).toBe(false)
      expect(store.displayedTracks).toEqual([])
      expect(store.sessionPlaylistId).toBeNull()
      expect(store.sessionTrackUris).toEqual([])
      expect(store.deviceId).toBeNull()
      expect(store.playerReady).toBe(false)
      expect(store.paused).toBe(true)
      expect(store.nowPlaying).toBeNull()
      expect(store.positionMs).toBe(0)
    })
  })

  describe('setCsrfToken', () => {
    it('sets csrfToken', () => {
      const store = useSpotivoreStore()
      store.setCsrfToken('abc123')
      expect(store.csrfToken).toBe('abc123')
    })
  })

  describe('toggleShuffle', () => {
    it('flips shuffleEnabled from false to true', () => {
      const store = useSpotivoreStore()
      store.toggleShuffle()
      expect(store.shuffleEnabled).toBe(true)
    })

    it('flips shuffleEnabled from true to false', () => {
      const store = useSpotivoreStore()
      store.toggleShuffle()
      store.toggleShuffle()
      expect(store.shuffleEnabled).toBe(false)
    })
  })

  describe('setDisplayedTracks', () => {
    it('sets displayedTracks', () => {
      const store = useSpotivoreStore()
      const tracks = [
        { position: 0, spotify_id: 'id1', name: 'Track 1', artists: ['Artist'], album: 'Album', uri: 'spotify:track:id1' },
      ]
      store.setDisplayedTracks(tracks)
      expect(store.displayedTracks).toEqual(tracks)
    })
  })

  describe('selectPlaylist', () => {
    it('sets selectedPlaylist', () => {
      const store = useSpotivoreStore()
      const playlist = { spotify_id: 'pl1', name: 'My Playlist', track_count: 5 }
      store.selectPlaylist(playlist)
      expect(store.selectedPlaylist).toEqual(playlist)
    })
  })

  describe('setSession', () => {
    it('sets sessionPlaylistId and sessionTrackUris', () => {
      const store = useSpotivoreStore()
      store.setSession('playlist123', ['spotify:track:a', 'spotify:track:b'])
      expect(store.sessionPlaylistId).toBe('playlist123')
      expect(store.sessionTrackUris).toEqual(['spotify:track:a', 'spotify:track:b'])
    })
  })

  describe('setDeviceId', () => {
    it('sets deviceId and playerReady to true when given an id', () => {
      const store = useSpotivoreStore()
      store.setDeviceId('device-abc')
      expect(store.deviceId).toBe('device-abc')
      expect(store.playerReady).toBe(true)
    })

    it('sets deviceId to null and playerReady to false', () => {
      const store = useSpotivoreStore()
      store.setDeviceId('device-abc')
      store.setDeviceId(null)
      expect(store.deviceId).toBeNull()
      expect(store.playerReady).toBe(false)
    })
  })

  describe('setPlayerState', () => {
    const makeState = (overrides = {}) => ({
      paused: false,
      position: 30000,
      duration: 200000,
      track_window: {
        current_track: {
          id: 'track1',
          name: 'Song Name',
          uri: 'spotify:track:track1',
          artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
          album: { name: 'Album Name', images: [{ url: 'https://example.com/art.jpg' }] },
        },
      },
      ...overrides,
    })

    it('sets paused, positionMs, and lastPositionTimestamp', () => {
      const store = useSpotivoreStore()
      const before = Date.now()
      store.setPlayerState(makeState())
      expect(store.paused).toBe(false)
      expect(store.positionMs).toBe(30000)
      expect(store.lastPositionTimestamp).toBeGreaterThanOrEqual(before)
    })

    it('maps track data into nowPlaying', () => {
      const store = useSpotivoreStore()
      store.setPlayerState(makeState())
      expect(store.nowPlaying).toMatchObject({
        trackId: 'track1',
        linkedFromId: null,
        trackName: 'Song Name',
        artists: ['Artist A', 'Artist B'],
        albumName: 'Album Name',
        albumArtUrl: 'https://example.com/art.jpg',
        uri: 'spotify:track:track1',
        durationMs: 200000,
      })
    })

    it('sets linkedFromId when linked_from is present', () => {
      const store = useSpotivoreStore()
      const state = makeState()
      state.track_window.current_track = {
        ...state.track_window.current_track,
        linked_from: { id: 'original-id' },
      }
      store.setPlayerState(state)
      expect(store.nowPlaying?.linkedFromId).toBe('original-id')
    })

    it('sets albumArtUrl to null when no images', () => {
      const store = useSpotivoreStore()
      const state = makeState()
      state.track_window.current_track.album.images = []
      store.setPlayerState(state)
      expect(store.nowPlaying?.albumArtUrl).toBeNull()
    })
  })
})
