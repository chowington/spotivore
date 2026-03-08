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
  <div id="track-list">
    <div v-if="playlist" id="track-list-header">
      <div id="track-list-title">
        <h2>{{ playlist.name }}</h2>
        <span class="track-count">{{ tracks.length }} tracks</span>
      </div>
      <div id="playlist-tools">
        <button id="sync-playlist-btn" @click="syncWithSpotivore" title="Sync playlist to Spotivore">
          Sync to Spotivore
        </button>
        <button id="refresh-btn" @click="refresh" title="Refresh tracklist">Refresh</button>
      </div>
    </div>
    <div v-else class="no-playlist-message">Select a playlist</div>
    <div id="track-list-body">
      <TrackItem v-for="track in tracks" :key="track.position" :track="track" />
    </div>
  </div>
</template>

<style scoped>
#track-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

#track-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 24px 20px;
  border-bottom: 1px solid var(--sp-border);
  flex-shrink: 0;
}

#track-list-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--sp-text);
}

.track-count {
  font-size: 13px;
  color: var(--sp-text-muted);
}

#playlist-tools {
  display: flex;
  gap: 8px;
}

button {
  background: transparent;
  border: 1px solid #535353;
  color: var(--sp-text);
  padding: 6px 18px;
  border-radius: 500px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}

button:hover {
  border-color: var(--sp-text);
}

#sync-playlist-btn {
  background: var(--sp-green);
  border-color: var(--sp-green);
  color: #000;
  font-weight: 700;
}

#sync-playlist-btn:hover {
  background: var(--sp-green-light);
  border-color: var(--sp-green-light);
}

#track-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.no-playlist-message {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: var(--sp-text-muted);
  font-size: 15px;
}
</style>
