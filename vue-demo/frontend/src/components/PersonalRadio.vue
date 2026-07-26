<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMusicStore } from '../stores/music'
import { useRouter } from 'vue-router'
import * as musicApi from '../api/music'

const store = useMusicStore()
const router = useRouter()

// ==================== 跨页面复用的 FM Audio ====================
// 不放在模板中，避免离开私人漫游页面时浏览器销毁 <audio> 并中断播放。
const fmSession = window.__melodyFmSession || (window.__melodyFmSession = {
  audio: new Audio(),
  audioCtx: null,
  analyser: null,
  source: null,
})
fmSession.audio.preload = 'auto'
fmSession.audio.crossOrigin = 'anonymous'
const audioEl = ref(fmSession.audio)
const fmPlaying = ref(false)
const fmCurrentTime = ref(0)
const fmDuration = ref(0)
const fmAudioLoading = ref(false)
let playSeq = 0

// Web Audio 频谱
let audioCtx = fmSession.audioCtx
let analyser = fmSession.analyser
let source = fmSession.source
const freqData = ref(new Uint8Array(128))

// ==================== 监听：主播放器 ↔ 漫游互斥 ====================
watch(() => store.isPlaying, (val) => {
  if (val && fmPlaying.value) {
    audioEl.value?.pause()
    fmPlaying.value = false
  }
})

// 私人漫游使用独立的 Audio 元素；音量变更时需立即同步，
// 不能只在开始播放时设置一次。
watch(() => store.volume, (value) => {
  if (audioEl.value) audioEl.value.volume = value
})

// 将独立 FM 音频的状态镜像到全局 store，供首页的常驻播放器使用。
watch(fmPlaying, (value) => { store.fmIsPlaying = value }, { immediate: true })
watch(fmCurrentTime, (value) => { store.fmCurrentTime = value }, { immediate: true })
watch(fmDuration, (value) => { store.fmDuration = value }, { immediate: true })

watch(() => store.loggedIn, (val) => {
  if (val && !store.fmTrack && !store.fmLoading) {
    store.fetchPersonalFm()
  }
})

// 漫游曲目切换 → 加载歌词 + 播放
watch(() => store.fmTrack, (track) => {
  if (track) {
    if (track._songId) store.fetchFmLyric(track._songId)
    nextTick(() => loadAndPlay())
  }
})

// ==================== Audio 工具 ====================
async function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    fmSession.audioCtx = audioCtx
  }
  if (audioCtx.state === 'suspended') await audioCtx.resume()
  if (!source && audioEl.value) {
    source = audioCtx.createMediaElementSource(audioEl.value)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyser.connect(audioCtx.destination)
    fmSession.source = source
    fmSession.analyser = analyser
  }
}

function updateFreqData() {
  if (!analyser) return
  const data = new Uint8Array(128)
  analyser.getByteFrequencyData(data)
  freqData.value = data
}

async function loadAndPlay() {
  const track = store.fmTrack
  if (!track) return

  const seq = ++playSeq
  fmAudioLoading.value = true

  try {
    await initAudioContext()

    // 快速切歌时，旧请求可能在这里被新请求追上，必须检查 playSeq 避免覆盖 src
    if (seq !== playSeq) return

    const src = `/api/music/stream?id=${track._songId}`
    if (audioEl.value.src !== src) {
      audioEl.value.src = src
      audioEl.value.load()
    }

    // 等待元数据加载完成
    await new Promise((resolve, reject) => {
      const onMeta = () => {
        cleanup()
        resolve()
      }
      const onErr = () => {
        cleanup()
        reject(new Error('加载失败'))
      }
      const cleanup = () => {
        audioEl.value.removeEventListener('loadedmetadata', onMeta)
        audioEl.value.removeEventListener('error', onErr)
      }
      audioEl.value.addEventListener('loadedmetadata', onMeta, { once: true })
      audioEl.value.addEventListener('error', onErr, { once: true })
    })

    if (seq !== playSeq) return

    audioEl.value.volume = store.volume
    await audioEl.value.play()
    if (seq !== playSeq) return

    fmPlaying.value = true
    store.setActivePlayback('fm')
    fmDuration.value = audioEl.value.duration || 0
  } catch {
    // 静默处理（包括浏览器 autoplay 策略）
  } finally {
    if (seq === playSeq) fmAudioLoading.value = false
  }
}

