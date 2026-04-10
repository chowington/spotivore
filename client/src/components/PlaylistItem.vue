<script setup lang="ts">
import { computed } from 'vue'
import { useSpotivoreStore, type Playlist } from '@/stores/spotivore'

const props = defineProps<{ playlist: Playlist }>()
const emit = defineEmits<{ (e: 'select'): void }>()

const store = useSpotivoreStore()

const selected = computed(() => store.selectedPlaylist?.spotify_id === props.playlist.spotify_id)
const playing = computed(() => store.sessionPlaylistId === props.playlist.spotify_id)
</script>

<template>
  <div
    class="playlist-item"
    :class="{ active: selected, playing: playing }"
    :title="playlist.name"
    @click="emit('select')"
  >
    <div class="playlist-text">
      <span class="playlist-name">{{ playlist.name }}</span>
      <span class="playlist-meta">{{ playlist.track_count }} tracks</span>
    </div>
  </div>
</template>

<style scoped>
.playlist-item {
  display: flex;
  align-items: center;
  padding: 10px 16px 10px 20px;
  margin: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--sp-text-muted);
  border-left: 3px solid transparent;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.playlist-item:hover {
  background: var(--sp-surface-high);
  color: var(--sp-text);
}

.playlist-item.active {
  color: var(--sp-text);
  background: var(--sp-surface-high);
  border-left-color: var(--sp-primary-light);
}

.playlist-item.playing {
  color: var(--sp-primary-light);
}

.playlist-item.playing:hover {
  color: var(--sp-primary);
}

.playlist-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.playlist-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-meta {
  font-size: 11px;
  color: var(--sp-text-muted);
  opacity: 0.7;
}

.playlist-item.active .playlist-meta,
.playlist-item:hover .playlist-meta {
  opacity: 1;
}
</style>
