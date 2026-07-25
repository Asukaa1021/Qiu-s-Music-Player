<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useMusicStore } from '../stores/music'
import { getSongComments } from '../api/music'

const store = useMusicStore()
const comments = ref([])
const activeComments = ref([])
const loading = ref(false)
const isDanmakuVisible = ref(localStorage.getItem('melody_danmaku_visible') !== 'false')
let rotationTimer = null
let nextCommentIndex = 0
let instanceId = 0
const retireTimers = new Set()
let requestId = 0

const isFm = computed(() => store.activePlayback === 'fm' && !!store.fmTrack)
const activeTrack = computed(() => isFm.value ? store.fmTrack : store.currentTrack)
const songId = computed(() => activeTrack.value?._songId || '')
const isPlaying = computed(() => isFm.value ? store.fmIsPlaying : store.isPlaying)
function clearRotation(clearVisible = true) {
  if (rotationTimer) {
    clearInterval(rotationTimer)
    rotationTimer = null
  }
  for (const timer of retireTimers) clearTimeout(timer)
  retireTimers.clear()
  if (clearVisible) activeComments.value = []
}

function durationFor(text) {
  // 弹幕移动更慢；评论越长，预留的阅读时间越多。
  return Math.min(42_000, Math.max(14_000, 11_000 + (text?.length || 0) * 240))
}

function styleFor(comment, lane) {
  const length = comment.content?.length || 0
  const fontSize = length <= 18 ? 22 : length <= 40 ? 19 : length <= 80 ? 16 : 14
  return {
    '--comment-duration': `${durationFor(comment.content) / 1000}s`,
    '--comment-size': `${fontSize}px`,
    '--comment-lane': `${lane}px`,
  }
}

function getLane() {
  const maxLane = window.innerWidth <= 600 ? 150 : 260
  const occupied = activeComments.value.map(item => item.lane)
  for (let i = 0; i < 12; i++) {
    const lane = Math.round(Math.random() * maxLane)
    if (occupied.every(value => Math.abs(value - lane) > 58)) return lane
  }
  return Math.round(Math.random() * maxLane)
}

function spawnComment() {
  if (!isPlaying.value || !comments.value.length || activeComments.value.length >= 3) return
  const comment = comments.value[nextCommentIndex % comments.value.length]
  nextCommentIndex++
  const lane = getLane()
  const item = { ...comment, instanceId: ++instanceId, lane, style: styleFor(comment, lane) }
  activeComments.value = [...activeComments.value, item]
  const retireTimer = setTimeout(() => {
    activeComments.value = activeComments.value.filter(active => active.instanceId !== item.instanceId)
    retireTimers.delete(retireTimer)
  }, durationFor(comment.content))
  retireTimers.add(retireTimer)
}

function startRotation() {
  clearRotation()
  if (!isPlaying.value || !comments.value.length) return
  spawnComment()
  setTimeout(spawnComment, 2_800)
  rotationTimer = setInterval(spawnComment, 4_800)
}

function toggleDanmaku() {
  isDanmakuVisible.value = !isDanmakuVisible.value
  localStorage.setItem('melody_danmaku_visible', String(isDanmakuVisible.value))
}

async function loadComments(id) {
  const currentRequest = ++requestId
  clearRotation()
  nextCommentIndex = 0
  comments.value = []
  if (!id) return
  loading.value = true
  try {
    const data = await getSongComments(id)
    if (currentRequest !== requestId) return
    comments.value = data.comments || []
  } catch {
    if (currentRequest === requestId) comments.value = []
  } finally {
    if (currentRequest === requestId) {
      loading.value = false
      startRotation()
    }
  }
}

watch(songId, loadComments, { immediate: true })
watch(isPlaying, startRotation)

onUnmounted(clearRotation)
</script>

<template>
  <button v-if="songId" class="danmaku-toggle" :class="{ 'danmaku-toggle--off': !isDanmakuVisible }" @click="toggleDanmaku" :aria-label="isDanmakuVisible ? '隐藏弹幕' : '显示弹幕'" :title="isDanmakuVisible ? '隐藏弹幕' : '显示弹幕'">
    <svg v-if="isDanmakuVisible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M10.6 5.1A11.8 11.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-3.1 3.8M6.1 6.1C3.6 8 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.5-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
    <span>弹幕</span>
  </button>
  <Transition name="comment-stream" mode="out-in">
    <aside v-if="isPlaying && activeComments.length" class="comment-stream" :class="{ 'comment-stream--hidden': !isDanmakuVisible }" aria-live="polite">
      <div v-for="comment in activeComments" :key="comment.instanceId" class="comment-danmaku" :style="comment.style">
        <img v-if="comment.avatar" :src="comment.avatar" class="comment-danmaku__avatar" alt="" referrerpolicy="no-referrer" />
        <span v-else class="comment-danmaku__avatar comment-danmaku__avatar--fallback">♪</span>
        <span class="comment-danmaku__text">{{ comment.content }}</span>
        <span class="comment-danmaku__meta">— {{ comment.nickname }} · ♥ {{ comment.likedCount }}</span>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.danmaku-toggle { position: fixed; z-index: 131; top: 18px; right: 24px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; background: rgba(8,11,15,.62); color: var(--accent); font: 11px var(--font-sans); cursor: pointer; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: .2s var(--ease-out); }.danmaku-toggle:hover { border-color: rgba(0,245,212,.38); background: rgba(0,245,212,.08); }.danmaku-toggle--off { color: var(--muted); }.danmaku-toggle svg { width: 14px; height: 14px; }
.comment-stream { position: fixed; z-index: 130; top: 64px; left: 0; width: 100vw; height: 330px; overflow: hidden; pointer-events: none; transition: opacity .2s ease, visibility .2s ease; }.comment-stream--hidden { opacity: 0; visibility: hidden; }
.comment-danmaku { position: absolute; top: var(--comment-lane); left: 0; display: inline-flex; align-items: center; gap: 10px; width: max-content; padding: 8px 17px 8px 9px; border: 1px solid rgba(255,255,255,.11); border-radius: 999px; background: rgba(8,11,15,.72); backdrop-filter: blur(16px) saturate(1.45); -webkit-backdrop-filter: blur(16px) saturate(1.45); box-shadow: 0 8px 28px rgba(0,0,0,.25), 0 0 20px rgba(0,245,212,.05); animation: danmaku-move var(--comment-duration) linear both; will-change: transform; }
.comment-danmaku__avatar { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,245,212,.25); }.comment-danmaku__avatar--fallback { display: grid; place-items: center; background: rgba(0,245,212,.08); color: var(--accent); }.comment-danmaku__text { color: var(--ink); font: 550 var(--comment-size)/1.35 var(--font-sans); white-space: nowrap; text-shadow: 0 1px 10px rgba(0,0,0,.3); }.comment-danmaku__meta { color: var(--champagne); font: 10px var(--font-mono); white-space: nowrap; }
@keyframes danmaku-move { from { transform: translateX(100vw); } to { transform: translateX(calc(-100% - 100vw)); } }.comment-stream-enter-active, .comment-stream-leave-active { transition: opacity .25s ease; }.comment-stream-enter-from, .comment-stream-leave-to { opacity: 0; }
@media (max-width: 600px) { .danmaku-toggle { top: 12px; right: 14px; }.comment-stream { top: 56px; height: 210px; }.comment-danmaku { gap: 8px; padding-right: 12px; }.comment-danmaku__avatar { width: 28px; height: 28px; }.comment-danmaku__meta { display: none; } }
</style>