// ==================== 控制 ====================
function toggleFmPlay() {
  if (fmAudioLoading.value || store.fmLoading) return

  if (fmPlaying.value) {
    audioEl.value?.pause()
    fmPlaying.value = false
  } else {
    store.pause()
    if (!store.fmTrack) {
      store.fetchPersonalFm()
      return
    }
    loadAndPlay()
  }
}

async function fmSkip() {
  if (store.fmLoading) return
  store.pause()
  await store.fmNext()
}

// ==================== 喜欢 ====================
const isLiked = ref(false)
const likeAnimating = ref(false)

watch(() => store.fmTrack, () => {
  isLiked.value = false
  likeAnimating.value = false
})

async function fmLike() {
  if (!store.fmTrack || !store.loggedIn) return
  const track = store.fmTrack
  const newLike = !isLiked.value

  // 动画
  likeAnimating.value = true
  setTimeout(() => { likeAnimating.value = false }, 600)

  isLiked.value = newLike
  try {
    await musicApi.likeTrack(track._songId, newLike)
  } catch {
    // 失败时回滚
    isLiked.value = !newLike
  }
}

function goHome() {
  router.push('/home')
}

// ==================== Audio 事件（audio 元素可能因 loading 状态被销毁重建） ====================
let boundAudioEl = null

function bindAudioEvents() {
  const el = audioEl.value
  if (!el || el === boundAudioEl) return
  boundAudioEl = el

  el.addEventListener('timeupdate', () => {
    fmCurrentTime.value = el.currentTime
  })

  el.addEventListener('ended', () => {
    fmPlaying.value = false
    fmSkip()
  })

  el.addEventListener('error', () => {
    fmPlaying.value = false
    fmAudioLoading.value = false
  })
}

watch(audioEl, (el) => {
  if (el) {
    bindAudioEvents()
    // audio 元素重建后，旧 analyser 连的是已销毁的元素，需重置
    analyser = null
  } else {
    boundAudioEl = null
  }
})

// ==================== 格式化 ====================
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ==================== 封面旋转 ====================
const coverStyle = computed(() => ({
  animationPlayState: fmPlaying.value ? 'running' : 'paused',
}))

// ==================== 进度条 ====================
const progressBarRef = ref(null)
const progress = ref(0)
const isDragging = ref(false)

watch(fmCurrentTime, () => {
  if (!isDragging.value && fmDuration.value > 0) {
    progress.value = (fmCurrentTime.value / fmDuration.value) * 100
  }
})

function calcSeekPct(clientX) {
  const rect = progressBarRef.value?.getBoundingClientRect()
  if (!rect) return 0
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

function seekAt(pct) {
  if (audioEl.value && fmDuration.value > 0) {
    audioEl.value.currentTime = pct * fmDuration.value
  }
}

function seekTo(time) {
  if (audioEl.value && fmDuration.value > 0) {
    audioEl.value.currentTime = Math.max(0, Math.min(time, fmDuration.value))
    fmCurrentTime.value = audioEl.value.currentTime
  }
}

function onPersistentToggle() { toggleFmPlay() }
function onPersistentNext() { fmSkip() }
function onPersistentSeek(event) { seekTo(event.detail) }
function onPersistentStop() {
  audioEl.value?.pause()
  fmPlaying.value = false
}

function onPointerDown(e) {
  isDragging.value = true
  const pct = calcSeekPct(e.clientX)
  seekAt(pct)
  progress.value = pct * 100
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!isDragging.value) return
  const pct = calcSeekPct(e.clientX)
  seekAt(pct)
  progress.value = pct * 100
}

