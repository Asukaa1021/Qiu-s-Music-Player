<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()
const visible = ref(false)
const lyricsRef = ref(null)
const supportsScreenSaver = ref(false)
let idleTimer = null

const isFm = computed(() => store.activePlayback === 'fm' && !!store.fmTrack)
const track = computed(() => isFm.value ? store.fmTrack : store.currentTrack)
const playing = computed(() => isFm.value ? store.fmIsPlaying : store.isPlaying)
const currentTime = computed(() => isFm.value ? store.fmCurrentTime : store.currentTime)
const lyrics = computed(() => isFm.value ? store.fmLyrics : store.lyrics)
const title = computed(() => isFm.value ? track.value?.name : track.value?.title)
const currentLineIndex = computed(() => {
  let index = -1
  for (let i = 0; i < lyrics.value.length; i++) {
    if (currentTime.value >= lyrics.value[i].time) index = i
    else break
  }
  return index
})

const backgroundStyle = computed(() => ({
  backgroundImage: track.value?.cover ? `url(${track.value.cover})` : 'none',
}))

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function armIdleTimer() {
  clearIdleTimer()
  // 触屏设备没有稳定的“鼠标空闲”语义；全屏遮罩会吞掉用户第一次返回操作。
  if (!supportsScreenSaver.value || !track.value || !playing.value) return
  idleTimer = setTimeout(() => { visible.value = true }, 30_000)
}

function leaveScreenSaver() {
  if (visible.value) visible.value = false
  armIdleTimer()
}

function onUserActivity() {
  leaveScreenSaver()
}

watch([track, playing], () => {
  visible.value = false
  armIdleTimer()
}, { immediate: true })

function scrollToCurrentLyric() {
  if (!visible.value) return
  nextTick(() => {
    const container = lyricsRef.value
    const active = container?.querySelector('.saver-lyric--active')
    if (!container || !active) return
    const top = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  })
}

watch(currentLineIndex, scrollToCurrentLyric)
watch(visible, (isVisible) => {
  if (isVisible) scrollToCurrentLyric()
})

onMounted(() => {
  supportsScreenSaver.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  for (const event of ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(event, onUserActivity, { passive: true })
  }
  armIdleTimer()
})

onUnmounted(() => {
  clearIdleTimer()
  for (const event of ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel']) {
    window.removeEventListener(event, onUserActivity)
  }
})
</script>

<template>
  <Transition name="screen-saver">
    <section v-if="visible && track" class="screen-saver" :style="backgroundStyle" @click="leaveScreenSaver">
      <div class="screen-saver__veil"></div>
      <div class="screen-saver__content">
        <h2 class="screen-saver__title">{{ title || '未知歌曲' }}</h2>
        <p class="screen-saver__artist">{{ track.artist || '未知歌手' }}</p>

        <div v-if="lyrics.length" ref="lyricsRef" class="saver-lyrics" aria-label="滚动歌词">
          <div class="saver-lyrics__track">
            <p
              v-for="(line, index) in lyrics"
              :key="`${line.time}-${index}`"
              class="saver-lyric"
              :class="{ 'saver-lyric--active': index === currentLineIndex }"
            >
              {{ line.text }}
              <small v-if="line.tlrc">{{ line.tlrc }}</small>
            </p>
          </div>
        </div>
        <p v-else class="screen-saver__empty">♪</p>
        <p class="screen-saver__hint">移动鼠标或按任意键退出</p>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.screen-saver { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; overflow: hidden; background-color: #06080b; background-size: cover; background-position: center; cursor: none; font-family: var(--font-sans); }
.screen-saver::before { content: ''; position: absolute; inset: -50px; background: inherit; background-size: cover; background-position: center; filter: blur(34px) saturate(1.45) brightness(.42); transform: scale(1.15); }
.screen-saver__veil { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(8,12,16,.12), rgba(2,3,5,.76) 76%), linear-gradient(110deg, rgba(0,245,212,.08), transparent 48%, rgba(244,210,138,.08)); }
.screen-saver__content { position: relative; z-index: 1; width: min(760px, calc(100vw - 48px)); text-align: center; }
.screen-saver__title { color: var(--ink); font-family: var(--font-sans); font-size: clamp(22px, 4vw, 40px); font-weight: 650; letter-spacing: -.025em; }.screen-saver__artist { margin-top: 6px; color: var(--muted); font-size: 14px; }
.saver-lyrics { position: relative; height: 216px; margin: 36px auto 0; overflow-y: auto; scrollbar-width: none; mask-image: linear-gradient(to bottom, transparent, black 22%, black 78%, transparent); -webkit-mask-image: linear-gradient(to bottom, transparent, black 22%, black 78%, transparent); }.saver-lyrics::-webkit-scrollbar { display: none; }.saver-lyrics__track { padding: 72px 0; }
.saver-lyric { min-height: 72px; display: flex; flex-direction: column; justify-content: center; padding: 7px 18px; color: rgba(232,236,239,.32); font-family: var(--font-sans); font-size: clamp(16px, 2.4vw, 24px); font-weight: 500; line-height: 1.35; transition: color .45s ease, transform .45s ease, text-shadow .45s ease; }.saver-lyric small { margin-top: 5px; color: rgba(232,236,239,.25); font-family: var(--font-sans); font-size: .58em; font-weight: 400; }.saver-lyric--active { color: var(--accent); transform: scale(1.2); text-shadow: 0 0 28px rgba(0,245,212,.34); }.saver-lyric--active small { color: rgba(232,236,239,.68); }
.screen-saver__empty { margin: 70px 0; color: var(--accent); font-size: 52px; text-shadow: 0 0 30px rgba(0,245,212,.35); animation: saver-pulse 2.4s ease-in-out infinite; }.screen-saver__hint { margin-top: 28px; color: rgba(232,236,239,.34); font-size: 11px; letter-spacing: .12em; }
@keyframes saver-pulse { 50% { opacity: .35; transform: scale(1.25); } }.screen-saver-enter-active, .screen-saver-leave-active { transition: opacity .55s var(--ease-out); }.screen-saver-enter-from, .screen-saver-leave-to { opacity: 0; }
</style>
