<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useSpotivoreStore } from '@/stores/spotivore'
import { togglePlay, previousTrack, nextTrack, seek, toggleShuffle } from '@/composables/useSpotifyPlayer'

const store = useSpotivoreStore()

// Tick every 500ms so the scrubber animates smoothly during playback
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 500)
})
onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})

const paused = computed(() => store.paused)
const nowPlaying = computed(() => store.nowPlaying)
const shuffleEnabled = computed(() => store.shuffleEnabled)

// Interpolate position between SDK state-change events so the scrubber moves smoothly.
// Skip interpolation for 1s after a track change — the SDK fires multiple rapid events with
// non-monotonic positions during transitions, which causes the timer to visibly stutter.
const displayPositionMs = computed(() => {
  if (!nowPlaying.value) return 0
  if (paused.value) return store.positionMs
  if (now.value - store.trackChangedAt < 1500) return store.positionMs
  return Math.min(
    store.positionMs + (now.value - store.lastPositionTimestamp),
    nowPlaying.value.durationMs,
  )
})

const progressPercent = computed(() => {
  if (!nowPlaying.value || nowPlaying.value.durationMs === 0) return 0
  return (displayPositionMs.value / nowPlaying.value.durationMs) * 100
})

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function onScrubberClick(e: MouseEvent) {
  if (!nowPlaying.value) return
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  seek(Math.floor(ratio * nowPlaying.value.durationMs))
}
</script>

<template>
  <div id="player-wrapper">
    <!-- Song info -->
    <div id="song-info">
      <img v-if="nowPlaying?.albumArtUrl" :src="nowPlaying.albumArtUrl" id="album-art" />
      <div v-if="nowPlaying" class="track-meta">
        <span class="now-track-name">{{ nowPlaying.trackName }}</span>
        <span class="now-track-artists">{{ nowPlaying.artists.join(', ') }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div id="player-controls">
      <div id="control-buttons">
        <div class="side-controls left-controls">
          <button class="control-btn" @click="previousTrack" title="Previous">
            <Icon icon="mdi:skip-previous" />
          </button>
        </div>
        <button id="play-button" @click="togglePlay" :title="paused ? 'Play' : 'Pause'">
          <Icon :icon="paused ? 'mdi:play' : 'mdi:pause'" />
        </button>
        <div class="side-controls right-controls">
          <button class="control-btn" @click="nextTrack" title="Next">
            <Icon icon="mdi:skip-next" />
          </button>
          <button
            class="control-btn"
            :class="{ 'shuffle-inactive': !shuffleEnabled, 'shuffle-active': shuffleEnabled }"
            @click="toggleShuffle"
            title="Toggle shuffle"
          >
            <Icon icon="mdi:shuffle" />
          </button>
        </div>
      </div>
      <div id="scrubber-row">
        <span class="time-label">{{ formatTime(displayPositionMs) }}</span>
        <div id="scrubber-wrapper" @click="onScrubberClick">
          <div id="scrubber-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="time-label">{{ formatTime(nowPlaying?.durationMs ?? 0) }}</span>
      </div>
    </div>

    <!-- Volume (placeholder) -->
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
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  min-width: 0;
}

#album-art {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.track-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.now-track-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--sp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-track-artists {
  font-size: 11px;
  color: var(--sp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

#control-buttons {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 20px;
}

.side-controls {
  flex: 1;
  display: flex;
  align-items: center;
  align-self: center;
  gap: 12px;
}

.left-controls {
  justify-content: flex-end;
}

.right-controls {
  justify-content: flex-start;
}

.control-btn {
  background: transparent;
  border: none;
  color: var(--sp-text-muted);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  transition: color 0.1s;
}

.control-btn:hover {
  color: var(--sp-text);
}

.control-btn.shuffle-inactive {
  opacity: 0.4;
}

.control-btn.shuffle-inactive:hover {
  opacity: 1;
}

.control-btn.shuffle-active {
  color: var(--sp-green);
}

.control-btn.shuffle-active:hover {
  color: var(--sp-green-light);
}

#play-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--sp-text);
  color: #000;
  border: none;
  font-size: 20px;
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

#scrubber-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 500px;
}

.time-label {
  font-size: 11px;
  color: var(--sp-text-muted);
  flex-shrink: 0;
  width: 32px;
  text-align: center;
}

#scrubber-wrapper {
  flex: 1;
  height: 4px;
  background: #535353;
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  transition: height 0.1s;
}

#scrubber-wrapper:hover {
  height: 6px;
}

#scrubber-fill {
  height: 100%;
  background: var(--sp-text);
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.1s;
}

#scrubber-wrapper:hover #scrubber-fill {
  background: var(--sp-green);
}

#volume-control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}
</style>
