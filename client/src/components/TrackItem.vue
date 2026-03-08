<script setup lang="ts">
import type { Track } from '@/stores/spotivore'

defineProps<{ track: Track }>()
</script>

<template>
  <div class="track-item">
    <span class="track-position">{{ track.position }}</span>
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

.track-position {
  width: 20px;
  text-align: right;
  font-size: 13px;
  color: var(--sp-text-muted);
  flex-shrink: 0;
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
