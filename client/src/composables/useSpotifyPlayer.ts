import { useSpotivoreStore } from '@/stores/spotivore'
import { getCsrfToken } from '@/utils/csrf'

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

async function fetchToken(): Promise<string> {
  const res = await fetch('/api/spotify/token/')
  const data = await res.json()
  return data.access_token as string
}

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
      fetchToken().then(cb)
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
    if (state) store.setPlayerState(state)
  })

  player.connect()
}

export function togglePlay(): void {
  player?.togglePlay()
}

export function previousTrack(): void {
  player?.previousTrack()
}

export function nextTrack(): void {
  player?.nextTrack()
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
  const res = await fetch('/api/spotify/play/', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({ uris: [uri], device_id: store.deviceId }),
  })
  if (!res.ok) {
    console.error(`Play failed: ${res.status} ${res.statusText}`)
  }
}
