<script setup lang="ts">
async function connectSpotify() {
  const res = await fetch('/api/spotify/auth-url/')
  const data = await res.json()
  window.location.href = data.authorize_url
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
