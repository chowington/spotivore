import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { vi } from 'vitest'
import { useSpotivoreStore } from '@/stores/spotivore'
import PlaylistItem from '@/components/PlaylistItem.vue'

const playlist = { spotify_id: 'pl1', name: 'My Playlist', track_count: 5 }

function mountComponent(selectedId?: string) {
  const wrapper = mount(PlaylistItem, {
    props: { playlist },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
    },
  })
  if (selectedId) {
    const store = useSpotivoreStore()
    store.selectedPlaylist = { spotify_id: selectedId, name: 'Other', track_count: 0 }
  }
  return wrapper
}

describe('PlaylistItem', () => {
  it('renders the playlist name', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('My Playlist')
  })

  it('has active class when playlist is selected', async () => {
    const wrapper = mount(PlaylistItem, {
      props: { playlist },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: {
          spotivore: { selectedPlaylist: playlist },
        }})],
      },
    })
    expect(wrapper.find('.playlist-item').classes()).toContain('active')
  })

  it('does not have active class when a different playlist is selected', async () => {
    const wrapper = mount(PlaylistItem, {
      props: { playlist },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, initialState: {
          spotivore: { selectedPlaylist: { spotify_id: 'other', name: 'Other', track_count: 0 } },
        }})],
      },
    })
    expect(wrapper.find('.playlist-item').classes()).not.toContain('active')
  })

  it('does not have active class when nothing is selected', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.playlist-item').classes()).not.toContain('active')
  })

  it('calls store.selectPlaylist when clicked', async () => {
    const wrapper = mount(PlaylistItem, {
      props: { playlist },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
    })
    const store = useSpotivoreStore()
    await wrapper.find('.playlist-item').trigger('click')
    expect(store.selectPlaylist).toHaveBeenCalledWith(playlist)
  })
})
