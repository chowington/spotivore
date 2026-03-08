<script setup lang="ts">
import type { Track } from '@/stores/spotivore'

defineProps<{ track: Track }>()
</script>

<template>
  <div class="track-item">
    <span class="track-name">{{ track.name }}</span>
    <span class="track-artists">{{ track.artists.join(', ') }}</span>
  </div>
</template>
