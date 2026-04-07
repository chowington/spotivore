import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useSpotivoreStore } from '@/stores/spotivore'
import PlaylistList from '@/components/PlaylistList.vue'

const mockGetPlaylists = vi.fn()

vi.mock('@/api/backend', () => ({
  getPlaylists: (...args: unknown[]) => mockGetPlaylists(...args),
}))

const playlists = [
  { spotify_id: 'pl1', name: 'Playlist One', track_count: 3 },
  { spotify_id: 'pl2', name: 'Playlist Two', track_count: 7 },
]

function mountComponent() {
  return mount(PlaylistList, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: {
        PlaylistItem: { template: '<div class="playlist-item-stub">{{ playlist.name }}</div>', props: ['playlist'] },
        Spinner: { template: '<div class="spinner-stub" />' },
      },
    },
  })
}

describe('PlaylistList', () => {
  beforeEach(() => {
    mockGetPlaylists.mockReset()
  })

  it('calls getPlaylists on mount', async () => {
    mockGetPlaylists.mockResolvedValue(playlists)
    mountComponent()
    expect(mockGetPlaylists).toHaveBeenCalledTimes(1)
  })

  it('shows spinner while loading', async () => {
    let resolve: (v: typeof playlists) => void
    mockGetPlaylists.mockReturnValue(new Promise((r) => { resolve = r }))
    const wrapper = mountComponent()
    await flushPromises()
    // spinner should be visible (loading=true before resolve)
    // After mount, loading is set true before await
    expect(wrapper.find('.spinner-stub').exists()).toBe(true)
    resolve!(playlists)
    await flushPromises()
    expect(wrapper.find('.spinner-stub').exists()).toBe(false)
  })

  it('renders a PlaylistItem for each playlist after loading', async () => {
    mockGetPlaylists.mockResolvedValue(playlists)
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.findAll('.playlist-item-stub')).toHaveLength(2)
  })

  it('updates the store playlists', async () => {
    mockGetPlaylists.mockResolvedValue(playlists)
    const wrapper = mountComponent()
    await flushPromises()
    const store = useSpotivoreStore(wrapper.vm.$pinia)
    expect(store.playlists).toEqual(playlists)
  })

  it('clicking the header triggers a refresh', async () => {
    mockGetPlaylists.mockResolvedValue(playlists)
    const wrapper = mountComponent()
    await flushPromises()
    mockGetPlaylists.mockResolvedValue([])
    await wrapper.find('.header-caps').trigger('click')
    await flushPromises()
    expect(mockGetPlaylists).toHaveBeenCalledTimes(2)
  })

  it('does not make a second fetch if already loading', async () => {
    let resolve: (v: typeof playlists) => void
    mockGetPlaylists.mockReturnValue(new Promise((r) => { resolve = r }))
    const wrapper = mountComponent()
    // Still loading — click header
    await wrapper.find('.header-caps').trigger('click')
    resolve!(playlists)
    await flushPromises()
    // First call from onMounted; header click should be ignored
    expect(mockGetPlaylists).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for playlists when getPlaylists returns null', async () => {
    mockGetPlaylists.mockResolvedValue(null)
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.findAll('.playlist-item-stub')).toHaveLength(0)
  })

  describe('mobile navigation', () => {
    it('emits playlist-selected when a playlist item is clicked', async () => {
      mockGetPlaylists.mockResolvedValue(playlists)
      const wrapper = mountComponent()
      await flushPromises()
      await wrapper.find('.playlist-item-stub').trigger('click')
      expect(wrapper.emitted('playlist-selected')).toHaveLength(1)
    })

    it('does not emit playlist-selected when the header is clicked', async () => {
      mockGetPlaylists.mockResolvedValue(playlists)
      const wrapper = mountComponent()
      await flushPromises()
      await wrapper.find('.header-caps').trigger('click')
      expect(wrapper.emitted('playlist-selected')).toBeFalsy()
    })
  })
})
