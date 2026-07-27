import { watch, onUnmounted, reactive } from 'vue'
import { useMusicStore } from '../stores/music'

let audio = null
let audioCtx = null
let analyser = null
let source = null
const preloaders = new Map()
const PRELOAD_COUNT = 2

// 频谱数据（128 个频段，0-1 范围）
export const freqData = reactive(new Float32Array(128).fill(0))

function getAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
  }
  return audio
}

function absoluteSrc(src) {
  try { return new URL(src, window.location.origin).href } catch { return src || '' }
}

// 使用独立 Audio 元素提前请求后续曲目的媒体分段。正式播放器采用同一 URL，
// 可命中浏览器缓存；保留两首上限，避免占满移动网络和内存。
function preloadUpcomingTracks(store) {
  const start = store.currentIndex + 1
  const upcoming = store.playlist.slice(start, start + PRELOAD_COUNT)
  const wanted = new Set(upcoming.map(track => absoluteSrc(track?.src)).filter(Boolean))

  for (const [src, preloader] of preloaders) {
    if (!wanted.has(src)) {
      preloader.pause()
      preloader.removeAttribute('src')
      preloader.load()
      preloaders.delete(src)
    }
  }

  for (const track of upcoming) {
    const src = absoluteSrc(track?.src)
    if (!src || preloaders.has(src)) continue
    const preloader = new Audio()
    preloader.preload = 'auto'
    preloader.src = src
    preloader.load()
    preloaders.set(src, preloader)
  }
}

function setupAnalyser() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (!source) {
    source = audioCtx.createMediaElementSource(audio)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.65
    source.connect(analyser)
    analyser.connect(audioCtx.destination)
  }
}

function resumeCtx() {
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume()
  }
}

// 更新频谱数据（由 requestAnimationFrame 驱动）
export function updateFreqData() {
  if (!analyser) return
  const buf = new Uint8Array(128)
  analyser.getByteFrequencyData(buf)
  for (let i = 0; i < 128; i++) {
    freqData[i] = buf[i] / 255
  }
}

export function useAudio() {
  const store = useMusicStore()
  const el = getAudio()

  // --- 事件绑定 ---
  let bound = false
  function bind() {
    if (bound) return
    bound = true

    el.addEventListener('loadedmetadata', () => {
      store.duration = el.duration
    })

    el.addEventListener('loadstart', () => { store.audioLoading = true })
    el.addEventListener('waiting', () => { store.audioLoading = true })
    el.addEventListener('playing', () => { store.audioLoading = false })
    el.addEventListener('canplaythrough', () => { store.audioLoading = false })

    el.addEventListener('timeupdate', () => {
      store.currentTime = el.currentTime
    })

    el.addEventListener('ended', () => {
      if (store.hasNext) {
        store.next()
      } else {
        store.pause()
        store.currentTime = 0
        store.currentIndex = -1
      }
    })

    el.addEventListener('error', () => {
      if (store.currentTrack?.src) console.warn('音频载入失败:', store.currentTrack?.title)
      store.audioLoading = false
      store.pause()
    })
  }

  bind()

  // --- 播放控制 ---
  let playSeq = 0  // 序列号，防止快速切歌时旧 Promise 覆盖状态

  function loadAndPlay() {
    const track = store.currentTrack
    if (!track) return
    store.audioLoading = true

    let srcChanged = el.src !== track.src
    if (el.src && track.src && !el.src.startsWith('blob:') && !track.src.startsWith('blob:')) {
      try {
        const elUrl = new URL(el.src).href
        // track.src 可能是相对路径，需要用 origin 解析
        const trackUrl = new URL(track.src, window.location.origin).href
        srcChanged = elUrl !== trackUrl
      } catch {
        srcChanged = el.src !== track.src
      }
    }

    if (srcChanged) {
      el.src = track.src
      el.load()
    }

    el.volume = store.volume
    setupAnalyser()
    resumeCtx()

    const seq = ++playSeq
    el.play()
      .then(() => { if (seq === playSeq) store.play() })
      .catch(() => { if (seq === playSeq) { store.audioLoading = false; store.pause() } })
  }

  // 监听播放/暂停
  watch(() => store.isPlaying, (playing) => {
    if (!store.currentTrack) return
    if (playing) {
      loadAndPlay()
    } else {
      el.pause()
    }
  })

  // 监听当前曲目（包括播放清单切歌及单击插队播放）
  watch(() => store.currentTrack, (track, previousTrack) => {
    if (!track) {
      el.pause()
      el.src = ''
      store.audioLoading = false
      store.pause()
      store.currentTime = 0
      store.duration = 0
      return
    }
    if (track !== previousTrack) {
      store.currentTime = 0
      store.duration = 0
    }
    if (store.isPlaying) {
      loadAndPlay()
    }
    preloadUpcomingTracks(store)
  })

  watch(() => store.playlist.length, () => preloadUpcomingTracks(store))

  // 监听音量
  watch(() => store.volume, (v) => { el.volume = v })

  // 监听 seek
  let seeking = false
  watch(() => store.currentTime, (t) => {
    if (!seeking && Math.abs(el.currentTime - t) > 0.5) {
      el.currentTime = t
    }
  })

  // --- 对外暴露 ---
  function togglePlay() {
    if (!store.currentTrack) return
    if (store.isPlaying) {
      store.pause()
    } else {
      store.play()
    }
  }

  function seekTo(time) {
    seeking = true
    el.currentTime = time
    store.currentTime = time
    seeking = false
  }

  onUnmounted(() => {
    el.pause()
    el.src = ''
    el.removeAttribute('src')
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
      source = null
      analyser = null
    }
    audio = null  // 强制下次 mount 创建新 Audio 元素，避免 MediaElementSource 重复绑定
    for (const preloader of preloaders.values()) {
      preloader.pause()
      preloader.removeAttribute('src')
      preloader.load()
    }
    preloaders.clear()
  })

  return { togglePlay, seekTo }
}
