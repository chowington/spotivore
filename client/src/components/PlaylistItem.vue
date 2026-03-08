<script setup lang="ts">
import { computed } from 'vue'
import { useSpotivoreStore, type Playlist } from '@/stores/spotivore'

const props = defineProps<{ playlist: Playlist }>()

const store = useSpotivoreStore()

const selected = computed(() => store.selectedPlaylist?.spotify_id === props.playlist.spotify_id)
</script>

<template>
  <div
    class="playlist-item"
    :class="{ active: selected }"
    :title="playlist.name"
    @click="store.selectPlaylist(playlist)"
  >
    <span
      v-if="playlist.has_local_data"
      class="dot-indicator"
      title="Synced to Spotivore"
    ></span>
    <span class="playlist-name">{{ playlist.name }}</span>
  </div>
</template>

<style scoped>
.playlist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  margin: 1px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--sp-text-muted);
  font-size: 14px;
  transition: background 0.1s, color 0.1s;
}

.playlist-item:hover {
  background: var(--sp-surface-high);
  color: var(--sp-text);
}

.playlist-item.active {
  color: var(--sp-text);
  background: var(--sp-surface-high);
}

.playlist-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sp-green);
  flex-shrink: 0;
}
</style>
