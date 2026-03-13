<script setup lang="ts">
import { onMounted } from 'vue'
import PlaylistList from '@/components/PlaylistList.vue'
import TrackList from '@/components/TrackList.vue'
import PlayerComponent from '@/components/PlayerComponent.vue'
import { initSpotifyPlayer } from '@/composables/useSpotifyPlayer'

onMounted(() => {
  initSpotifyPlayer()
})
</script>

<template>
  <div id="spotivore-app">
    <div id="main-row">
      <div id="sidebar-left">
        <PlaylistList />
      </div>
      <div id="main-content">
        <TrackList />
      </div>
    </div>
    <div id="player-row">
      <PlayerComponent />
    </div>
  </div>
</template>

<style scoped>
#spotivore-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--sp-bg);
  color: var(--sp-text);
}

#main-row {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar-left {
  width: 260px;
  background: #000;
  overflow-y: auto;
  border-right: 1px solid var(--sp-border);
  flex-shrink: 0;
}

#main-content {
  flex: 1;
  overflow-y: auto;
}

#player-row {
  height: 90px;
  border-top: 1px solid var(--sp-border);
  background: var(--sp-surface);
  flex-shrink: 0;
}
</style>
