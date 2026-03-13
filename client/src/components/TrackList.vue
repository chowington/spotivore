<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSpotivoreStore, type Track } from '@/stores/spotivore'
import TrackItem from './TrackItem.vue'

const store = useSpotivoreStore()

const tracks = ref<Track[]>([])

const playlist = computed(() => store.selectedPlaylist)

async function refresh() {
  if (!playlist.value) return
  tracks.value = []
  const res = await fetch(`/api/playlists/${playlist.value.spotify_id}/tracks/`)
  if (!res.ok) { console.error(`Failed to fetch tracks: ${res.status} ${res.statusText}`); return }
  tracks.value = await res.json()
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
