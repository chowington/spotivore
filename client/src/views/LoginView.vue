<script setup lang="ts">
import { getAuthUrl } from '@/api/backend'

async function connectSpotify() {
  window.location.href = await getAuthUrl()
}
</script>

<template>
  <div id="login-page">
    <h1>Spotivore</h1>
    <button @click="connectSpotify">Connect to Spotify</button>
  </div>
</template>

<style scoped>
#login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1.5rem;
}
</style>
