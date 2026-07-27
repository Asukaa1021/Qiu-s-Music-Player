<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMusicStore } from '../stores/music'
import { useAudio, freqData, updateFreqData } from '../composables/useAudio'

const store = useMusicStore()
const { togglePlay } = useAudio()

const canvasRef = ref(null)
let animId = null

// --- Waveform visualization ---
const frozenFreqData = ref(null)
let fadeAlpha = 0.08
let shrinkFactor = 0.08

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = devicePixelRatio
  const W = canvas.width = canvas.offsetWidth * dpr
  const H = canvas.height = canvas.offsetHeight * dpr
  ctx.scale(dpr, dpr)
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight

  ctx.clearRect(0, 0, w, h)
  const midY = h / 2
  const maxRadius = Math.min(h * 0.42, w * 0.32)

  if (store.isPlaying) {
    updateFreqData()
    frozenFreqData.value = new Uint8Array(freqData)
  }

  const data = store.isPlaying ? freqData : (frozenFreqData.value || freqData)
  const step = Math.max(1, Math.floor(128 / w * 2))
  const points = []

  for (let x = 0; x < w; x += step) {
    const freqIdx = Math.floor((x / w) * 64)
    const v = data[freqIdx] || 0
    const amplitude = v * maxRadius * shrinkFactor
    const yTop = midY - amplitude
    const yBot = midY + amplitude
    points.push({ x, yTop, yBot, amplitude })
  }

  const active = store.isPlaying
  const hasData = frozenFreqData.value && frozenFreqData.value.some(v => v > 0)
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

onMounted(() => { draw() })
onUnmounted(() => { cancelAnimationFrame(animId) })

// --- Formatting ---
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// --- Cover rotation ---
const coverStyle = computed(() => ({
  animationPlayState: store.isPlaying ? 'running' : 'paused',
}))

// --- Progress bar ---
const progressBarRef = ref(null)
const progress = ref(0)
const isDragging = ref(false)

watch(() => store.currentTime, () => {
  if (!isDragging.value && store.duration > 0)
    progress.value = (store.currentTime / store.duration) * 100
})

function calcSeekPct(clientX) {
  const rect = progressBarRef.value?.getBoundingClientRect()
  if (!rect) return 0
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}
function seekAt(pct) { if (store.duration > 0) store.seek(pct * store.duration) }

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

// --- Volume hover ---
const volShow = ref(false)

// --- Lyrics ---
const lyricsRef = ref(null)
const currentLyricIndex = ref(-1)

