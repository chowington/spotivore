import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useSpotivoreStore } from '@/stores/spotivore'

const mockGetConnection = vi.fn()

vi.mock('@/api/backend', () => ({
  getConnection: (...args: unknown[]) => mockGetConnection(...args),
}))

// We import the router factory fresh in each test via re-import
// The router module uses getConnection so we mock that first

async function createTestRouter() {
  // Re-import the router to get a fresh instance with the mock in place
  const { default: router } = await import('@/router/index')
  return router
}

describe('router navigation guard', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mockGetConnection.mockReset()
    vi.resetModules()
  })

  it('aborts navigation when getConnection returns null (403)', async () => {
    mockGetConnection.mockResolvedValue(null)
    const router = await createTestRouter()
    // Aborted navigation rejects the push promise; catch it to avoid unhandled rejection
    const result = await router.push('/').catch((e) => e)
    // A NavigationFailure object is returned (truthy), not undefined like a successful nav
    expect(result).toBeTruthy()
  })

  it('redirects to login when not connected and navigating to home', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: 'tok', connected: false })
    const router = await createTestRouter()
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('stays on login when not connected and already navigating to login', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: 'tok', connected: false })
    const router = await createTestRouter()
    await router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('redirects to home when connected and navigating to login', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: 'tok', connected: true })
    const router = await createTestRouter()
    await router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('proceeds to home when connected', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: 'tok', connected: true })
    const router = await createTestRouter()
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('sets CSRF token in store when csrf_token is present', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: 'my-csrf', connected: true })
    const router = await createTestRouter()
    const store = useSpotivoreStore()
    await router.push('/')
    await router.isReady()
    expect(store.csrfToken).toBe('my-csrf')
  })

  it('does not set CSRF token when csrf_token is empty', async () => {
    mockGetConnection.mockResolvedValue({ csrf_token: '', connected: true })
    const router = await createTestRouter()
    const store = useSpotivoreStore()
    await router.push('/')
    await router.isReady()
    expect(store.csrfToken).toBe('')
  })
})
