import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import { useSpotivoreStore } from '@/stores/spotivore'
import PlayerComponent from '@/components/PlayerComponent.vue'

const mockTogglePlay = vi.fn()
const mockPreviousTrack = vi.fn()
const mockNextTrack = vi.fn()
const mockSeek = vi.fn()
const mockToggleShuffle = vi.fn()

vi.mock('@/composables/useSpotifyPlayer', () => ({
  togglePlay: () => mockTogglePlay(),
  previousTrack: () => mockPreviousTrack(),
  nextTrack: () => mockNextTrack(),
  seek: (ms: number) => mockSeek(ms),
  toggleShuffle: () => mockToggleShuffle(),
}))

const nowPlaying = {
  trackId: 'tr1',
  linkedFromId: null,
  trackName: 'My Song',
  artists: ['Singer', 'Band'],
  albumName: 'The Album',
  albumArtUrl: 'https://example.com/art.jpg',
  uri: 'spotify:track:tr1',
  durationMs: 180000,
}

function mountComponent(initialState: Record<string, unknown> = {}) {
  return mount(PlayerComponent, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, initialState })],
      stubs: { Icon: { template: '<span class="icon-stub" />' } },
    },
  })
}

// jsdom doesn't implement ResizeObserver; stub it as a no-op for all tests.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

