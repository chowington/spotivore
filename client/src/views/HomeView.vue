<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PlaylistList from '@/components/PlaylistList.vue'
import TrackList from '@/components/TrackList.vue'
import PlayerComponent from '@/components/PlayerComponent.vue'
import { initSpotifyPlayer } from '@/composables/useSpotifyPlayer'

onMounted(() => {
  initSpotifyPlayer()
})

const mobileView = ref<'playlists' | 'tracks'>('playlists')
function onPlaylistSelected() { mobileView.value = 'tracks' }
function onBackToPlaylists() { mobileView.value = 'playlists' }
</script>

<template>
  <div id="spotivore-app">
    <div id="main-row">
      <div id="sidebar-left" :class="{ 'mobile-hidden': mobileView === 'tracks' }">
        <PlaylistList @playlist-selected="onPlaylistSelected" />
      </div>
      <div id="main-content" :class="{ 'mobile-hidden': mobileView === 'playlists' }">
        <TrackList @back="onBackToPlaylists" />
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
  height: 100%;
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

@media (max-width: 640px) {
  #sidebar-left {
    width: 100%;
    border-right: none;
  }

  #sidebar-left.mobile-hidden,
  #main-content.mobile-hidden {
    display: none;
  }

  #player-row {
    height: 64px;
  }
}
</style>