function onPointerUp() {
  isDragging.value = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
}

// ==================== 波形可视化（与主播放器同色：上青下金） ====================
const canvasRef = ref(null)
let animId = null
const frozenData = ref(null)
let fadeAlpha = 0.08
let shrinkFactor = 0.08

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = devicePixelRatio
  const W = (canvas.width = canvas.offsetWidth * dpr)
  const H = (canvas.height = canvas.offsetHeight * dpr)
  ctx.scale(dpr, dpr)
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight

  ctx.clearRect(0, 0, w, h)
  const midY = h / 2
  const maxRadius = Math.min(h * 0.42, w * 0.32)

  if (fmPlaying.value) {
    updateFreqData()
    frozenData.value = new Uint8Array(freqData.value)
  }

  const data = fmPlaying.value ? freqData.value : (frozenData.value || freqData.value)
  const step = Math.max(1, Math.floor((128 / w) * 2))
  const points = []

  for (let x = 0; x < w; x += step) {
    const freqIdx = Math.floor((x / w) * 64)
    const v = data[freqIdx] || 0
    const amplitude = (v / 255) * maxRadius * shrinkFactor
    points.push({ x, yTop: midY - amplitude, yBot: midY + amplitude, amplitude })
  }

  const active = fmPlaying.value
  const hasData = frozenData.value && frozenData.value.some((v) => v > 0)
  const targetAlpha = active ? 1 : (hasData ? 0 : 0.08)
  const targetShrink = active ? 1 : (hasData ? 0 : 0.08)
  const lerpSpeed = active ? 0.12 : 0.006
  fadeAlpha += (targetAlpha - fadeAlpha) * lerpSpeed
  shrinkFactor += (targetShrink - shrinkFactor) * lerpSpeed
  if (Math.abs(fadeAlpha - targetAlpha) < 0.001) fadeAlpha = targetAlpha
  if (Math.abs(shrinkFactor - targetShrink) < 0.001) shrinkFactor = targetShrink

  // Top wave — cyan
  ctx.beginPath()
  ctx.moveTo(0, midY)
  for (const p of points) ctx.lineTo(p.x, p.yTop)
  ctx.lineTo(w, midY)
  ctx.closePath()
  const topGrad = ctx.createLinearGradient(0, midY - maxRadius, 0, midY)
  topGrad.addColorStop(0, `rgba(0, 245, 212, ${(0.18 * fadeAlpha).toFixed(3)})`)
  topGrad.addColorStop(0.5, `rgba(0, 245, 212, ${(0.05 * fadeAlpha).toFixed(3)})`)
  topGrad.addColorStop(1, 'rgba(0, 245, 212, 0)')
  ctx.fillStyle = topGrad
  ctx.fill()

  // Bottom wave — champagne
  ctx.beginPath()
  ctx.moveTo(0, midY)
  for (const p of points) ctx.lineTo(p.x, p.yBot)
  ctx.lineTo(w, midY)
  ctx.closePath()
  const botGrad = ctx.createLinearGradient(0, midY, 0, midY + maxRadius)
  botGrad.addColorStop(0, 'rgba(244, 210, 138, 0)')
  botGrad.addColorStop(0.5, `rgba(244, 210, 138, ${(0.04 * fadeAlpha).toFixed(3)})`)
  botGrad.addColorStop(1, `rgba(244, 210, 138, ${(0.14 * fadeAlpha).toFixed(3)})`)
  ctx.fillStyle = botGrad
  ctx.fill()

  // Top stroke
  ctx.beginPath()
  ctx.moveTo(0, midY)
  for (const p of points) ctx.lineTo(p.x, p.yTop)
  const strokeTop = ctx.createLinearGradient(0, 0, w, 0)
  strokeTop.addColorStop(0, `rgba(0, 245, 212, ${(0.35 * fadeAlpha).toFixed(3)})`)
  strokeTop.addColorStop(0.5, `rgba(0, 245, 212, ${(0.6 * fadeAlpha).toFixed(3)})`)
  strokeTop.addColorStop(1, `rgba(0, 245, 212, ${(0.35 * fadeAlpha).toFixed(3)})`)
  ctx.strokeStyle = strokeTop
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Bottom stroke
  ctx.beginPath()
  ctx.moveTo(0, midY)
  for (const p of points) ctx.lineTo(p.x, p.yBot)
  const strokeBot = ctx.createLinearGradient(0, 0, w, 0)
  strokeBot.addColorStop(0, `rgba(244, 210, 138, ${(0.3 * fadeAlpha).toFixed(3)})`)
  strokeBot.addColorStop(0.5, `rgba(244, 210, 138, ${(0.5 * fadeAlpha).toFixed(3)})`)
  strokeBot.addColorStop(1, `rgba(244, 210, 138, ${(0.3 * fadeAlpha).toFixed(3)})`)
  ctx.strokeStyle = strokeBot
  ctx.lineWidth = 1
  ctx.stroke()

  animId = requestAnimationFrame(draw)
}