// 根据当前播放时间计算高亮歌词行
watch(() => store.currentTime, (t) => {
  if (!store.lyrics.length) { currentLyricIndex.value = -1; return }
  let idx = -1
  for (let i = 0; i < store.lyrics.length; i++) {
    if (t >= store.lyrics[i].time) idx = i
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
</script>

<template>
  <div class="player">
    <!-- ========== Cover Art ========== -->
    <div class="cover-section">
      <div class="cover-stage">
        <div class="cover-outer-ring" :class="{ 'cover-outer-ring--active': store.isPlaying }"></div>
        <div class="cover-rotator" :style="coverStyle">
          <img v-if="store.currentTrack?.cover" :src="store.currentTrack.cover" alt="" class="cover-img" />
          <div v-else class="cover-fallback">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="track-info">
        <p class="track-title">{{ store.currentTrack?.title || '未选择歌曲' }}</p>
        <p class="track-artist">{{ store.currentTrack?.artist || '—' }}</p>
        <p class="track-source" v-if="store.currentTrack?.source === 'netease'">网易云音乐</p>
        <p class="track-source track-source--local" v-else-if="store.currentTrack?.source === 'local'">本地音檔</p>
      </div>
    </div>

    <!-- ========== Waveform ========== -->
    <canvas ref="canvasRef" class="visualizer"></canvas>

    <!-- ========== Controls ========== -->
    <div class="controls">
      <button class="ctrl-btn" :disabled="!store.hasPrev" @click="store.prev()" aria-label="上一首">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
      </button>
      <button class="ctrl-btn ctrl-btn--play" :class="{ 'ctrl-btn--loading': store.audioLoading }" :disabled="store.audioLoading" @click="togglePlay()" :aria-label="store.audioLoading ? '歌曲加载中' : store.isPlaying ? '暂停' : '播放'">
        <svg v-if="store.audioLoading" class="play-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="8" opacity=".22"/><path d="M12 4a8 8 0 0 1 8 8" stroke-linecap="round"/></svg>
        <svg v-else-if="!store.isPlaying" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
      </button>
      <button class="ctrl-btn" :disabled="!store.hasNext" @click="store.next()" aria-label="下一首">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
    </div>

    <!-- ========== Progress ========== -->
    <div class="progress-row">
      <span class="time">{{ fmtTime(store.currentTime) }}</span>
      <div ref="progressBarRef" class="progress-bar" :class="{ 'progress-bar--active': isDragging }" @pointerdown="onPointerDown">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
      </div>
      <span class="time">{{ fmtTime(store.duration) }}</span>
    </div>

    <!-- ========== Lyrics ========== -->
    <div v-if="store.lyrics.length" ref="lyricsRef" class="lyrics-stage">
      <div class="lyrics-track">
        <div
          v-for="(line, i) in store.lyrics"
          :key="i"
          class="lyric-line"
          :class="{ 'lyric-line--active': i === currentLyricIndex }"
        >
          <span class="lyric-main">{{ line.text }}</span>
          <span v-if="line.tlrc" class="lyric-sub">{{ line.tlrc }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="store.loadingLyric" class="lyrics-stage lyrics-stage--loading">
      <span class="spinner"></span> 歌词加载中...
    </div>
    <div v-else-if="store.currentTrack?._songId" class="lyrics-stage lyrics-stage--empty">
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

/* ==================== Cover Section ==================== */
.cover-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 8px;
}

.cover-stage {
  position: relative;
  width: 156px;
  height: 156px;
}

/* Outer pulsing ring */
.cover-outer-ring {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
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
  width: 156px;
  height: 156px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.1);
  animation: spin-cover 12s linear infinite;
  animation-play-state: paused;
  position: relative;
  z-index: 1;
}
@keyframes spin-cover { to { transform: rotate(360deg); } }
.cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.cover-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
}
.cover-fallback svg { width: 48px; height: 48px; }

/* Track info */
.track-info {
  text-align: center;
  max-width: 340px;
}
.track-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-artist {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
.track-source {
  font-size: 9px;
  font-weight: 600;
  color: var(--source-netease);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 6px;
}
.track-source--local {
  color: var(--muted);
}

/* ==================== Waveform ==================== */
.visualizer {
  width: 100%;
  max-width: 480px;
  height: 64px;
  margin: 12px 0 8px;
  border-radius: 12px;
}

/* ==================== Controls ==================== */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin: 8px 0;
}

.ctrl-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}
.ctrl-btn svg { width: 16px; height: 16px; }
.ctrl-btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  transform: scale(1.05);
}
.ctrl-btn:disabled { opacity: 0.22; cursor: default; }
.ctrl-btn--play {
  width: 52px;
  height: 52px;
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
.ctrl-btn--loading { cursor: wait; opacity: .9 !important; }.play-spinner { animation: play-spinner-rotate .82s linear infinite; } @keyframes play-spinner-rotate { to { transform: rotate(360deg); } }

/* ==================== Progress ==================== */
.progress-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  max-width: 480px;
}
.time {
  font-size: 10px;
  color: var(--muted);
  font-family: var(--font-mono);
  width: 34px;
  text-align: center;
  flex-shrink: 0;
}
.progress-bar {
  flex: 1;
  height: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  transition: height 0.2s ease;
}
.progress-bar:hover,
.progress-bar--active {
  height: 7px;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.15s linear;
  position: relative;
}
.progress-thumb {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  background: var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(0, 245, 212, 0.3);
}
.progress-bar:hover .progress-thumb,
.progress-bar--active .progress-thumb {
  opacity: 1;
}

/* ==================== Lyrics — Mineradio style ==================== */
.lyrics-stage {
  width: 100%;
  max-width: 480px;
  height: 220px;
  overflow-y: auto;
  scroll-behavior: smooth;
  margin-top: 12px;
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
  height: 80px;
  font-size: 13px; color: var(--muted); gap: 8px;
  overflow: hidden;
}
.lyrics-stage--empty { height: 60px; }

.lyrics-track {
  padding: 80px 0;
}

.lyric-line {
  padding: 10px 16px;
  text-align: center;
  transition: all 0.4s var(--ease-out);
  cursor: default;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.28;
  filter: blur(0.6px);
  transform: scale(0.92);
}

.lyric-main {
  font-size: 18px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.5;
  transition: all 0.4s var(--ease-out);
}

.lyric-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.32);
  line-height: 1.4;
  transition: all 0.4s var(--ease-out);
}

/* Active line */
.lyric-line--active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
}
.lyric-line--active .lyric-main {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  text-shadow:
    0 0 18px rgba(0, 245, 212, 0.35),
    0 0 40px rgba(0, 245, 212, 0.12);
}
.lyric-line--active .lyric-sub {
  font-size: 14px;
  color: rgba(0, 245, 212, 0.55);
  text-shadow: 0 0 8px rgba(0, 245, 212, 0.18);
}

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ==================== Volume ==================== */
.volume-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 6px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.vol-icon {
  width: 15px;
  height: 15px;
  color: var(--muted);
  flex-shrink: 0;
}
.vol-slider-wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.3s var(--ease-out);
}
.vol-slider-wrap--show {
  width: 70px;
}
.vol-slider {
  width: 100%;
  height: 3px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}
.vol-num {
  font-size: 10px;
  color: var(--muted);
  font-family: var(--font-mono);
  width: 26px;
  text-align: right;
}
</style>
