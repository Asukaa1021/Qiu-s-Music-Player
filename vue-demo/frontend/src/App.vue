<script setup>
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { useMusicStore } from './stores/music'
import LoginPanel from './components/LoginPanel.vue'

const store = useMusicStore()
const currentCover = computed(() => store.currentTrack?.cover || '')
</script>

<template>
  <div id="album-bg" :class="{ visible: !!currentCover }" :style="{ backgroundImage: currentCover ? `url(${currentCover})` : 'none' }"></div>

  <RouterView v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>

  <LoginPanel />
</template>

<style>
#album-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  filter: blur(120px) brightness(0.18) saturate(1.5);
  transform: scale(1.4);
  transition: background-image 1.5s ease, opacity 1.5s ease;
  opacity: 0;
  pointer-events: none;
}
#album-bg.visible { opacity: 1; }
</style>