onMounted(() => {
  bindAudioEvents()
  draw()
  window.addEventListener('melody:fm-toggle', onPersistentToggle)
  window.addEventListener('melody:fm-next', onPersistentNext)
  window.addEventListener('melody:fm-seek', onPersistentSeek)
  window.addEventListener('melody:fm-stop', onPersistentStop)
  if (store.loggedIn && !store.fmTrack) {
    store.fetchPersonalFm()
  }
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  // 音频会话与全局控制事件属于当前浏览会话，页面卸载时仍应保留。
})

// ==================== 歌词 ====================
const lyricsRef = ref(null)
const currentLyricIndex = ref(-1)

watch(fmCurrentTime, (t) => {
  if (!store.fmLyrics.length) { currentLyricIndex.value = -1; return }
  let idx = -1
  for (let i = 0; i < store.fmLyrics.length; i++) {
    if (t >= store.fmLyrics[i].time) idx = i
    else break
  }
  if (idx !== currentLyricIndex.value) {
    currentLyricIndex.value = idx
    scrollToLyric(idx)
  }
})

function scrollToLyric(idx) {
  if (idx < 0 || !lyricsRef.value) return
  nextTick(() => {
    const el = lyricsRef.value.querySelector('.lyric-line--active')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// ==================== 音量 ====================
const volShow = ref(false)

// ==================== Computed ====================
const isLoggedIn = computed(() => store.loggedIn)
const currentFmTrack = computed(() => store.fmTrack)
const currentFmCover = computed(() => currentFmTrack.value?.cover || '')
</script>

<template>
  <div class="player">
    <!-- 未登录 -->
    <div v-if="!isLoggedIn" class="login-hint">
      <svg class="login-hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
        <path d="M8 4v4"/><path d="M12 2v4"/><path d="M16 4v4"/>
      </svg>
      <p class="login-hint-text">登录网易云账号后开启私人漫游</p>
      <button class="login-hint-btn glass-btn" @click="goHome">前往首页登录</button>
    </div>

    <template v-else>
      <!-- 初始加载（无曲目时才全屏 loading） -->
      <div v-if="!currentFmTrack && store.fmLoading" class="loading-state">
        <span class="spinner"></span> 加载私人漫游...
      </div>

      <template v-else-if="currentFmTrack">
        <!-- ========== Cover ========== -->
        <div class="cover-section">
          <div class="cover-stage">
            <div class="cover-outer-ring" :class="{ 'cover-outer-ring--active': fmPlaying }"></div>
            <div class="cover-rotator" :style="coverStyle">
              <img
                v-if="currentFmCover"
                :src="currentFmCover"
                alt=""
                class="cover-img"
                @error="e => e.target.remove()"
              />
              <div v-else class="cover-fallback">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="track-info">
            <p class="track-title">{{ currentFmTrack.name }}</p>
            <p class="track-artist">{{ currentFmTrack.artist || '—' }}</p>
            <p class="track-source">
              <template v-if="store.fmLoading">
                <span class="spinner-xs"></span> 换一批...
              </template>
              <template v-else>网易云音乐 · 私人漫游</template>
            </p>
          </div>
        </div>

        <!-- ========== Waveform ========== -->
        <canvas ref="canvasRef" class="visualizer"></canvas>

        <!-- ========== Controls ========== -->
        <div class="controls">
          <button
            class="ctrl-btn ctrl-btn--like"
            :class="{ 'ctrl-btn--liked': isLiked, 'ctrl-btn--anim': likeAnimating }"
            @click="fmLike"
            aria-label="喜欢"
            :title="isLiked ? '取消喜欢' : '添加到我喜欢的音乐'"
          >
            <svg v-if="isLiked" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <button
            class="ctrl-btn ctrl-btn--play"
            :class="{ 'ctrl-btn--loading': fmAudioLoading }"
            @click="toggleFmPlay"
            :aria-label="fmPlaying ? '暂停' : '播放'"
          >
            <svg v-if="fmAudioLoading" class="spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
            </svg>
            <svg v-else-if="!fmPlaying" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          </button>
          <button class="ctrl-btn ctrl-btn--skip" @click="fmSkip" aria-label="下一首" title="跳过">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        <!-- ========== Progress ========== -->
        <div class="progress-row">
          <span class="time">{{ fmtTime(fmCurrentTime) }}</span>
          <div
            ref="progressBarRef"
            class="progress-bar"
            :class="{ 'progress-bar--active': isDragging }"
            @pointerdown="onPointerDown"
          >
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
          </div>
          <span class="time">{{ fmtTime(fmDuration) }}</span>
        </div>

        <!-- ========== Lyrics ========== -->
        <div v-if="store.fmLyrics.length" ref="lyricsRef" class="lyrics-stage">
          <div class="lyrics-track">
            <div
              v-for="(line, i) in store.fmLyrics"
              :key="i"
              class="lyric-line"
              :class="{ 'lyric-line--active': i === currentLyricIndex }"
            >
              <span class="lyric-main">{{ line.text }}</span>
              <span v-if="line.tlrc" class="lyric-sub">{{ line.tlrc }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="store.fmLoadingLyric" class="lyrics-stage lyrics-stage--loading">
          <span class="spinner"></span> 歌词加载中...
        </div>
        <div v-else-if="currentFmTrack._songId" class="lyrics-stage lyrics-stage--empty">
          暂无歌词
        </div>

        <!-- ========== Volume ========== -->
        <div class="volume-row" @mouseenter="volShow = true" @mouseleave="volShow = false">
          <svg class="vol-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <div class="vol-slider-wrap" :class="{ 'vol-slider-wrap--show': volShow }">
            <input type="range" min="0" max="1" step="0.01" :value="store.volume" @input="store.volume = parseFloat($event.target.value)" class="vol-slider" />
          </div>
          <span class="vol-num">{{ Math.round(store.volume * 100) }}</span>
        </div>

      </template>

      <!-- 空/错误状态 -->
      <div v-else-if="store.fmError" class="loading-state loading-state--error">{{ store.fmError }}</div>
      <div v-else class="loading-state">
        <button class="start-btn glass-btn" @click="store.fetchPersonalFm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M8 4v4"/><path d="M12 2v4"/><path d="M16 4v4"/>
          </svg>
          开始漫游
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.player {
  padding: 32px 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* ==================== 未登录 ==================== */
.login-hint {
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; padding: 48px 0;
}
.login-hint-icon { width: 48px; height: 48px; color: var(--champagne); opacity: 0.5; }
.login-hint-text { font-size: 14px; color: var(--muted); }
.login-hint-btn { padding: 8px 22px; font-size: 13px; font-weight: 500; }

/* ==================== 状态 ==================== */
.loading-state {
  text-align: center; padding: 48px 0; font-size: 13px;
  color: var(--muted); display: flex; align-items: center;
  justify-content: center; gap: 8px; flex-direction: column;
}
.loading-state--error { color: var(--source-netease); }
.start-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 28px; font-size: 14px; font-weight: 500; }
.start-btn svg { width: 18px; height: 18px; }

/* ==================== Cover ==================== */
.cover-section {
  display: flex; flex-direction: column; align-items: center;
  gap: 20px; margin-bottom: 8px;
}
.cover-stage { position: relative; width: 156px; height: 156px; }

.cover-outer-ring {
  position: absolute; inset: -10px; border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  transition: all 0.8s var(--ease-out);
}
.cover-outer-ring--active {
  border-color: rgba(0, 245, 212, 0.18);
  box-shadow: 0 0 40px rgba(0, 245, 212, 0.08), inset 0 0 40px rgba(0, 245, 212, 0.04);
  animation: ring-pulse 2.5s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.06); opacity: 1; }
}
.cover-rotator {
  width: 156px; height: 156px; border-radius: 50%;
  overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.1);
  animation: spin-cover 12s linear infinite;
  animation-play-state: paused; position: relative; z-index: 1;
}
@keyframes spin-cover { to { transform: rotate(360deg); } }
.cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cover-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.03); color: var(--muted);
}
.cover-fallback svg { width: 48px; height: 48px; }

