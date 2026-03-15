<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Track } from '@/stores/spotivore'
import { useSpotivoreStore } from '@/stores/spotivore'
import { playTrack } from '@/composables/useSpotifyPlayer'

const props = defineProps<{ track: Track }>()

const store = useSpotivoreStore()
const isCurrent = computed(() => {
  const np = store.nowPlaying
  if (!np) return false
  const thisTrackId = props.track.spotify_id
  return np.trackId === thisTrackId || np.linkedFromId === thisTrackId
})
const isHovered = ref(false)

async function onPlay() {
  if (!props.track.uri) return
  await playTrack(props.track.uri)
}
</script>

<template>
  <div
    class="track-item"
    :class="{ current: isCurrent }"
    @dblclick="onPlay"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <span class="track-position">
      <button v-if="isHovered" class="play-btn" @click.stop="onPlay">
        <Icon icon="mdi:play" />
      </button>
      <span v-else-if="isCurrent" class="playing-icon"><Icon icon="mdi:music-note" /></span>
      <span v-else>{{ track.position + 1 }}</span>
    </span>
    <div class="track-info">
      <span class="track-name">{{ track.name }}</span>
      <span v-if="track.artists.length" class="track-artists">{{ track.artists.join(', ') }}</span>
    </div>
  </div>
</template>

<style scoped>
.track-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: default;
  transition: background 0.1s;
}

.track-item:hover {
  background: var(--sp-surface-high);
}

.track-item.current .track-name {
  color: var(--sp-green);
}

.track-position {
  width: 20px;
  text-align: right;
  font-size: 13px;
  color: var(--sp-text-muted);
  flex-shrink: 0;
}

.playing-icon {
  color: var(--sp-green);
  font-size: 14px;
}

.play-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--sp-text);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
}

.play-btn:hover {
  color: var(--sp-green);
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.track-name {
  font-size: 14px;
  color: var(--sp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artists {
  font-size: 12px;
  color: var(--sp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
