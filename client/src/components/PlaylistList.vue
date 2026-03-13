<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSpotivoreStore } from '@/stores/spotivore'
import { getPlaylists } from '@/api/backend'
import PlaylistItem from './PlaylistItem.vue'
import Spinner from './Spinner.vue'

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
    <Spinner v-if="loading" />
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

</style>
