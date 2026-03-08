import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Playlist {
  spotify_id: string
  name: string
  track_count: number
  // Whether this playlist has been synced into Spotivore's local store.
  // If true, tracks are fetched from Spotivore; otherwise from Spotify.
  has_local_data: boolean
}

export interface Track {
  position: number
  spotify_id: string
  name: string
  artists: string[]
  album: string
  uri: string
}

export const useSpotivoreStore = defineStore('spotivore', () => {
  // The full list of the user's playlists, populated by PlaylistList
  const playlists = ref<Playlist[]>([])
  // The currently-selected playlist
  const selectedPlaylist = ref<Playlist | null>(null)
  // Whether the player is paused
  const paused = ref(true)

  function selectPlaylist(playlist: Playlist) {
    selectedPlaylist.value = playlist
  }

  // Mark a playlist as having local data in Spotivore (e.g. after a sync)
  function markPlaylistAsLocal(spotify_id: string) {
    const playlist = playlists.value.find((p) => p.spotify_id === spotify_id)
    if (playlist) {
      playlist.has_local_data = true
    }
    if (selectedPlaylist.value?.spotify_id === spotify_id) {
      selectedPlaylist.value.has_local_data = true
    }
  }

  function togglePaused() {
    paused.value = !paused.value
  }

  return { playlists, selectedPlaylist, paused, selectPlaylist, markPlaylistAsLocal, togglePaused }
})