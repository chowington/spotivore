<script setup lang="ts">
import { onMounted } from 'vue'
import { useSpotivoreStore } from '@/stores/spotivore'
import PlaylistItem from './PlaylistItem.vue'

const store = useSpotivoreStore()

// Fetch the user's playlists from Spotify (via backend) and cross-reference
// with Spotivore's local store to mark playlists that have local data.
// These functions are similar to the functions in SublistManager and should
// be refactored eventually.
async function refresh() {
  store.playlists = []

  const [spotifyRes, spotivoreRes] = await Promise.all([
    fetch('/api/spotify/playlists/'),
    fetch('/api/playlists/'),
  ])

  const spotifyData = await spotifyRes.json()
  const spotivoreData = await spotivoreRes.json()

  // Build a set of spotify_ids that have been synced into Spotivore
  const localIds = new Set<string>(spotivoreData.map((p: { spotify_id: string }) => p.spotify_id))

  store.playlists = spotifyData.map(
    (p: { spotify_id: string; name: string; track_count: number }) => ({
      spotify_id: p.spotify_id,
      name: p.name,
      track_count: p.track_count,
      has_local_data: localIds.has(p.spotify_id),
    }),
  )
}

onMounted(() => {
  refresh()
})
</script>

<template>
  <div id="playlist-list">
    <div class="header-caps sidebar-item" @click="refresh">PLAYLISTS</div>
    <PlaylistItem
      v-for="playlist in store.playlists"
      :key="playlist.spotify_id"
      :playlist="playlist"
    />
  </div>
</template>
