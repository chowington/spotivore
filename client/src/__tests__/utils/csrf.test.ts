import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { getCsrfToken } from '@/utils/csrf'
import { useSpotivoreStore } from '@/stores/spotivore'

describe('getCsrfToken', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns the csrfToken from the store', () => {
    const store = useSpotivoreStore()
    store.setCsrfToken('test-token-123')
    expect(getCsrfToken()).toBe('test-token-123')
  })

  it('returns empty string when csrfToken is not set', () => {
    expect(getCsrfToken()).toBe('')
  })
})
