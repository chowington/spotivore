<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
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

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(checkMarquees)
    : null
  watch(miniTrackNameEl, (el, oldEl) => {
    if (oldEl && oldEl !== el) ro?.unobserve(oldEl)
    if (el && ro) ro.observe(el)
  }, { immediate: true })
  watch(fsTrackNameEl, (el, oldEl) => {
    if (oldEl && oldEl !== el) ro?.unobserve(oldEl)
    if (el && ro) ro.observe(el)
  }, { immediate: true })
  watch(fullscreenOpen, (open) => { if (open) nextTick(checkMarquees) })
  onUnmounted(() => {
    if (ro) ro.disconnect()
  })
})
onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})

const paused = computed(() => store.paused)
const nowPlaying = computed(() => store.nowPlaying)
const shuffleEnabled = computed(() => store.shuffleEnabled)

// Interpolate position between SDK state-change events so the scrubber moves smoothly.
// Skip interpolation briefly after a track change — the SDK fires multiple rapid events with
// non-monotonic positions during transitions, which causes the timer to visibly stutter.
const TRACK_CHANGE_SETTLE_MS = 1500
const displayPositionMs = computed(() => {
  if (!nowPlaying.value) return 0
  if (paused.value) return store.positionMs
  if (now.value - store.trackChangedAt < TRACK_CHANGE_SETTLE_MS) return store.positionMs
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
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seek(Math.floor(ratio * nowPlaying.value.durationMs))
}

function onScrubberTouch(e: TouchEvent) {
  if (!nowPlaying.value) return
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const touch = e.changedTouches[0]
  const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
  seek(Math.floor(ratio * nowPlaying.value.durationMs))
}

// Autoscrolling track names
const miniTrackNameEl = ref<HTMLElement | null>(null)
const fsTrackNameEl = ref<HTMLElement | null>(null)
const miniScrolling = ref(false)
const fsScrolling = ref(false)

function applyMarquee(el: HTMLElement, scrollingRef: typeof miniScrolling) {
  const overflow = el.scrollWidth - el.clientWidth
  scrollingRef.value = overflow > 0
  if (overflow > 0) {
    const duration = Math.max(5, overflow / 30)
    el.style.setProperty('--marquee-scroll', `${overflow}px`)
    el.style.setProperty('--marquee-duration', `${duration}s`)
  }
}

function checkMarquees() {
  if (miniTrackNameEl.value) applyMarquee(miniTrackNameEl.value, miniScrolling)
  if (fsTrackNameEl.value) applyMarquee(fsTrackNameEl.value, fsScrolling)
}

watch(nowPlaying, () => nextTick(checkMarquees))

// Fullscreen player
const fullscreenOpen = ref(false)
let swipeTouchStartY = 0

function openFullscreen() {
  if (!nowPlaying.value) return
  if (window.innerWidth <= 640) {
    fullscreenOpen.value = true
  }
}

function onFullscreenTouchStart(e: TouchEvent) {
  swipeTouchStartY = e.touches[0].clientY
}

function onFullscreenTouchEnd(e: TouchEvent) {
  if (e.changedTouches[0].clientY - swipeTouchStartY > 80) {
    fullscreenOpen.value = false
  }
}
</script>

<template>
  <!-- Mini player bar -->
  <div id="player-wrapper">
    <!-- Song info — tapping opens fullscreen on mobile -->
    <div id="song-info" @click="openFullscreen">
      <img v-if="nowPlaying?.albumArtUrl" :src="nowPlaying.albumArtUrl" id="album-art" />
      <div v-if="nowPlaying" class="track-meta">
        <span ref="miniTrackNameEl" class="now-track-name" :class="{ scrolling: miniScrolling }">{{ nowPlaying.trackName }}</span>
        <span class="now-track-artists">{{ nowPlaying.artists.join(', ') }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div id="player-controls">
      <div id="control-buttons">
        <div class="side-controls left-controls mobile-hide">
          <button class="control-btn" @click="previousTrack" title="Previous">
            <Icon icon="mdi:skip-previous" />
          </button>
        </div>
        <button id="play-button" @click="togglePlay" :title="paused ? 'Play' : 'Pause'">
          <Icon :icon="paused ? 'mdi:play' : 'mdi:pause'" />
        </button>
        <div class="side-controls right-controls mobile-hide">
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
      <div id="scrubber-row" class="mobile-hide">
        <span class="time-label">{{ formatTime(displayPositionMs) }}</span>
        <div id="scrubber-wrapper" @click="onScrubberClick">
          <div id="scrubber-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="time-label">{{ formatTime(nowPlaying?.durationMs ?? 0) }}</span>
      </div>
    </div>

    <!-- Volume (placeholder) -->
    <div id="volume-control" class="mobile-hide"></div>
  </div>

  <!-- Fullscreen player overlay -->
  <Transition name="slide-up">
    <div
      v-if="fullscreenOpen"
      class="fs-player"
      @touchstart.passive="onFullscreenTouchStart"
      @touchend.passive="onFullscreenTouchEnd"
    >
      <div class="fs-header">
        <button class="fs-close-btn" @click="fullscreenOpen = false" title="Close" aria-label="Close">
          <Icon icon="mdi:chevron-down" />
        </button>
        <span class="fs-label">Now Playing</span>
        <div class="fs-header-spacer" />
      </div>

      <div class="fs-art-wrapper">
        <img
          v-if="nowPlaying?.albumArtUrl"
          :src="nowPlaying.albumArtUrl"
          class="fs-art"
        />
        <div v-else class="fs-art-placeholder" />
      </div>

      <div class="fs-track-info">
        <span ref="fsTrackNameEl" class="fs-track-name" :class="{ scrolling: fsScrolling }">{{ nowPlaying?.trackName ?? '—' }}</span>
        <span class="fs-track-artists">{{ nowPlaying?.artists.join(', ') ?? '' }}</span>
      </div>

      <div class="fs-scrubber-section">
        <div
          class="fs-scrubber-bar"
          @click="onScrubberClick"
          @touchend.prevent.stop="onScrubberTouch"
        >
          <div class="fs-scrubber-fill" :style="{ width: progressPercent + '%' }" />
        </div>
        <div class="fs-time-row">
          <span class="time-label">{{ formatTime(displayPositionMs) }}</span>
          <span class="time-label">{{ formatTime(nowPlaying?.durationMs ?? 0) }}</span>
        </div>
      </div>

      <div class="fs-controls">
        <!-- spacer to balance shuffle button -->
        <div class="fs-controls-spacer" />
        <button class="fs-control-btn" @click="previousTrack" title="Previous" aria-label="Previous">
          <Icon icon="mdi:skip-previous" />
        </button>
        <button class="fs-play-btn" @click="togglePlay" :title="paused ? 'Play' : 'Pause'">
          <Icon :icon="paused ? 'mdi:play' : 'mdi:pause'" />
        </button>
        <button class="fs-control-btn" @click="nextTrack" title="Next" aria-label="Next">
          <Icon icon="mdi:skip-next" />
        </button>
        <button
          class="fs-control-btn"
          :class="{ 'shuffle-inactive': !shuffleEnabled, 'shuffle-active': shuffleEnabled }"
          @click="toggleShuffle"
          title="Toggle shuffle"
          aria-label="Toggle shuffle"
          :aria-pressed="shuffleEnabled"
        >
          <Icon icon="mdi:shuffle" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ===== Mini player ===== */

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
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--sp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-track-name.scrolling {
  overflow: visible;
  text-overflow: clip;
  animation: track-marquee var(--marquee-duration) linear infinite;
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
  color: var(--sp-primary-light);
}

.control-btn.shuffle-active:hover {
  color: var(--sp-primary);
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
  background: var(--sp-primary-light);
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
  background: var(--sp-primary);
}

#volume-control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  #player-wrapper {
    padding: 0 12px;
    gap: 10px;
  }

  .mobile-hide {
    display: none !important;
  }

  #song-info {
    cursor: pointer;
  }

  #album-art {
    width: 40px;
    height: 40px;
  }

  #player-controls {
    flex: 0 0 auto;
  }

  #control-buttons {
    gap: 0;
    width: auto;
  }

  #play-button {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }
}

