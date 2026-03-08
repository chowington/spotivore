<script setup lang="ts">
import PlaylistList from '@/components/PlaylistList.vue'
import TrackList from '@/components/TrackList.vue'
import PlayerComponent from '@/components/PlayerComponent.vue'
</script>

<template>
  <div id="spotivore-app">
    <div id="main-row">
      <div id="sidebar-left" class="sidebar">
        <PlaylistList />
      </div>
      <div id="main-content">
        <TrackList />
      </div>
      <div id="sidebar-right" class="sidebar"></div>
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
}

#main-row {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar-left {
  width: 250px;
  overflow-y: auto;
  border-right: 1px solid #333;
  flex-shrink: 0;
}

#sidebar-right {
  width: 200px;
  border-left: 1px solid #333;
  flex-shrink: 0;
}

#main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

#player-row {
  height: 80px;
  border-top: 1px solid #333;
  flex-shrink: 0;
}
</style>
