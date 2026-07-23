import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Splash',
    component: () => import('../views/SplashView.vue'),
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/player',
    name: 'Player',
    component: () => import('../views/PlayerView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
