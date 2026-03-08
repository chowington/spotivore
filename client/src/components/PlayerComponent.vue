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
        <button id="play-button" @click="store.togglePaused()" :title="paused ? 'Play' : 'Pause'">
          {{ paused ? '▶' : '⏸' }}
        </button>
      </div>
      <div id="scrubber-wrapper">
        <div id="scrubber-line"></div>
      </div>
    </div>
    <div id="volume-control"></div>
  </div>
</template>

<style scoped>
#player-wrapper {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  gap: 16px;
}

#song-info {
  flex: 1;
}

#player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

#play-button-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

#play-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--sp-text);
  color: #000;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, background 0.1s;
  flex-shrink: 0;
}

#play-button:hover {
  background: var(--sp-green-light);
  transform: scale(1.06);
}

#scrubber-wrapper {
  width: 100%;
  max-width: 500px;
  padding: 4px 0;
  cursor: pointer;
}

#scrubber-line {
  height: 4px;
  background: #535353;
  border-radius: 2px;
}

#volume-control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}
</style>