.track-info { text-align: center; max-width: 340px; }
.track-title {
  font-size: 17px; font-weight: 700; color: var(--ink);
  line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.track-artist { font-size: 12px; color: var(--muted); margin-top: 4px; }
.track-source {
  font-size: 9px; font-weight: 600; color: var(--source-netease);
  text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.spinner-xs {
  display: inline-block; width: 10px; height: 10px;
  border: 1.5px solid rgba(217, 91, 103, 0.2);
  border-top-color: rgba(217, 91, 103, 0.7); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* ==================== Waveform ==================== */
.visualizer {
  width: 100%; max-width: 480px; height: 64px;
  margin: 12px 0 8px; border-radius: 12px;
}

/* ==================== Controls ==================== */
.controls {
  display: flex; align-items: center; justify-content: center;
  gap: 18px; margin: 8px 0;
}
.ctrl-btn {
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ink-2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
}
.ctrl-btn svg { width: 16px; height: 16px; }
.ctrl-btn:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ink); transform: scale(1.05);
}

.ctrl-btn--play {
  width: 52px; height: 52px;
  border-color: rgba(0, 245, 212, 0.2);
  background: rgba(0, 245, 212, 0.08);
  color: var(--accent);
}
.ctrl-btn--play:hover {
  border-color: rgba(0, 245, 212, 0.4);
  background: rgba(0, 245, 212, 0.14);
  box-shadow: 0 0 24px rgba(0, 245, 212, 0.15);
}
.ctrl-btn--play svg { width: 20px; height: 20px; }
.ctrl-btn--loading { pointer-events: none; }

.ctrl-btn--like {
  transition: all 0.25s var(--ease-out), color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.ctrl-btn--liked {
  color: #d95b67 !important;
  border-color: rgba(217, 91, 103, 0.4) !important;
  background: rgba(217, 91, 103, 0.08) !important;
}
.ctrl-btn--like:hover {
  border-color: rgba(217, 91, 103, 0.25);
  color: #d95b67;
  background: rgba(217, 91, 103, 0.06);
}
.ctrl-btn--anim {
  animation: like-bounce 0.6s var(--ease-spring);
}
@keyframes like-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.35); }
  60% { transform: scale(0.85); }
  100% { transform: scale(1); }
}

