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
    :class="{ active: selected, has_local_data: playlist.has_local_data }"
    :title="playlist.name"
    @click="store.selectPlaylist(playlist)"
  >
    <div class="playlist-item-text">
      <span
        v-if="playlist.has_local_data"
        class="dot-indicator"
        title="This playlist has local data in Spotivore"
        >•</span
      >{{ playlist.name }}
    </div>
  </div>
</template>
