import { useSpotivoreStore } from '@/stores/spotivore'

export function getCsrfToken(): string {
  return useSpotivoreStore().csrfToken
}
