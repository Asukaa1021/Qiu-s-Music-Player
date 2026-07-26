<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()
const visible = ref(false)
const incoming = ref(null)
const outgoing = ref(null)
const direction = ref('next')
const palette = ref({ accent: '#8eeaff', accentSoft: 'rgba(142, 234, 255, .28)' })
let hideTimer = null

const activeTrack = computed(() =>
  store.activePlayback === 'fm' ? store.fmTrack : store.currentTrack
)
const activeKey = computed(() => activeTrack.value?._songId || activeTrack.value?.id || '')
const activePosition = computed(() =>
  store.activePlayback === 'fm' ? store.fmCurrentIndex : store.currentIndex
)

function setPalette(track) {
  const fallback = { accent: '#8eeaff', accentSoft: 'rgba(142, 234, 255, .28)' }
  if (!track?.cover) { palette.value = fallback; return }

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 24
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0, 24, 24)
      const pixels = context.getImageData(0, 0, 24, 24).data
      let red = 0; let green = 0; let blue = 0; let count = 0
      for (let index = 0; index < pixels.length; index += 16) {
        const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3
        if (pixels[index + 3] > 180 && brightness > 30 && brightness < 230) {
          red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]; count++
        }
      }
      if (!count) throw new Error('No usable cover colour')
      const max = Math.max(red / count, green / count, blue / count)
      const scale = max < 135 ? 1.5 : 1
      const r = Math.min(255, Math.round((red / count) * scale))
      const g = Math.min(255, Math.round((green / count) * scale))
      const b = Math.min(255, Math.round((blue / count) * scale))
      palette.value = { accent: `rgb(${r}, ${g}, ${b})`, accentSoft: `rgba(${r}, ${g}, ${b}, .28)` }
    } catch { palette.value = fallback }
  }
  image.onerror = () => { palette.value = fallback }
  image.src = track.cover
}

function show(track, previous, nextDirection) {
  clearTimeout(hideTimer)
  incoming.value = track
  outgoing.value = previous
  direction.value = nextDirection
  setPalette(track)
  visible.value = false
  nextTick(() => {
    visible.value = true
    hideTimer = window.setTimeout(() => { visible.value = false }, 1350)
  })
}

