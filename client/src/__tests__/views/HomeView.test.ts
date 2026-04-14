import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/HomeView.vue'
import PlaylistList from '@/components/PlaylistList.vue'
import TrackList from '@/components/TrackList.vue'

vi.mock('@/composables/useSpotifyPlayer', () => ({
  initSpotifyPlayer: vi.fn(),
}))

function mountComponent() {
  return mount(HomeView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: {
        PlaylistList: { template: '<div class="playlist-list-stub" />', emits: ['playlist-selected'] },
        TrackList: { template: '<div class="track-list-stub" />', emits: ['back'] },
        PlayerComponent: { template: '<div class="player-stub" />' },
      },
    },
  })
}

describe('HomeView mobile panel toggle', () => {
  it('applies mobile-hidden to main-content on initial render', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('#main-content').classes()).toContain('mobile-hidden')
    expect(wrapper.find('#sidebar-left').classes()).not.toContain('mobile-hidden')
  })

  it('switches to track view when PlaylistList emits playlist-selected', async () => {
    const wrapper = mountComponent()
    await wrapper.findComponent(PlaylistList).vm.$emit('playlist-selected')
    expect(wrapper.find('#sidebar-left').classes()).toContain('mobile-hidden')
    expect(wrapper.find('#main-content').classes()).not.toContain('mobile-hidden')
  })

  it('returns to playlist view when TrackList emits back', async () => {
    const wrapper = mountComponent()
    await wrapper.findComponent(PlaylistList).vm.$emit('playlist-selected')
    await wrapper.findComponent(TrackList).vm.$emit('back')
    expect(wrapper.find('#main-content').classes()).toContain('mobile-hidden')
    expect(wrapper.find('#sidebar-left').classes()).not.toContain('mobile-hidden')
  })

  it('renders PlaylistList, TrackList, and PlayerComponent', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.playlist-list-stub').exists()).toBe(true)
    expect(wrapper.find('.track-list-stub').exists()).toBe(true)
    expect(wrapper.find('.player-stub').exists()).toBe(true)
  })
})
