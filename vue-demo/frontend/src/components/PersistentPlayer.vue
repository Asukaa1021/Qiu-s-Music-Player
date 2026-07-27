<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMusicStore } from '../stores/music'
import { formatTime } from '../utils/format'

const store = useMusicStore()
const router = useRouter()

const isFm = computed(() => store.activePlayback === 'fm' && !!store.fmTrack)
const track = computed(() => isFm.value ? store.fmTrack : store.currentTrack)
const title = computed(() => isFm.value ? track.value?.name : track.value?.title)
const currentTime = computed(() => isFm.value ? store.fmCurrentTime : store.currentTime)
const duration = computed(() => isFm.value ? store.fmDuration : store.duration)
const playing = computed(() => isFm.value ? store.fmIsPlaying : store.isPlaying)
const playbackLabel = computed(() => isFm.value ? (track.value?.source === 'qq' ? 'QQ 猜你喜欢' : '私人漫游') : '播放清单')
const lyrics = computed(() => isFm.value ? store.fmLyrics : store.lyrics)
const currentLyric = computed(() => {
  let line = null
  for (const item of lyrics.value) {
    if (currentTime.value >= item.time) line = item
    else break
  }
  return line
})

function toggle() {
  if (isFm.value) {
    window.dispatchEvent(new CustomEvent('melody:fm-toggle'))
  } else if (store.isPlaying) {
    store.pause()
  } else {
    store.play()
  }
}

function next() {
  if (isFm.value) window.dispatchEvent(new CustomEvent('melody:fm-next'))
  else store.next()
}

function seek(event) {
  const value = Number(event.target.value)
  if (isFm.value) window.dispatchEvent(new CustomEvent('melody:fm-seek', { detail: value }))
  else store.seek(value)
}

function openPlayer() {
  router.push({ path: '/player', query: { view: isFm.value ? 'radio' : 'continue' } })
}
</script>

<template>
  <Transition name="persistent-player">
    <section v-if="track" class="persistent-player" aria-label="当前播放">
      <button class="mini-cover" @click="openPlayer" aria-label="打开播放器">
        <img v-if="track.cover" :src="track.cover" alt="" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </button>

      <div class="mini-main">
        <button class="mini-info" @click="openPlayer">
          <span class="mini-title">{{ title || '未知歌曲' }}</span>
          <span class="mini-artist">{{ track.artist || '未知歌手' }} · {{ playbackLabel }}</span>
        </button>
        <div class="mini-lyric" :class="{ muted: !currentLyric }">
          {{ currentLyric?.text || '享受此刻的旋律' }}
          <small v-if="currentLyric?.tlrc">{{ currentLyric.tlrc }}</small>
        </div>
        <div class="mini-progress">
          <span>{{ formatTime(currentTime) }}</span>
          <input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" @input="seek" aria-label="播放进度" />
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="mini-controls">
        <button class="mini-btn mini-btn--play" :class="{ 'mini-btn--loading': store.audioLoading && !isFm }" :disabled="store.audioLoading && !isFm" @click="toggle" :aria-label="store.audioLoading && !isFm ? '歌曲加载中' : playing ? '暂停' : '播放'">
          <svg v-if="store.audioLoading && !isFm" class="mini-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8" opacity=".25"/><path d="M12 4a8 8 0 0 1 8 8" stroke-linecap="round"/></svg>
          <svg v-else-if="playing" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="mini-btn" @click="next" aria-label="下一首">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      <div class="mini-volume">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        <input type="range" min="0" max="1" step="0.01" :value="store.volume" @input="store.volume = Number($event.target.value)" aria-label="音量" />
        <span>{{ Math.round(store.volume * 100) }}</span>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.persistent-player { position: fixed; z-index: 120; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(940px, calc(100vw - 32px)); min-height: 90px; display: flex; align-items: center; gap: 16px; padding: 10px 16px 10px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 22px; background: rgba(10, 13, 17, .84); backdrop-filter: blur(26px) saturate(1.5); -webkit-backdrop-filter: blur(26px) saturate(1.5); box-shadow: 0 18px 60px rgba(0,0,0,.42), 0 0 28px rgba(0,245,212,.05); }
.mini-cover { border: 0; background: rgba(255,255,255,.04); color: var(--muted); padding: 0; width: 70px; height: 70px; flex: 0 0 auto; overflow: hidden; border-radius: 16px; cursor: pointer; }
.mini-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }.mini-cover svg { width: 28px; margin-top: 20px; }
.mini-main { flex: 1; min-width: 0; align-self: stretch; display: flex; flex-direction: column; justify-content: center; }.mini-info { padding: 0; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; overflow: hidden; }.mini-title { display: block; color: var(--ink); font-size: 13px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.mini-artist { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-lyric { margin-top: 5px; color: var(--accent); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.mini-lyric small { margin-left: 8px; color: rgba(232,236,239,.48); font-size: 10px; }.mini-lyric.muted { color: rgba(232,236,239,.35); }
.mini-progress { display: grid; grid-template-columns: 34px minmax(60px,1fr) 34px; gap: 7px; align-items: center; margin-top: 7px; color: var(--muted); font: 9px var(--font-mono); }.mini-progress input, .mini-volume input { width: 100%; accent-color: var(--accent); cursor: pointer; height: 3px; }
.mini-controls { display: flex; gap: 6px; }.mini-btn { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.08); border-radius: 50%; background: rgba(255,255,255,.04); color: var(--ink-2); cursor: pointer; transition: .2s ease; }.mini-btn:hover { color: var(--accent); border-color: rgba(0,245,212,.35); }.mini-btn svg { width: 15px; height: 15px; }.mini-btn--play { width: 40px; height: 40px; color: #071111; background: var(--accent); border-color: var(--accent); }.mini-btn--play:hover { color: #071111; transform: scale(1.05); }
.mini-btn--loading { cursor: wait; opacity: .9; }.mini-spinner { animation: mini-spinner-rotate .82s linear infinite; } @keyframes mini-spinner-rotate { to { transform: rotate(360deg); } }
.mini-volume { width: 142px; display: grid; grid-template-columns: 16px 1fr 24px; gap: 7px; align-items: center; color: var(--muted); font: 10px var(--font-mono); }.mini-volume svg { width: 16px; height: 16px; }
.persistent-player-enter-active, .persistent-player-leave-active { transition: opacity .25s var(--ease-out), transform .25s var(--ease-out); }.persistent-player-enter-from, .persistent-player-leave-to { opacity: 0; transform: translate(-50%, 18px); }
@media (max-width: 680px) { .persistent-player { gap: 10px; bottom: 12px; padding-right: 10px; min-height: 76px; }.mini-cover { width: 58px; height: 58px; border-radius: 13px; }.mini-cover svg { margin-top: 15px; }.mini-volume { display: none; }.mini-lyric { display: none; }.mini-controls { gap: 3px; }.mini-progress { margin-top: 6px; } }
@media (max-width: 420px) { .persistent-player { width: calc(100vw - 20px); gap: 8px; padding: 8px; border-radius: 18px; }.mini-cover { width: 52px; height: 52px; border-radius: 11px; }.mini-cover svg { width: 23px; margin-top: 13px; }.mini-title { font-size: 12px; }.mini-artist { font-size: 10px; }.mini-progress { grid-template-columns: 28px minmax(36px, 1fr) 28px; gap: 5px; }.mini-btn { width: 30px; height: 30px; }.mini-btn--play { width: 36px; height: 36px; } }
</style>
