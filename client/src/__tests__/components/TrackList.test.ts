import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useSpotivoreStore } from '@/stores/spotivore'
import TrackList from '@/components/TrackList.vue'

const mockGetTracks = vi.fn()
const mockGetSession = vi.fn()
const mockResumeSession = vi.fn()

vi.mock('@/api/backend', () => ({
  getTracks: (...args: unknown[]) => mockGetTracks(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
}))

vi.mock('@/composables/useSpotifyPlayer', () => ({
  resumeSession: (...args: unknown[]) => mockResumeSession(...args),
}))

const playlist = { spotify_id: 'pl1', name: 'My Playlist', track_count: 2 }
const tracks = [
  { position: 0, spotify_id: 'tr1', name: 'Track 1', artists: ['A'], album: 'B', uri: 'spotify:track:tr1' },
  { position: 1, spotify_id: 'tr2', name: 'Track 2', artists: ['A'], album: 'B', uri: 'spotify:track:tr2' },
]
const sessionData = { current_track_uri: 'spotify:track:tr1', position_ms: 5000, track_uris: ['spotify:track:tr1'] }

function mountComponent() {
  return mount(TrackList, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: {
        TrackItem: { template: '<div class="track-item-stub" />', props: ['track'] },
        Spinner: { template: '<div class="spinner-stub" />' },
      },
    },
  })
}

// Mounts and triggers the watcher by setting selectedPlaylist after mount
async function mountAndSelect(session: typeof sessionData | null = null, extraStorePatch: Record<string, unknown> = {}) {
  mockGetTracks.mockResolvedValue(tracks)
  mockGetSession.mockResolvedValue(session)
  const wrapper = mountComponent()
  const store = useSpotivoreStore(wrapper.vm.$pinia)
  Object.assign(store, extraStorePatch)
  store.selectedPlaylist = playlist
  await flushPromises()
  return { wrapper, store }
}

describe('TrackList', () => {
  beforeEach(() => {
    mockGetTracks.mockReset()
    mockGetSession.mockReset()
    mockResumeSession.mockReset()
    mockResumeSession.mockResolvedValue(undefined)
  })

  it('shows "Select a playlist" when no playlist is selected', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Select a playlist')
  })

  it('fetches tracks when selectedPlaylist changes', async () => {
    const { } = await mountAndSelect()
    expect(mockGetTracks).toHaveBeenCalledWith('pl1')
  })

  it('shows spinner while loading', async () => {
    let resolve: (v: typeof tracks) => void
    mockGetTracks.mockReturnValue(new Promise((r) => { resolve = r }))
    mockGetSession.mockResolvedValue(null)
    const wrapper = mountComponent()
    const store = useSpotivoreStore(wrapper.vm.$pinia)
    store.selectedPlaylist = playlist
    // After the watcher fires and refresh() starts, loading=true is set
    // but we need a tick for the watcher to flush and the DOM to update
    await Promise.resolve() // let microtasks run
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.spinner-stub').exists()).toBe(true)
    resolve!(tracks)
    await flushPromises()
    expect(wrapper.find('.spinner-stub').exists()).toBe(false)
  })

  it('renders a TrackItem for each track after loading', async () => {
    const { wrapper } = await mountAndSelect()
    expect(wrapper.findAll('.track-item-stub')).toHaveLength(2)
  })

  it('shows playlist name and track count', async () => {
    const { wrapper } = await mountAndSelect()
    expect(wrapper.text()).toContain('My Playlist')
    expect(wrapper.text()).toContain('2 tracks')
  })

  it('re-fetches when selectedPlaylist changes to a different playlist', async () => {
    const { wrapper, store } = await mountAndSelect()
    const playlist2 = { spotify_id: 'pl2', name: 'Playlist 2', track_count: 1 }
    mockGetTracks.mockResolvedValue([])
    mockGetSession.mockResolvedValue(null)
    store.selectedPlaylist = playlist2
    await flushPromises()
    expect(mockGetTracks).toHaveBeenCalledWith('pl2')
  })

  it('shows Resume button when a session exists for a different playlist', async () => {
    const { wrapper } = await mountAndSelect(sessionData, { sessionPlaylistId: 'other-pl' })
    expect(wrapper.find('button[title="Resume listening session"]').exists()).toBe(true)
  })

  it('does not show Resume button when session belongs to current playlist', async () => {
    const { wrapper } = await mountAndSelect(sessionData, { sessionPlaylistId: 'pl1' })
    expect(wrapper.find('button[title="Resume listening session"]').exists()).toBe(false)
  })

  it('does not show Resume button when no session', async () => {
    const { wrapper } = await mountAndSelect(null)
    expect(wrapper.find('button[title="Resume listening session"]').exists()).toBe(false)
  })

  it('clicking Resume calls resumeSession and hides the button', async () => {
    const { wrapper } = await mountAndSelect(sessionData, { sessionPlaylistId: 'other-pl' })
    await wrapper.find('button[title="Resume listening session"]').trigger('click')
    await flushPromises()
    expect(mockResumeSession).toHaveBeenCalledWith(sessionData)
    expect(wrapper.find('button[title="Resume listening session"]').exists()).toBe(false)
  })

  it('hides Resume button when store sessionPlaylistId becomes current playlist id', async () => {
    const { wrapper, store } = await mountAndSelect(sessionData, { sessionPlaylistId: 'other-pl' })
    store.sessionPlaylistId = 'pl1'
    await flushPromises()
    expect(wrapper.find('button[title="Resume listening session"]').exists()).toBe(false)
  })

  it('Refresh button is disabled while loading', async () => {
    let resolve: (v: typeof tracks) => void
    mockGetTracks.mockReturnValue(new Promise((r) => { resolve = r }))
    mockGetSession.mockResolvedValue(null)
    const wrapper = mountComponent()
    const store = useSpotivoreStore(wrapper.vm.$pinia)
    store.selectedPlaylist = playlist
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    const refreshBtn = wrapper.find('button[title="Refresh tracklist"]')
    expect(refreshBtn.attributes('disabled')).toBeDefined()
    resolve!(tracks)
    await flushPromises()
    expect(refreshBtn.attributes('disabled')).toBeUndefined()
  })

  it('clicking Refresh re-fetches tracks', async () => {
    const { wrapper } = await mountAndSelect()
    mockGetTracks.mockResolvedValue([])
    mockGetSession.mockResolvedValue(null)
    await wrapper.find('button[title="Refresh tracklist"]').trigger('click')
    await flushPromises()
    expect(mockGetTracks).toHaveBeenCalledTimes(2)
  })

  describe('mobile navigation', () => {
    it('renders a back button when a playlist is selected', async () => {
      const { wrapper } = await mountAndSelect()
      expect(wrapper.find('.back-btn').exists()).toBe(true)
    })

    it('does not render a back button when no playlist is selected', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.back-btn').exists()).toBe(false)
    })

    it('emits back when the back button is clicked', async () => {
      const { wrapper } = await mountAndSelect()
      await wrapper.find('.back-btn').trigger('click')
      expect(wrapper.emitted('back')).toHaveLength(1)
    })
  })
})