/* ===== Fullscreen player ===== */

.fs-player {
  position: fixed;
  inset: 0;
  height: 100vh;
  height: 100dvh;
  background: var(--sp-bg);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 28px 40px;
  padding-top: max(24px, env(safe-area-inset-top, 0px));
  padding-bottom: max(40px, env(safe-area-inset-bottom, 0px));
  overflow: hidden;
}

.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fs-close-btn {
  background: transparent;
  border: none;
  color: var(--sp-text);
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  line-height: 1;
}

.fs-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--sp-text-muted);
}

.fs-header-spacer {
  width: 32px;
}

.fs-art-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.fs-art {
  width: 100%;
  max-height: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
}

.fs-art-placeholder {
  width: 100%;
  aspect-ratio: 1;
  background: var(--sp-surface-high);
  border-radius: 8px;
}

.fs-track-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fs-track-name {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--sp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs-track-name.scrolling {
  overflow: visible;
  text-overflow: clip;
  animation: track-marquee var(--marquee-duration) linear infinite;
}

.fs-track-artists {
  font-size: 14px;
  color: var(--sp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs-scrubber-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fs-scrubber-bar {
  width: 100%;
  height: 4px;
  background: #535353;
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.fs-scrubber-bar:active {
  height: 6px;
}

.fs-scrubber-fill {
  height: 100%;
  background: var(--sp-text);
  border-radius: 2px;
  pointer-events: none;
}

.fs-scrubber-bar:active .fs-scrubber-fill {
  background: var(--sp-primary);
}

.fs-time-row {
  display: flex;
  justify-content: space-between;
}

.fs-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fs-control-btn {
  background: transparent;
  border: none;
  color: var(--sp-text-muted);
  font-size: 32px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.1s;
}

.fs-control-btn:hover {
  color: var(--sp-text);
}

.fs-control-btn.shuffle-inactive {
  opacity: 0.4;
}

.fs-control-btn.shuffle-inactive:hover {
  opacity: 1;
}

.fs-control-btn.shuffle-active {
  color: var(--sp-primary-light);
}

.fs-play-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--sp-text);
  color: #000;
  border: none;
  font-size: 32px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, background 0.1s;
}

.fs-play-btn:hover {
  background: var(--sp-primary-light);
  transform: scale(1.06);
}

.fs-controls-spacer {
  width: 40px;
}

/* Marquee scroll animation */
@keyframes track-marquee {
  0%,
  20% {
    transform: translateX(0);
  }
  80%,
  100% {
    transform: translateX(calc(-1 * var(--marquee-scroll)));
  }
}

/* Slide-up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
