<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSpotivoreStore } from '@/stores/spotivore'
import { getPlaylists } from '@/api/backend'
import PlaylistItem from './PlaylistItem.vue'

const store = useSpotivoreStore()
const loading = ref(false)

async function refresh() {
  store.playlists = []
  loading.value = true
  const playlists = await getPlaylists()
  loading.value = false
  if (playlists) store.playlists = playlists
}

onMounted(() => {
  refresh()
})
</script>

<template>
  <div id="playlist-list">
    <div class="header-caps" @click="refresh">Playlists</div>
    <div v-if="loading" class="spinner" />
    <PlaylistItem
      v-else
      v-for="playlist in store.playlists"
      :key="playlist.spotify_id"
      :playlist="playlist"
    />
  </div>
</template>

<style scoped>
#playlist-list {
  padding: 8px 0;
}

.header-caps {
  padding: 16px 16px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--sp-text-muted);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.header-caps:hover {
  color: var(--sp-text);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--sp-text-muted);
  border-top-color: var(--sp-text);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 16px auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
