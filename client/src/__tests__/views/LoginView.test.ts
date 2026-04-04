import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import LoginView from '@/views/LoginView.vue'

const mockGetAuthUrl = vi.fn()

vi.mock('@/api/backend', () => ({
  getAuthUrl: (...args: unknown[]) => mockGetAuthUrl(...args),
}))

function mountComponent() {
  return mount(LoginView, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
    },
  })
}

describe('LoginView', () => {
  let locationHref = ''

  beforeEach(() => {
    mockGetAuthUrl.mockReset()
    locationHref = ''
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window.location, 'href', {
      get: () => locationHref,
      set: (v: string) => { locationHref = v },
      configurable: true,
    })
  })

  it('renders the Connect to Spotify button', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('button').text()).toContain('Connect to Spotify')
  })

  it('renders the Spotivore heading', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('h1').text()).toBe('Spotivore')
  })

  it('calls getAuthUrl and sets location.href on button click', async () => {
    mockGetAuthUrl.mockResolvedValue('https://accounts.spotify.com/authorize?...')
    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')
    // Wait for the async handler
    await new Promise((r) => setTimeout(r, 0))
    expect(mockGetAuthUrl).toHaveBeenCalled()
    expect(locationHref).toBe('https://accounts.spotify.com/authorize?...')
  })
})