.ctrl-btn--skip:hover {
  border-color: rgba(0, 245, 212, 0.25);
  color: var(--accent);
  background: rgba(0, 245, 212, 0.06);
}

/* ==================== Progress ==================== */
.progress-row {
  display: flex; align-items: center; gap: 9px;
  width: 100%; max-width: 480px;
}
.time {
  font-size: 10px; color: var(--muted); font-family: var(--font-mono);
  width: 34px; text-align: center; flex-shrink: 0;
}
.progress-bar {
  flex: 1; height: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px; cursor: pointer; position: relative;
  transition: height 0.2s ease;
}
.progress-bar:hover, .progress-bar--active { height: 7px; }
.progress-fill {
  height: 100%; background: var(--accent); border-radius: 3px;
  transition: width 0.15s linear; position: relative;
}
.progress-thumb {
  position: absolute; top: 50%;
  width: 11px; height: 11px; background: var(--accent);
  border-radius: 50%; transform: translate(-50%, -50%);
  opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
  box-shadow: 0 0 8px rgba(0, 245, 212, 0.3);
}
.progress-bar:hover .progress-thumb,
.progress-bar--active .progress-thumb { opacity: 1; }

/* ==================== Lyrics ==================== */
.lyrics-stage {
  width: 100%; max-width: 480px; height: 220px;
  overflow-y: auto; scroll-behavior: smooth; margin-top: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.04);
  mask-image: linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%);
}
.lyrics-stage::-webkit-scrollbar { width: 0; }
.lyrics-stage--loading,
.lyrics-stage--empty {
  display: flex; align-items: center; justify-content: center;
  height: 80px; font-size: 13px; color: var(--muted); gap: 8px; overflow: hidden;
}
.lyrics-stage--empty { height: 60px; }

