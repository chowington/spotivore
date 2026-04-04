import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useSpotivoreStore } from '@/stores/spotivore'
import TrackItem from '@/components/TrackItem.vue'

const mockPlayTrack = vi.fn()

vi.mock('@/composables/useSpotifyPlayer', () => ({
  playTrack: (...args: unknown[]) => mockPlayTrack(...args),
}))

const track = {
  position: 2,
  spotify_id: 'tr1',
  name: 'Test Track',
  artists: ['Artist One', 'Artist Two'],
  album: 'Test Album',
  uri: 'spotify:track:tr1',
}

function mountComponent(nowPlaying?: { trackId: string; linkedFromId: string | null } | null) {
  return mount(TrackItem, {
    props: { track },
    global: {
      plugins: [createTestingPinia({
        createSpy: vi.fn,
        initialState: nowPlaying ? { spotivore: { nowPlaying: {
          trackId: nowPlaying.trackId,
          linkedFromId: nowPlaying.linkedFromId,
          trackName: 'N',
          artists: [],
          albumName: 'A',
          albumArtUrl: null,
          uri: 'spotify:track:x',
          durationMs: 10000,
        }}} : {},
      })],
      stubs: { Icon: { template: '<span />' } },
    },
  })
}

describe('TrackItem', () => {
  beforeEach(() => {
    mockPlayTrack.mockReset()
    mockPlayTrack.mockResolvedValue(undefined)
  })

  it('renders track name', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Test Track')
  })

  it('renders artists joined by comma', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Artist One, Artist Two')
  })

  it('renders position as 1-indexed', () => {
    const wrapper = mountComponent()
    // position is 2, should display 3
    expect(wrapper.text()).toContain('3')
  })

  it('has current class when nowPlaying.trackId matches spotify_id', () => {
    const wrapper = mountComponent({ trackId: 'tr1', linkedFromId: null })
    expect(wrapper.find('.track-item').classes()).toContain('current')
  })

  it('has current class when nowPlaying.linkedFromId matches spotify_id', () => {
    const wrapper = mountComponent({ trackId: 'other', linkedFromId: 'tr1' })
    expect(wrapper.find('.track-item').classes()).toContain('current')
  })

  it('does not have current class when neither id matches', () => {
    const wrapper = mountComponent({ trackId: 'other', linkedFromId: 'also-other' })
    expect(wrapper.find('.track-item').classes()).not.toContain('current')
  })

  it('does not have current class when nowPlaying is null', () => {
    const wrapper = mountComponent(null)
    expect(wrapper.find('.track-item').classes()).not.toContain('current')
  })

  it('calls playTrack on double-click', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.track-item').trigger('dblclick')
    await flushPromises()
    expect(mockPlayTrack).toHaveBeenCalledWith('spotify:track:tr1')
  })

  it('shows play button on mouseenter', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.track-item').trigger('mouseenter')
    expect(wrapper.find('.play-btn').exists()).toBe(true)
  })

  it('hides play button on mouseleave', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.track-item').trigger('mouseenter')
    await wrapper.find('.track-item').trigger('mouseleave')
    expect(wrapper.find('.play-btn').exists()).toBe(false)
  })

  it('calls playTrack when play button is clicked', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.track-item').trigger('mouseenter')
    await wrapper.find('.play-btn').trigger('click')
    await flushPromises()
    expect(mockPlayTrack).toHaveBeenCalledWith('spotify:track:tr1')
  })
})
