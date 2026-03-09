import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useSpotivoreStore } from '@/stores/spotivore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const res = await fetch('/api/spotify/connection/')

  if (res.status === 403) {
    window.location.href = '/accounts/login/?next=/'
    return false
  }

  const data = await res.json()

  if (data.csrf_token) {
    useSpotivoreStore().setCsrfToken(data.csrf_token)
  }

  if (!data.connected) {
    if (to.name !== 'login') return { name: 'login' }
    return
  }

  if (to.name === 'login') return { name: 'home' }
})

export default router