describe('PlayerComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockTogglePlay.mockReset()
    mockPreviousTrack.mockReset()
    mockNextTrack.mockReset()
    mockSeek.mockReset()
    mockToggleShuffle.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatTime', () => {
    it('formats 0ms as 0:00', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, positionMs: 0, paused: true } })
      await flushPromises()
      // The time labels show displayPositionMs and durationMs
      const labels = wrapper.findAll('.time-label')
      expect(labels[0].text()).toBe('0:00')
    })

    it('formats 65000ms as 1:05', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, durationMs: 65000 }, positionMs: 65000, paused: true } })
      await flushPromises()
      const labels = wrapper.findAll('.time-label')
      expect(labels[1].text()).toBe('1:05')
    })

    it('formats 3600000ms as 60:00', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, durationMs: 3600000 }, positionMs: 3600000, paused: true } })
      await flushPromises()
      const labels = wrapper.findAll('.time-label')
      expect(labels[1].text()).toBe('60:00')
    })
  })

  describe('song info display', () => {
    it('renders album art when albumArtUrl is set', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      expect(wrapper.find('#album-art').exists()).toBe(true)
      expect(wrapper.find('#album-art').attributes('src')).toBe('https://example.com/art.jpg')
    })

    it('does not render album art when albumArtUrl is null', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, albumArtUrl: null } } })
      expect(wrapper.find('#album-art').exists()).toBe(false)
    })

    it('renders track name', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      expect(wrapper.find('.now-track-name').text()).toBe('My Song')
    })

    it('renders artists joined by comma', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      expect(wrapper.find('.now-track-artists').text()).toBe('Singer, Band')
    })

    it('does not render track meta when nowPlaying is null', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: null } })
      expect(wrapper.find('.track-meta').exists()).toBe(false)
    })
  })

  describe('player controls', () => {
    it('play button calls togglePlay', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#play-button').trigger('click')
      expect(mockTogglePlay).toHaveBeenCalled()
    })

    it('previous button calls previousTrack', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('button[title="Previous"]').trigger('click')
      expect(mockPreviousTrack).toHaveBeenCalled()
    })

    it('next button calls nextTrack', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('button[title="Next"]').trigger('click')
      expect(mockNextTrack).toHaveBeenCalled()
    })

    it('shuffle button calls toggleShuffle', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('button[title="Toggle shuffle"]').trigger('click')
      expect(mockToggleShuffle).toHaveBeenCalled()
    })
  })

  describe('shuffle button class', () => {
    it('has shuffle-inactive class when shuffle is off', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, shuffleEnabled: false } })
      expect(wrapper.find('button[title="Toggle shuffle"]').classes()).toContain('shuffle-inactive')
    })

    it('has shuffle-active class when shuffle is on', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, shuffleEnabled: true } })
      expect(wrapper.find('button[title="Toggle shuffle"]').classes()).toContain('shuffle-active')
    })
  })

  describe('scrubber', () => {
    it('calls seek with correct position on scrubber click', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, positionMs: 0, paused: true } })
      const scrubber = wrapper.find('#scrubber-wrapper')
      // Simulate getBoundingClientRect returning a 200px wide bar at x=0
      const el = scrubber.element as HTMLElement
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 0, right: 200, width: 200, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: () => {}
      })
      // Click at x=90 → ratio=0.45 → 0.45 * 180000 = 81000ms
      await scrubber.trigger('click', { clientX: 90 })
      expect(mockSeek).toHaveBeenCalledWith(81000)
    })

    it('does not call seek when nowPlaying is null', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: null } })
      const scrubber = wrapper.find('#scrubber-wrapper')
      await scrubber.trigger('click', { clientX: 50 })
      expect(mockSeek).not.toHaveBeenCalled()
    })
  })

  describe('progressPercent', () => {
    it('returns 0 when nowPlaying is null', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: null } })
      const fill = wrapper.find('#scrubber-fill')
      expect(fill.attributes('style')).toContain('width: 0%')
    })

    it('returns 0 when durationMs is 0', () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, durationMs: 0 }, positionMs: 0, paused: true } })
      const fill = wrapper.find('#scrubber-fill')
      expect(fill.attributes('style')).toContain('width: 0%')
    })

    it('reflects correct progress when paused', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, durationMs: 100000 }, positionMs: 50000, paused: true } })
      await flushPromises()
      const fill = wrapper.find('#scrubber-fill')
      expect(fill.attributes('style')).toContain('width: 50%')
    })
  })

  describe('interval lifecycle', () => {
    it('starts interval on mount and clears on unmount', () => {
      vi.spyOn(global, 'setInterval')
      vi.spyOn(global, 'clearInterval')
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      expect(setInterval).toHaveBeenCalled()
      wrapper.unmount()
      expect(clearInterval).toHaveBeenCalled()
    })
  })

  describe('fullscreen player', () => {
    const originalInnerWidth = window.innerWidth

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    })

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    })

    it('does not open on desktop (innerWidth > 640)', async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-player').exists()).toBe(false)
    })

    it('opens on mobile when song-info is clicked', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-player').exists()).toBe(true)
    })

    it('shows track name in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-track-name').text()).toBe('My Song')
    })

    it('shows artists in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-track-artists').text()).toBe('Singer, Band')
    })

    it('shows album art in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-art').attributes('src')).toBe('https://example.com/art.jpg')
    })

    it('shows placeholder when no album art', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying: { ...nowPlaying, albumArtUrl: null } } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-art').exists()).toBe(false)
      expect(wrapper.find('.fs-art-placeholder').exists()).toBe(true)
    })

    it('close button hides fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      await wrapper.find('.fs-close-btn').trigger('click')
      expect(wrapper.find('.fs-player').exists()).toBe(false)
    })

    it('swipe down more than 80px closes fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      const fs = wrapper.find('.fs-player').element

      const startEvent = new Event('touchstart', { bubbles: true })
      Object.defineProperty(startEvent, 'touches', { value: [{ clientY: 100 }] })
      fs.dispatchEvent(startEvent)

      const endEvent = new Event('touchend', { bubbles: true })
      Object.defineProperty(endEvent, 'changedTouches', { value: [{ clientY: 200 }] })
      fs.dispatchEvent(endEvent)

      await nextTick()
      expect(wrapper.find('.fs-player').exists()).toBe(false)
    })

    it('swipe down less than 80px does not close fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      const fs = wrapper.find('.fs-player').element

      const startEvent = new Event('touchstart', { bubbles: true })
      Object.defineProperty(startEvent, 'touches', { value: [{ clientY: 100 }] })
      fs.dispatchEvent(startEvent)

      const endEvent = new Event('touchend', { bubbles: true })
      Object.defineProperty(endEvent, 'changedTouches', { value: [{ clientY: 150 }] })
      fs.dispatchEvent(endEvent)

      await nextTick()
      expect(wrapper.find('.fs-player').exists()).toBe(true)
    })

    it('play button works in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      await wrapper.find('.fs-play-btn').trigger('click')
      expect(mockTogglePlay).toHaveBeenCalled()
    })

    it('previous button works in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      await wrapper.find('.fs-player').find('button[title="Previous"]').trigger('click')
      expect(mockPreviousTrack).toHaveBeenCalled()
    })

    it('next button works in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      await wrapper.find('#song-info').trigger('click')
      await wrapper.find('.fs-player').find('button[title="Next"]').trigger('click')
      expect(mockNextTrack).toHaveBeenCalled()
    })

    it('shuffle button has shuffle-inactive class when off', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, shuffleEnabled: false } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-player').find('button[title="Toggle shuffle"]').classes()).toContain('shuffle-inactive')
    })

    it('shuffle button has shuffle-active class when on', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, shuffleEnabled: true } })
      await wrapper.find('#song-info').trigger('click')
      expect(wrapper.find('.fs-player').find('button[title="Toggle shuffle"]').classes()).toContain('shuffle-active')
    })

    it('scrubber touch calls seek in fullscreen', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying, positionMs: 0, paused: true } })
      await wrapper.find('#song-info').trigger('click')
      const scrubber = wrapper.find('.fs-scrubber-bar')
      vi.spyOn(scrubber.element as HTMLElement, 'getBoundingClientRect').mockReturnValue({
        left: 0, right: 200, width: 200, top: 0, bottom: 10, height: 10, x: 0, y: 0, toJSON: () => {},
      })
      // touch at x=90 → ratio 0.45 → 0.45 * 180000 = 81000ms
      const touchEndEvent = new Event('touchend', { bubbles: true, cancelable: true })
      Object.defineProperty(touchEndEvent, 'changedTouches', { value: [{ clientX: 90 }] })
      scrubber.element.dispatchEvent(touchEndEvent)
      await nextTick()
      expect(mockSeek).toHaveBeenCalledWith(81000)
    })
  })

  describe('autoscroll track name', () => {
    // Trigger checkMarquees by changing nowPlaying in the store, which fires the watcher.
    // scrollWidth/clientWidth are 0 by default in jsdom (no layout engine).

    async function triggerMarqueeCheck(wrapper: ReturnType<typeof mountComponent>) {
      const store = useSpotivoreStore()
      store.nowPlaying = { ...nowPlaying }
      await flushPromises()
    }

    it('does not add scrolling class when text fits', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      // scrollWidth and clientWidth are both 0 (equal) → no overflow
      await triggerMarqueeCheck(wrapper)
      expect(wrapper.find('.now-track-name').classes()).not.toContain('scrolling')
    })

    it('adds scrolling class when track name overflows', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      const el = wrapper.find('.now-track-name').element as HTMLElement
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 300 })
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
      await triggerMarqueeCheck(wrapper)
      expect(wrapper.find('.now-track-name').classes()).toContain('scrolling')
    })

    it('sets --marquee-scroll to the overflow amount', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      const el = wrapper.find('.now-track-name').element as HTMLElement
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 350 })
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
      await triggerMarqueeCheck(wrapper)
      expect(el.style.getPropertyValue('--marquee-scroll')).toBe('250px')
    })

    it('sets --marquee-duration to minimum 5s for small overflow', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      const el = wrapper.find('.now-track-name').element as HTMLElement
      // overflow = 150 → max(5, 150/30) = 5s
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 250 })
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
      await triggerMarqueeCheck(wrapper)
      expect(el.style.getPropertyValue('--marquee-duration')).toBe('5s')
    })

    it('scales --marquee-duration with large overflow', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      const el = wrapper.find('.now-track-name').element as HTMLElement
      // overflow = 600 → max(5, 600/30) = 20s
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 700 })
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
      await triggerMarqueeCheck(wrapper)
      expect(el.style.getPropertyValue('--marquee-duration')).toBe('20s')
    })

    it('removes scrolling class when nowPlaying changes to a shorter title', async () => {
      const wrapper = mountComponent({ spotivore: { nowPlaying } })
      const el = wrapper.find('.now-track-name').element as HTMLElement

      // First: long title overflows
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 300 })
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
      await triggerMarqueeCheck(wrapper)
      expect(wrapper.find('.now-track-name').classes()).toContain('scrolling')

      // Then: short title fits
      Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 80 })
      const store = useSpotivoreStore()
      store.nowPlaying = { ...nowPlaying, trackName: 'Short' }
      await flushPromises()
      expect(wrapper.find('.now-track-name').classes()).not.toContain('scrolling')
    })
  })
})
