<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSpotivoreStore, type Track } from '@/stores/spotivore'
import TrackItem from './TrackItem.vue'

const store = useSpotivoreStore()

const tracks = ref<Track[]>([])

const playlist = computed(() => store.selectedPlaylist)

// Pull the current playlist's tracks and refresh the tracklist.
// If the playlist has been synced to Spotivore, fetch from there;
// otherwise fetch from Spotify via the backend.
async function refresh() {
  if (!playlist.value) return
  tracks.value = []

  if (playlist.value.has_local_data) {
    // Fetch local track entries from Spotivore
    const res = await fetch(`/api/playlists/${playlist.value.spotify_id}/`)
    if (!res.ok) { console.error(`Failed to fetch local playlist: ${res.status} ${res.statusText}`); return }
    const data = await res.json()

    // Spotivore returns position + track metadata; map to the Track shape.
    // Note: the local store doesn't have artists/album data, just spotify_id and name.
    tracks.value = data.entries.map(
      (entry: { position: number; track: { spotify_id: string; name: string } }) => ({
        position: entry.position,
        spotify_id: entry.track.spotify_id,
        name: entry.track.name,
        artists: [],
        album: '',
        uri: '',
      }),
    )
  } else {
    // Fetch tracks from Spotify via the backend
    const res = await fetch(`/api/spotify/playlists/${playlist.value.spotify_id}/tracks/`)
    if (!res.ok) { console.error(`Failed to fetch Spotify tracks: ${res.status} ${res.statusText}`); return }
    tracks.value = await res.json()
  }
}

// Sync the current Spotify tracklist into Spotivore's local store.
// This sends the full track list to Spotivore so it can track local changes.
async function syncWithSpotivore() {
  if (!playlist.value) return

  // First fetch fresh tracks from Spotify
  const res = await fetch(`/api/spotify/playlists/${playlist.value.spotify_id}/tracks/`)
  if (!res.ok) { console.error(`Failed to fetch Spotify tracks for sync: ${res.status} ${res.statusText}`); return }
  const spotifyTracks: Track[] = await res.json()

  // Then sync to Spotivore
  const syncRes = await fetch('/api/playlists/sync/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({
      spotify_id: playlist.value.spotify_id,
      name: playlist.value.name,
      tracks: spotifyTracks.map((t) => ({ spotify_id: t.spotify_id, name: t.name })),
    }),
  })

  if (!syncRes.ok) return

  store.markPlaylistAsLocal(playlist.value.spotify_id)
  tracks.value = spotifyTracks
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/)
  return match ? match[1] : ''
}

// When the current playlist changes, refresh the tracklist
watch(playlist, () => {
  refresh()
})
</script>

<template>
  <div>
    <div v-if="playlist" id="track-list-header">
      <h3>{{ playlist.name }} ({{ tracks.length }})</h3>
      <span id="playlist-tools">
        <button id="sync-playlist-btn" @click="syncWithSpotivore" title="Sync playlist to Spotivore">
          Sync to Spotivore
        </button>
        <button id="refresh-btn" @click="refresh" title="Refresh tracklist">Refresh</button>
      </span>
    </div>
    <div v-else class="no-playlist-message">Select a playlist</div>
    <TrackItem v-for="track in tracks" :key="track.position" :track="track" />
  </div>
</template>
