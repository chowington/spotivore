import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Playlist {
  spotify_id: string
  name: string
  track_count: number
}

export interface Track {
  position: number
  spotify_id: string
  name: string
  artists: string[]
  album: string
  uri: string
}

export interface NowPlaying {
  trackId: string
  linkedFromId: string | null
  trackName: string
  artists: string[]
  albumName: string
  albumArtUrl: string | null
  uri: string
  durationMs: number
}

export const useSpotivoreStore = defineStore('spotivore', () => {
  // The full list of the user's playlists, populated by PlaylistList
  const playlists = ref<Playlist[]>([])
  // The currently-selected playlist
  const selectedPlaylist = ref<Playlist | null>(null)

  // CSRF token returned by the connection endpoint on every route navigation
  const csrfToken = ref('')

  // Shuffle state
  const shuffleEnabled = ref(false)
  const currentTracks = ref<Track[]>([])

  // Session state
  const sessionPlaylistId = ref<string | null>(null)
  const sessionTrackUris = ref<string[]>([])

  // Player state — kept in sync with the Spotify Web Playback SDK
  const deviceId = ref<string | null>(null)
  const playerReady = ref(false)
  const paused = ref(true)
  const nowPlaying = ref<NowPlaying | null>(null)
  const positionMs = ref(0)
  const lastPositionTimestamp = ref(Date.now())

  function setSession(playlistId: string, trackUris: string[]) {
    sessionPlaylistId.value = playlistId
    sessionTrackUris.value = trackUris
  }

  function toggleShuffle() {
    shuffleEnabled.value = !shuffleEnabled.value
  }

  function setCurrentTracks(tracks: Track[]) {
    currentTracks.value = tracks
  }

  function selectPlaylist(playlist: Playlist) {
    selectedPlaylist.value = playlist
  }

  function setCsrfToken(token: string) {
    csrfToken.value = token
  }

  function setDeviceId(id: string | null) {
    deviceId.value = id
    playerReady.value = id !== null
  }

  function setPlayerState(state: {
    paused: boolean
    position: number
    duration: number
    track_window: {
      current_track: {
        id: string
        name: string
        uri: string
        artists: { name: string }[]
        album: { name: string; images: { url: string }[] }
        linked_from?: { id: string }
      }
    }
  }) {
    paused.value = state.paused
    positionMs.value = state.position
    lastPositionTimestamp.value = Date.now()
    const track = state.track_window.current_track
    nowPlaying.value = {
      trackId: track.id,
      linkedFromId: track.linked_from?.id ?? null,
      trackName: track.name,
      artists: track.artists.map((a) => a.name),
      albumName: track.album.name,
      albumArtUrl: track.album.images[0]?.url ?? null,
      uri: track.uri,
      durationMs: state.duration,
    }
  }

  return {
    playlists,
    selectedPlaylist,
    csrfToken,
    shuffleEnabled,
    currentTracks,
    sessionPlaylistId,
    sessionTrackUris,
    deviceId,
    playerReady,
    paused,
    nowPlaying,
    positionMs,
    lastPositionTimestamp,
    setSession,
    toggleShuffle,
    setCurrentTracks,
    selectPlaylist,
    setCsrfToken,
    setDeviceId,
    setPlayerState,
  }
})
