<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSpotivoreStore, type Track } from '@/stores/spotivore'
import { getTracks, getSession, type SessionData } from '@/api/backend'
import { resumeSession } from '@/composables/useSpotifyPlayer'
import TrackItem from './TrackItem.vue'
import Spinner from './Spinner.vue'

const store = useSpotivoreStore()

const tracks = ref<Track[]>([])
const loading = ref(false)
const session = ref<SessionData | null>(null)

const playlist = computed(() => store.selectedPlaylist)

async function refresh() {
  if (!playlist.value) return
  tracks.value = []
  loading.value = true
  try {
    const [result, sessionResult] = await Promise.all([
      getTracks(playlist.value.spotify_id),
      getSession(playlist.value.spotify_id),
    ])
    if (result) {
      tracks.value = result
      store.setDisplayedTracks(result)
    }
    session.value = store.sessionPlaylistId === playlist.value?.spotify_id ? null : sessionResult
  } catch (error) {
    console.error('Failed to refresh tracks', error)
  } finally {
    loading.value = false
  }
}

async function handleResume() {
  if (!session.value) return
  await resumeSession(session.value!)
  session.value = null
}

// When the current playlist changes, refresh the tracklist
watch(playlist, () => {
  refresh()
})

// Hide resume button once playback starts for this playlist
watch(
  () => store.sessionPlaylistId,
  (id) => {
    if (id && id === playlist.value?.spotify_id) session.value = null
  },
)
</script>

<template>
  <div id="track-list">
    <div v-if="playlist" id="track-list-header">
      <div id="track-list-title">
        <h2>{{ playlist.name }}</h2>
        <span class="track-count">{{ tracks.length }} tracks</span>
      </div>
      <div id="playlist-tools">
        <button v-if="session" @click="handleResume" title="Resume listening session">Resume</button>
        <button id="refresh-btn" @click="refresh" :disabled="loading" title="Refresh tracklist">Refresh</button>
      </div>
    </div>
    <div v-else class="no-playlist-message">Select a playlist</div>
    <div id="track-list-body">
      <Spinner v-if="loading" />
      <TrackItem v-else v-for="track in tracks" :key="track.position" :track="track" />
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

button:hover:not(:disabled) {
  border-color: var(--sp-text);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
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
