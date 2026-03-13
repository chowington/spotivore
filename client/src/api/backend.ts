import { getCsrfToken } from '@/utils/csrf'
import type { Playlist, Track } from '@/stores/spotivore'

export interface ConnectionData {
  csrf_token: string
  connected: boolean
}

export async function getConnection(): Promise<ConnectionData | null> {
  const res = await fetch('/api/spotify/connection/')
  if (res.status === 403) {
    window.location.href = '/accounts/login/?next=/'
    return null
  }
  return res.json()
}

export async function getAuthUrl(): Promise<string> {
  const res = await fetch('/api/spotify/auth-url/')

  if (res.status === 403) {
    // Unauthenticated session: redirect to login, similar to getConnection()
    window.location.href = '/accounts/login/?next=/'
    throw new Error('Unauthenticated: redirected to login')
  }

  if (!res.ok) {
    if (res.status >= 500) {
      throw new Error(`Failed to get auth URL: server error ${res.status} ${res.statusText}`)
    }
    throw new Error(`Failed to get auth URL: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (!data || typeof data.authorize_url !== 'string') {
    throw new Error('Failed to get auth URL: missing authorize_url in response')
  }
  return data.authorize_url as string
}

export async function getPlaylists(): Promise<Playlist[] | null> {
  const res = await fetch('/api/spotify/playlists/')
  if (!res.ok) {
    console.error(`Failed to fetch playlists: ${res.status} ${res.statusText}`)
    return null
  }
  return res.json()
}

export async function getTracks(spotifyId: string): Promise<Track[] | null> {
  const res = await fetch(`/api/playlists/${spotifyId}/tracks/`)
  if (!res.ok) {
    console.error(`Failed to fetch tracks: ${res.status} ${res.statusText}`)
    return null
  }
  return res.json()
}

export async function getToken(): Promise<string> {
  const res = await fetch('/api/spotify/token/')
  const data = await res.json()
  return data.access_token as string
}

export async function play(uris: string[], deviceId: string): Promise<void> {
  const res = await fetch('/api/spotify/play/', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({ uris, device_id: deviceId }),
  })
  if (!res.ok) {
    console.error(`Play failed: ${res.status} ${res.statusText}`)
  }
}
