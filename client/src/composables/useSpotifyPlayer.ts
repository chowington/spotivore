import { shuffle } from 'lodash-es'
import { useSpotivoreStore } from '@/stores/spotivore'
import { getToken, play, saveSession, type SessionData } from '@/api/backend'

// Minimal Spotify Web Playback SDK type declarations
interface SpotifyArtist {
  name: string
}
interface SpotifyAlbumImage {
  url: string
}
interface SpotifyAlbum {
  name: string
  images: SpotifyAlbumImage[]
}
interface SpotifySDKTrack {
  id: string
  name: string
  uri: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
  linked_from?: { id: string }
}
interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  track_window: { current_track: SpotifySDKTrack }
}
interface SpotifyPlayerInstance {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready', cb: (e: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (e: { device_id: string }) => void): void
  addListener(
    event: 'player_state_changed',
    cb: (state: SpotifyPlaybackState | null) => void,
  ): void
  togglePlay(): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
  seek(positionMs: number): Promise<void>
}

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayerInstance
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

// Module-level singleton so the player is only created once
let player: SpotifyPlayerInstance | null = null
let sdkReady = false

function loadSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (sdkReady && window.Spotify) {
      resolve()
      return
    }
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkReady = true
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.head.appendChild(script)
  })
}

export async function initSpotifyPlayer(): Promise<void> {
  if (player) return

  const store = useSpotivoreStore()
  await loadSDK()

  player = new window.Spotify.Player({
    name: 'Spotivore',
    getOAuthToken: (cb) => {
      getToken().then(cb)
    },
    volume: 0.5,
  })

  player.addListener('ready', ({ device_id }) => {
    store.setDeviceId(device_id)
  })

  player.addListener('not_ready', () => {
    store.setDeviceId(null)
  })

  player.addListener('player_state_changed', (state) => {
    if (!state) return
    const track = state.track_window.current_track
    if (!track.id && !track.uri) return
    const previousUri = store.nowPlaying?.uri
    store.setPlayerState(state)
    if (track.uri !== previousUri && store.sessionPlaylistId) {
      saveSession(store.sessionPlaylistId, {
        current_track_uri: track.uri,
        position_ms: state.position,
        track_uris: store.sessionTrackUris,
        shuffled: store.shuffleEnabled,
      })
    }
  })

  player.connect()
}

export function togglePlay(): void {
  player?.togglePlay()
}

export function previousTrack(): void {
  player?.previousTrack()
}

export async function nextTrack(): Promise<void> {
  const store = useSpotivoreStore()
  if (!store.sessionPlaylistId || !store.deviceId || !store.nowPlaying) {
    player?.nextTrack()
    return
  }
  const currentIndex = store.sessionTrackUris.indexOf(store.nowPlaying.uri)
  if (currentIndex === -1 || currentIndex >= store.sessionTrackUris.length - 1) {
    player?.nextTrack()
    return
  }
  const remainingUris = store.sessionTrackUris.slice(currentIndex + 1)
  await play(remainingUris, store.deviceId)
}

export function seek(positionMs: number): void {
  player?.seek(positionMs)
}

export async function playTrack(uri: string): Promise<void> {
  const store = useSpotivoreStore()
  if (!store.deviceId) {
    console.warn('No Spotivore player device ready')
    return
  }
  if (store.displayedTracks.length === 0) {
    console.warn('No tracks loaded')
    return
  }
  store.setSessionPlaylistTracks(store.displayedTracks)
  if (store.shuffleEnabled) {
    const clicked = store.displayedTracks.find((t) => t.uri === uri)
    const remaining = store.displayedTracks.filter((t) => t.uri !== uri)
    const shuffledUris = [
      ...(clicked ? [clicked.uri] : [uri]),
      ...shuffle(remaining).map((t) => t.uri),
    ]
    store.setSession(store.selectedPlaylist!.spotify_id, shuffledUris)
    await play(shuffledUris, store.deviceId)
  } else {
    const clickedIndex = store.displayedTracks.findIndex((t) => t.uri === uri)
    const queueUris =
      clickedIndex >= 0
        ? store.displayedTracks.slice(clickedIndex).map((t) => t.uri)
        : [uri]
    store.setSession(store.selectedPlaylist!.spotify_id, queueUris)
    await play(queueUris, store.deviceId)
  }
}

export async function resumeSession(session: SessionData): Promise<void> {
  const store = useSpotivoreStore()
  if (!store.deviceId) return
  store.setSessionPlaylistTracks(store.displayedTracks)
  const index = session.track_uris.indexOf(session.current_track_uri)
  const startIndex = index >= 0 ? index : 0
  const urisFromCurrent = session.track_uris.slice(startIndex)
  store.setSession(store.selectedPlaylist!.spotify_id, urisFromCurrent)
  store.setShuffle(session.shuffled)
  await play(urisFromCurrent, store.deviceId, { positionMs: session.position_ms })
}

export async function toggleShuffle(): Promise<void> {
  const store = useSpotivoreStore()
  const newShuffleState = !store.shuffleEnabled
  store.setShuffle(newShuffleState)

  if (!store.sessionPlaylistId || !store.nowPlaying) return

  const currentUri = store.nowPlaying.uri
  let newUris: string[]

  if (newShuffleState) {
    const pool = store.sessionPlaylistTracks.filter((t) => t.uri !== currentUri).map((t) => t.uri)
    newUris = [currentUri, ...shuffle(pool)]
  } else {
    const currentIndex = store.sessionPlaylistTracks.findIndex((t) => t.uri === currentUri)
    newUris =
      currentIndex >= 0
        ? store.sessionPlaylistTracks.slice(currentIndex).map((t) => t.uri)
        : store.sessionPlaylistTracks.map((t) => t.uri)
  }

  store.setSession(store.sessionPlaylistId, newUris)
  void saveSession(store.sessionPlaylistId, {
    current_track_uri: currentUri,
    position_ms: store.positionMs,
    track_uris: newUris,
    shuffled: newShuffleState,
  }).catch((error) => {
    console.error('Failed to save session after toggling shuffle', error)
  })
  if (store.deviceId) {
    await play(newUris, store.deviceId)
  }
}
