<script setup lang="ts">
import { computed } from 'vue'
import { useSpotivoreStore } from '@/stores/spotivore'

const store = useSpotivoreStore()

const paused = computed(() => store.paused)
</script>

<template>
  <div id="player-wrapper">
    <div id="song-info"></div>
    <div id="player-controls">
      <div id="play-button-wrapper">
        <div id="play-button">
          <button @click="store.togglePaused()">{{ paused ? '▶' : '⏸' }}</button>
        </div>
      </div>
      <div id="scrubber-wrapper">
        <div id="scrubber-line"></div>
      </div>
    </div>
    <div id="volume-control"></div>
  </div>
</template>
