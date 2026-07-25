<script setup>
import { computed, KeepAlive } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useMusicStore } from './stores/music'
import LoginPanel from './components/LoginPanel.vue'
import PersistentPlayer from './components/PersistentPlayer.vue'
import ScreenSaver from './components/ScreenSaver.vue'
import CommentStream from './components/CommentStream.vue'

const store = useMusicStore()
const route = useRoute()
const currentCover = computed(() => {
  if (store.activePlayback === 'fm') return store.fmTrack?.cover || ''
  return store.currentTrack?.cover || ''
})
</script>

<template>
  <div id="album-bg" :class="{ visible: !!currentCover }" :style="{ backgroundImage: currentCover ? `url(${currentCover})` : 'none' }"></div>

  <RouterView v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </transition>
  </RouterView>

  <PersistentPlayer v-if="route.path === '/home'" />
  <CommentStream v-if="route.path === '/player'" />
  <ScreenSaver />
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