.lyrics-track { padding: 80px 0; }

.lyric-line {
  padding: 10px 16px; text-align: center;
  transition: all 0.4s var(--ease-out); cursor: default;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  opacity: 0.28; filter: blur(0.6px); transform: scale(0.92);
}
.lyric-main {
  font-size: 18px; font-weight: 400;
  color: rgba(255, 255, 255, 0.82); line-height: 1.5;
  transition: all 0.4s var(--ease-out);
}
.lyric-sub {
  font-size: 13px; color: rgba(255, 255, 255, 0.32);
  line-height: 1.4; transition: all 0.4s var(--ease-out);
}
.lyric-line--active {
  opacity: 1; filter: blur(0); transform: scale(1);
}
.lyric-line--active .lyric-main {
  font-size: 22px; font-weight: 700; color: #fff;
  text-shadow: 0 0 18px rgba(0, 245, 212, 0.35), 0 0 40px rgba(0, 245, 212, 0.12);
}
.lyric-line--active .lyric-sub {
  font-size: 14px; color: rgba(0, 245, 212, 0.55);
  text-shadow: 0 0 8px rgba(0, 245, 212, 0.18);
}

/* ==================== Volume ==================== */
.volume-row {
  display: flex; align-items: center; gap: 8px; margin-top: 14px;
  padding: 6px 14px; border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.vol-icon { width: 15px; height: 15px; color: var(--muted); flex-shrink: 0; }
.vol-slider-wrap {
  width: 0; overflow: hidden;
  transition: width 0.3s var(--ease-out);
}
.vol-slider-wrap--show { width: 70px; }
.vol-slider {
  width: 100%; height: 3px;
  -webkit-appearance: none; appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px; outline: none; cursor: pointer;
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px;
  border-radius: 50%; background: var(--accent); cursor: pointer; border: none;
}
.vol-num {
  font-size: 10px; color: var(--muted); font-family: var(--font-mono);
  width: 26px; text-align: right;
}

/* ==================== Spinner ==================== */
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.spinner-svg {
  width: 24px; height: 24px;
  animation: spin 0.8s linear infinite;
}
</style>