let lastTrack = null
let lastPosition = -1
let lastSource = ''
watch(activeKey, () => {
  const nextTrack = activeTrack.value
  if (!nextTrack) return
  const source = store.activePlayback
  const isPrevious = source === lastSource && activePosition.value < lastPosition
  if (lastTrack && lastTrack !== nextTrack && store.isPlaying) {
    show(nextTrack, lastTrack, isPrevious ? 'previous' : 'next')
  }
  lastTrack = nextTrack
  lastPosition = activePosition.value
  lastSource = source
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => clearTimeout(hideTimer))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && incoming" class="track-switch" :class="`track-switch--${direction}`" :style="{ '--accent': palette.accent, '--accent-soft': palette.accentSoft }" aria-hidden="true">
      <div class="track-switch__wash" :style="{ backgroundImage: `url(${incoming.cover || ''})` }" />
      <div class="track-switch__glow track-switch__glow--one" />
      <div class="track-switch__glow track-switch__glow--two" />

      <div v-if="outgoing?.cover" class="track-card track-card--out">
        <img :src="outgoing.cover" alt="" />
      </div>
      <div class="track-card track-card--in">
        <img v-if="incoming.cover" :src="incoming.cover" alt="" />
        <span v-else class="track-card__fallback">♫</span>
      </div>

      <div class="track-switch__meta">
        <span class="track-switch__label">NOW PLAYING</span>
        <strong>{{ incoming.title || incoming.name || '未知歌曲' }}</strong>
        <small>{{ incoming.artist || '未知歌手' }}</small>
      </div>
      <div class="track-switch__line" />
    </div>
  </Teleport>
</template>

<style scoped>
.track-switch { position: fixed; inset: 0; z-index: 10000; overflow: hidden; pointer-events: none; isolation: isolate; background: rgba(10, 12, 22, .13); }
.track-switch__wash { position: absolute; inset: -15%; z-index: -2; background-position: center; background-size: cover; filter: blur(42px) saturate(1.45) brightness(.5); opacity: 0; animation: wash-in 1.35s ease-out both; }
.track-switch::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(8, 10, 21, .9), rgba(8, 10, 21, .25) 52%, rgba(8, 10, 21, .78)); animation: veil .9s ease-out both; }
.track-card { position: absolute; left: 50%; top: 50%; width: clamp(118px, 17vw, 240px); aspect-ratio: 1; overflow: hidden; border-radius: 18px; background: #252b43; box-shadow: 0 28px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.3); }
.track-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
.track-card--in { animation: card-in 1.1s cubic-bezier(.16,.85,.18,1) both; }
.track-card--out { animation: card-out .85s cubic-bezier(.45,0,.75,.25) both; }
.track-switch--previous .track-card--in { animation-name: card-in-reverse; }
.track-switch--previous .track-card--out { animation-name: card-out-reverse; }
.track-card__fallback { display: grid; width: 100%; height: 100%; place-items: center; color: white; font-size: 3rem; }
.track-switch__meta { position: absolute; top: 50%; left: calc(50% + clamp(85px, 13vw, 185px)); min-width: 180px; transform: translateY(-50%); color: #fff; text-shadow: 0 4px 20px rgba(0,0,0,.35); animation: meta-in .75s .28s cubic-bezier(.18,.9,.28,1) both; }
.track-switch__label { display: block; margin-bottom: 10px; color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: .22em; }
.track-switch__meta strong, .track-switch__meta small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-switch__meta strong { max-width: min(36vw, 420px); font-size: clamp(18px, 2.3vw, 32px); letter-spacing: .025em; }
.track-switch__meta small { margin-top: 8px; max-width: min(32vw, 350px); color: rgba(255,255,255,.7); font-size: 14px; }
.track-switch__line { position: absolute; top: calc(50% + clamp(72px, 10vw, 140px)); left: 50%; width: min(50vw, 570px); height: 2px; transform-origin: left; background: linear-gradient(90deg, var(--accent), rgba(255,255,255,0)); box-shadow: 0 0 12px var(--accent); animation: line-in .95s .08s ease-out both; }
.track-switch__glow { position: absolute; left: 50%; top: 50%; width: 42vw; height: 2px; opacity: 0; transform-origin: left; background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 24px var(--accent-soft); filter: blur(1px); }
.track-switch__glow--one { animation: streak 1s .05s ease-out both; }
.track-switch__glow--two { animation: streak .8s .2s ease-out both; transform: rotate(-17deg); }
.track-switch--previous .track-switch__glow--one { animation-name: streak-reverse; }
.track-switch--previous .track-switch__glow--two { animation-name: streak-reverse; transform: rotate(17deg); }
@keyframes wash-in { 0% { opacity: 0; transform: scale(1.18); } 30%, 80% { opacity: .92; } 100% { opacity: 0; transform: scale(1); } }
@keyframes veil { from { opacity: 0; } 24%, 76% { opacity: 1; } to { opacity: 0; } }
@keyframes card-in { from { opacity: 0; transform: translate(105vw, -50%) rotate(22deg) scale(.68); filter: blur(8px); } 58% { opacity: 1; transform: translate(-50%, -50%) rotate(-2deg) scale(1.05); filter: blur(0); } to { opacity: 0; transform: translate(-50%, -50%) rotate(0) scale(1); } }
@keyframes card-out { from { opacity: .72; transform: translate(-50%, -50%) rotate(0) scale(.92); } to { opacity: 0; transform: translate(-125vw, -50%) rotate(-24deg) scale(.62); filter: blur(7px); } }
@keyframes card-in-reverse { from { opacity: 0; transform: translate(-105vw, -50%) rotate(-22deg) scale(.68); filter: blur(8px); } 58% { opacity: 1; transform: translate(-50%, -50%) rotate(2deg) scale(1.05); filter: blur(0); } to { opacity: 0; transform: translate(-50%, -50%) rotate(0) scale(1); } }
@keyframes card-out-reverse { from { opacity: .72; transform: translate(-50%, -50%) rotate(0) scale(.92); } to { opacity: 0; transform: translate(125vw, -50%) rotate(24deg) scale(.62); filter: blur(7px); } }
@keyframes meta-in { from { opacity: 0; transform: translate(36px, -50%); } 72% { opacity: 1; transform: translate(-3px, -50%); } to { opacity: 0; transform: translate(0, -50%); } }
@keyframes line-in { from { opacity: 0; transform: scaleX(0); } 20%, 74% { opacity: 1; transform: scaleX(1); } to { opacity: 0; transform: scaleX(1); } }
@keyframes streak { from { opacity: 0; transform: translate(-28vw, -50%) scaleX(.1); } 15%, 52% { opacity: .8; } to { opacity: 0; transform: translate(45vw, -50%) scaleX(1); } }
@keyframes streak-reverse { from { opacity: 0; transform: translate(28vw, -50%) scaleX(.1); } 15%, 52% { opacity: .8; } to { opacity: 0; transform: translate(-45vw, -50%) scaleX(1); } }
@media (max-width: 680px) { .track-switch__meta { top: calc(50% + clamp(92px, 22vw, 130px)); left: 50%; width: 78vw; text-align: center; transform: translate(-50%, 0); } .track-switch__meta strong, .track-switch__meta small { max-width: 100%; } .track-switch__line { top: calc(50% + clamp(80px, 19vw, 115px)); left: 25%; width: 50vw; } @keyframes meta-in { from { opacity: 0; transform: translate(-50%, 18px); } 72% { opacity: 1; transform: translate(-50%, -2px); } to { opacity: 0; transform: translate(-50%, 0); } } }
</style>
