<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMusicStore } from '../stores/music'
import MusicPlayer from '../components/MusicPlayer.vue'
import SearchSection from '../components/SearchSection.vue'
import PersonalRadio from '../components/PersonalRadio.vue'

const store = useMusicStore()
const route = useRoute()

const currentView = computed(() => route.query.view || 'continue')

const toast = ref({ visible: false, text: '' })
const addedIds = ref(new Set())
const addAllAnimating = ref(false)
const dailyFlippingId = ref('')
let toastTimer = null

onUnmounted(() => { clearTimeout(toastTimer) })

function showToast(song) {
  const title = song.name?.length > 20 ? song.name.slice(0, 20) + '...' : song.name
  toast.value = { visible: true, text: `已添加「${title}」` }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = { visible: false, text: '' } }, 1800)
}

function showSummaryToast(count) {
  toast.value = { visible: true, text: `已添加 ${count} 首歌曲到播放清单` }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = { visible: false, text: '' } }, 2200)
}

// 根据 view 加载数据
watch(currentView, (view) => {
  if (view === 'liked' && store.loggedIn) store.fetchLikedSongs()
  if (view === 'daily' && store.loggedIn) store.fetchDailyRecommend()
}, { immediate: true })

// 处理 ?q= 搜索参数
onMounted(() => {
  if (route.query.q) store.searchTracks(route.query.q)
})

// ==================== 播放清单 ====================
function playTrack(i) {
  if (i === store.currentIndex && store.isPlaying) {
    store.pause()
  } else {
    store.setTrack(i)
    store.play()
  }
}

async function addToPlaylist(song) {
  const id = song.id || `netease_${song._songId}`
  // 按钮弹跳动画
  const nextAdded = new Set(addedIds.value)
  nextAdded.add(id)
  addedIds.value = nextAdded
  setTimeout(() => {
    const s = new Set(addedIds.value)
    s.delete(id)
    addedIds.value = s
  }, 500)

  await store.addSearchResultToPlaylist(song)
  showToast(song)
}

function playDirect(song) {
  store.playDirect(song)
}

function playDailySong(song) {
  const id = song.id || `netease_${song._songId}`
  dailyFlippingId.value = id
  store.playDirect(song)
  setTimeout(() => {
    if (dailyFlippingId.value === id) dailyFlippingId.value = ''
  }, 700)
}

async function addAllDaily() {
  addAllAnimating.value = true
  setTimeout(() => { addAllAnimating.value = false }, 500)

  const songs = store.dailySongs
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]
    const id = song.id || `netease_${song._songId}`
    // 错开逐行动画
    setTimeout(() => {
      const nextAdded = new Set(addedIds.value)
      nextAdded.add(id)
      addedIds.value = nextAdded
      setTimeout(() => {
        const s = new Set(addedIds.value)
        s.delete(id)
        addedIds.value = s
      }, 600)
    }, i * 80)

    await store.addSearchResultToPlaylist(song)
  }

  showSummaryToast(songs.length)
}

async function addAllLiked() {
  addAllAnimating.value = true
  setTimeout(() => { addAllAnimating.value = false }, 500)

  const songs = store.likedSongs
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]
    const id = song.id || `netease_${song._songId}`
    setTimeout(() => {
      const nextAdded = new Set(addedIds.value)
      nextAdded.add(id)
      addedIds.value = nextAdded
      setTimeout(() => {
        const s = new Set(addedIds.value)
        s.delete(id)
        addedIds.value = s
      }, 600)
    }, i * 80)

    await store.addSearchResultToPlaylist(song)
  }

  showSummaryToast(songs.length)
}

// 标题映射
const viewTitle = computed(() => ({
  liked: '我喜欢',
  daily: '每日推荐',
  search: '搜索',
  radio: '私人漫游',
  continue: '继续听',
}[currentView.value] || '继续听'))

const viewIcon = computed(() => ({
  liked: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  daily: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2v8l-5 5',
  search: 'M11 2a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 2a7 7 0 1 1-7 7 7 7 0 0 1 7-7z',
  radio: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2v8l-5 5',
  continue: 'M8 5.14v14l11-7-11-7z',
}[currentView.value] || 'M8 5.14v14l11-7-11-7z'))
</script>

<template>
  <div class="player-page">
    <!-- Toast -->
    <Transition name="toast-fade">
      <div v-if="toast.visible" class="toast">{{ toast.text }}</div>
    </Transition>

    <!-- 返回按钮 + 标题 -->
    <div class="top-row">
      <router-link to="/home" class="back-btn" aria-label="返回首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span>首页</span>
      </router-link>
      <span class="top-title">{{ viewTitle }}</span>
    </div>

    <!-- ==================== 我喜欢 ==================== -->
    <div v-if="currentView === 'liked'" class="single-panel view-liked">
      <div class="view-header">
        <svg class="view-header-icon view-header-icon--rose" viewBox="0 0 24 24" fill="currentColor">
          <path :d="viewIcon"/>
        </svg>
        <span>我喜欢的曲目</span>
        <span class="view-header-count" v-if="store.likedTotal">{{ store.likedTotal }} 首</span>
        <button v-if="store.likedSongs.length" class="view-add-all glass-btn" :class="{ 'view-add-all--bounce': addAllAnimating }" @click="addAllLiked">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          全部添加
        </button>
      </div>
      <div class="view-scroll">
        <div v-if="store.loadingLiked" class="view-status"><span class="spinner"></span>加载中...</div>
        <ul v-else-if="store.likedSongs.length" class="track-list">
          <li v-for="(song, i) in store.likedSongs" :key="song.id" class="track-row" :class="{ 'track-row--added': addedIds.has(song.id || `netease_${song._songId}`) }" @click="playDirect(song)" title="播放此歌曲">
            <span class="track-idx">{{ i + 1 }}</span>
            <div class="track-cover" v-if="song.cover"><img :src="song.cover" alt="" @error="e => e.target.remove()" /></div>
            <div class="track-cover track-cover--empty" v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
            <div class="track-meta"><p class="track-name">{{ song.name }}</p><p class="track-artist">{{ song.artist }}</p></div>
            <button class="track-add-btn" aria-label="添加" @click.stop="addToPlaylist(song)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          </li>
        </ul>
        <div v-else-if="store.likedError" class="view-status view-status--error">{{ store.likedError }}</div>
        <div v-else class="view-status">暂无喜欢的歌曲</div>
      </div>
    </div>

    <!-- ==================== 每日推荐 ==================== -->
    <div v-if="currentView === 'daily'" class="single-panel view-daily">
      <div class="view-header">
        <svg class="view-header-icon view-header-icon--gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>每日推荐</span>
        <span class="view-header-count" v-if="store.dailySongs.length">{{ store.dailySongs.length }} 首</span>
        <button v-if="store.dailySongs.length" class="view-add-all glass-btn" :class="{ 'view-add-all--bounce': addAllAnimating }" @click="addAllDaily">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          全部添加
        </button>
      </div>
      <div class="view-scroll">
        <div v-if="store.loadingDaily" class="view-status"><span class="spinner"></span>加载中...</div>
        <ul v-else-if="store.dailySongs.length" class="track-list">
          <li v-for="(song, i) in store.dailySongs" :key="song.id" class="track-row track-row--daily-page" :class="{ 'track-row--added': addedIds.has(song.id || `netease_${song._songId}`), 'track-row--page-flip': dailyFlippingId === (song.id || `netease_${song._songId}`) }" :style="{ '--deck-order': Math.min(i, 8) }" @click="playDailySong(song)" title="播放此歌曲">
            <span class="track-idx">{{ i + 1 }}</span>
            <div class="track-cover" v-if="song.cover"><img :src="song.cover" alt="" @error="e => e.target.remove()" /></div>
            <div class="track-cover track-cover--empty" v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
            <div class="track-meta"><p class="track-name">{{ song.name }}</p><p class="track-artist">{{ song.artist }}</p></div>
            <button class="track-add-btn" aria-label="添加" @click.stop="addToPlaylist(song)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          </li>
        </ul>
        <div v-else-if="store.dailyError" class="view-status view-status--error">{{ store.dailyError }}</div>
        <div v-else-if="!store.loggedIn" class="view-status">请先登录网易云账号</div>
        <div v-else class="view-status">暂无推荐数据</div>
      </div>
    </div>

    <!-- ==================== 搜索 ==================== -->
    <div v-if="currentView === 'search'" class="single-panel view-search">
      <div class="view-header">
        <svg class="view-header-icon view-header-icon--cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>搜索</span>
      </div>
      <div class="view-scroll">
        <SearchSection />
      </div>
    </div>

    <!-- ==================== 私人漫游 ==================== -->
    <div v-show="currentView === 'radio'" class="single-panel view-radio">
      <div class="view-header">
        <svg class="view-header-icon view-header-icon--gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M8 4v4"/><path d="M12 2v4"/><path d="M16 4v4"/>
        </svg>
        <span>私人漫游</span>
      </div>
      <div class="view-scroll">
        <PersonalRadio />
      </div>
    </div>

    <!-- ==================== 继续听 — 播放器 + 播放清单 ==================== -->
    <div v-show="currentView === 'continue'" class="layout-continue">
      <div class="main-col">
        <div class="player-wrap">
          <MusicPlayer />
        </div>
      </div>
      <aside class="side-col">
        <div class="panel playlist-panel">
          <div class="panel-header">
            <span class="panel-header-title">播放清单</span>
            <span class="panel-header-badge" v-if="store.playlist.length">{{ store.playlist.length }} 首</span>
          </div>
          <div class="panel-scroll">
            <ul v-if="store.playlist.length" class="track-list">
              <li v-for="(t, i) in store.playlist" :key="t.id" class="track-row" :class="{ 'track-row--active': i === store.currentIndex }" @click="playTrack(i)">
                <span class="track-idx" :class="{ 'track-idx--on': i === store.currentIndex }">
                  <template v-if="i === store.currentIndex && store.isPlaying">
                    <span class="eq-bars"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></span>
                  </template>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <div class="track-cover" v-if="t.cover"><img :src="t.cover" alt="" @error="e => e.target.remove()" /></div>
                <div class="track-cover track-cover--empty" v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                <div class="track-meta"><p class="track-name">{{ t.title }}</p><p class="track-artist">{{ t.artist }}</p></div>
                <div class="track-actions">
                  <button class="track-btn" :class="{ 'track-btn--playing': i === store.currentIndex && store.isPlaying }" @click.stop="playTrack(i)" :aria-label="i === store.currentIndex && store.isPlaying ? '暂停' : '播放'">
                    <svg v-if="i === store.currentIndex && store.isPlaying" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
                  </button>
                  <button class="track-btn track-btn--del" @click.stop="store.removeTrack(i)" aria-label="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              </li>
            </ul>
            <div v-else class="playlist-empty">
              <svg class="playlist-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <p class="playlist-empty-text">播放清单是空的</p>
              <p class="playlist-empty-sub">搜索或浏览歌曲来添加</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ==================== Page ==================== */
.player-page {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 16px 24px 24px;
  overflow: hidden;
}

/* ==================== Toast ==================== */
.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 10px 24px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 245, 212, 0.3);
  box-shadow: 0 4px 24px rgba(0, 245, 212, 0.12);
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.35s var(--ease-out);
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}

/* ==================== Top Row ==================== */
.top-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted); text-decoration: none;
  font-size: 12px; font-weight: 500; letter-spacing: 0.03em;
  cursor: pointer; transition: all 220ms var(--ease-out);
  flex-shrink: 0;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
}
.back-btn svg { width: 14px; height: 14px; }
.back-btn:hover { color: var(--ink-2); border-color: rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.06); transform: translateX(-2px); }
.top-title {
  font-size: 13px; font-weight: 600; color: rgba(224, 250, 255, 0.6);
  text-transform: uppercase; letter-spacing: 0.06em;
}

/* ==================== Single Panel (liked / daily / search) ==================== */
.single-panel {
  flex: 1; min-height: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow);
  border-radius: 28px;
  display: flex; flex-direction: column;
  overflow: hidden;
}

.view-header {
  display: flex; align-items: center; gap: 10px;
  padding: 18px 24px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.view-header-icon { width: 16px; height: 16px; flex-shrink: 0; }
.view-header-icon--rose { color: var(--source-netease); }
.view-header-icon--gold { color: var(--champagne); }
.view-header-icon--cyan { color: var(--accent); }
.view-header span {
  font-size: 12px; font-weight: 600;
  color: rgba(224, 250, 255, 0.72);
  text-transform: uppercase; letter-spacing: 0.07em;
}
.view-header-count {
  font-size: 10px; color: rgba(224, 250, 255, 0.35);
  font-family: var(--font-mono); font-weight: 500;
}
.view-add-all {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 14px; font-size: 11px; font-weight: 500;
  transition: all 200ms var(--ease-out);
}
.view-add-all svg { width: 12px; height: 12px; }
.view-add-all--bounce {
  animation: all-bounce 0.5s var(--ease-spring);
  border-color: rgba(0, 245, 212, 0.45) !important;
  background: rgba(0, 245, 212, 0.12) !important;
  color: var(--accent) !important;
}
@keyframes all-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.25); }
  60% { transform: scale(0.92); }
  100% { transform: scale(1); }
}

.view-scroll {
  flex: 1; overflow-y: auto; min-height: 0;
  padding: 8px 18px 16px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 16px), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 16px), transparent 100%);
}
.view-scroll::-webkit-scrollbar { width: 4px; }
.view-scroll::-webkit-scrollbar-track { background: transparent; }
.view-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }

.view-status {
  text-align: center; padding: 48px 0; font-size: 12px; color: var(--muted);
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.view-status--error { color: var(--source-netease); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.06); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ==================== Track List ==================== */
.track-list { list-style: none; display: flex; flex-direction: column; gap: 1px; }

.track-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 12px;
  cursor: pointer; user-select: none;
  transition: background 200ms var(--ease-out);
}
.track-row:hover { background: rgba(255, 255, 255, 0.03); }
.track-row--active { background: rgba(0, 245, 212, 0.06); }

.track-idx {
  width: 24px; text-align: center; flex-shrink: 0;
  font-size: 10px; color: rgba(255, 255, 255, 0.25);
  font-family: var(--font-mono); font-weight: 500;
}
.track-idx--on { display: flex; align-items: center; justify-content: center; }

.eq-bars { display: flex; align-items: flex-end; gap: 2px; height: 13px; }
.eq-bar { width: 2px; background: var(--accent); border-radius: 1px; animation: eq-bounce 0.7s ease-in-out infinite alternate; }
.eq-bar:nth-child(1) { height: 5px; animation-delay: 0s; }
.eq-bar:nth-child(2) { height: 11px; animation-delay: 0.15s; }
.eq-bar:nth-child(3) { height: 7px; animation-delay: 0.3s; }
@keyframes eq-bounce { 0% { opacity: 0.5; transform: scaleY(0.6); } 100% { opacity: 1; transform: scaleY(1); } }

.track-cover {
  width: 40px; height: 40px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.track-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.track-cover--empty { display: flex; align-items: center; justify-content: center; }
.track-cover--empty svg { width: 16px; height: 16px; color: rgba(255, 255, 255, 0.15); }

.track-meta { flex: 1; min-width: 0; overflow: hidden; }
.track-name { font-size: 12px; font-weight: 500; color: var(--ink); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-artist { font-size: 10px; color: var(--muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-row--active .track-name { color: var(--accent); }

.track-add-btn {
  width: 28px; height: 28px; border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%; background: rgba(255, 255, 255, 0.03);
  color: var(--ink-2); cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: all 200ms var(--ease-out);
}
.track-add-btn svg { width: 12px; height: 12px; }
.track-row:hover .track-add-btn { opacity: 1; }
.track-add-btn:hover { border-color: rgba(0, 245, 212, 0.25); color: var(--accent); background: rgba(0, 245, 212, 0.06); transform: scale(1.1); }

/* 添加成功弹跳动画 */
.track-row--added .track-add-btn {
  animation: tr-bounce 0.5s var(--ease-spring);
  opacity: 1 !important;
  border-color: rgba(0, 245, 212, 0.45) !important;
  background: rgba(0, 245, 212, 0.12) !important;
  color: var(--accent) !important;
}

/* ==================== Daily recommendation page deck ==================== */
.view-daily .track-list { perspective: 1100px; padding: 5px 7px 12px; }
.track-row--daily-page {
  position: relative;
  isolation: isolate;
  margin-bottom: 7px;
  border: 1px solid rgba(255, 255, 255, 0.055);
  background: linear-gradient(105deg, rgba(255,255,255,0.055), rgba(255,255,255,0.014));
  box-shadow: 4px 5px 0 rgba(244, 210, 138, 0.035), 8px 10px 0 rgba(0, 0, 0, 0.12);
  transform-style: preserve-3d;
  transform-origin: left center;
  animation: daily-page-arrive 560ms var(--ease-out) both;
  animation-delay: calc(var(--deck-order) * 55ms);
}
.track-row--daily-page::before,
.track-row--daily-page::after {
  content: '';
  position: absolute;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
}
.track-row--daily-page::before {
  inset: 4px -5px -4px 5px;
  border: 1px solid rgba(244, 210, 138, 0.09);
  background: rgba(244, 210, 138, 0.025);
  transform: translateZ(-1px);
}
.track-row--daily-page::after {
  inset: 8px -9px -8px 9px;
  border: 1px solid rgba(255,255,255,0.035);
  background: rgba(0,0,0,0.09);
  transform: translateZ(-2px);
}
.track-row--daily-page:hover {
  background: linear-gradient(105deg, rgba(244,210,138,0.11), rgba(255,255,255,0.025));
  border-color: rgba(244, 210, 138, 0.24);
  box-shadow: 9px 13px 26px rgba(0,0,0,0.22), 0 0 20px rgba(244,210,138,0.07);
  transform: perspective(1100px) rotateY(-7deg) rotateX(1deg) translate3d(7px, -2px, 18px);
}
.track-row--daily-page.track-row--page-flip { animation: daily-page-flip 700ms var(--ease-out) both; }
@keyframes daily-page-arrive {
  from { opacity: 0; transform: rotateY(20deg) translateX(32px) translateZ(-40px); }
  to { opacity: 1; transform: rotateY(0) translateX(0) translateZ(0); }
}
@keyframes daily-page-flip {
  0% { transform: perspective(1100px) rotateY(0) translateZ(0); }
  36% { transform: perspective(1100px) rotateY(-31deg) translateX(12px) translateZ(42px); }
  66% { transform: perspective(1100px) rotateY(13deg) translateX(5px) translateZ(22px); }
  100% { transform: perspective(1100px) rotateY(0) translateZ(0); }
}
@keyframes tr-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.track-actions {
  display: flex; gap: 3px; flex-shrink: 0;
  opacity: 0; transition: opacity 200ms var(--ease-out);
}
.track-row:hover .track-actions,
.track-row--active .track-actions { opacity: 1; }

.track-btn {
  width: 28px; height: 28px; border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%; background: rgba(255, 255, 255, 0.03);
  color: var(--ink-2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 200ms var(--ease-out);
}
.track-btn svg { width: 12px; height: 12px; }
.track-btn:hover { border-color: rgba(255, 255, 255, 0.14); color: var(--accent); background: rgba(0, 245, 212, 0.06); }
.track-btn--playing { background: rgba(0, 245, 212, 0.1); border-color: rgba(0, 245, 212, 0.22); color: var(--accent); box-shadow: 0 0 14px rgba(0, 245, 212, 0.08); }
.track-btn--del:hover { border-color: rgba(217, 91, 103, 0.25); color: var(--source-netease); background: rgba(217, 91, 103, 0.06); }

/* ==================== Continue Layout ==================== */
.layout-continue {
  display: flex; gap: 20px;
  align-items: center;
  flex: 1; min-height: 0;
}
.main-col { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; }
.player-wrap { width: 100%; max-width: 640px; }

.side-col {
  width: 320px; flex-shrink: 0;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 160px);
  align-self: stretch;
  justify-content: center;
}

.panel {
  flex: 1; min-height: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow: var(--glass-shadow);
  border-radius: 28px;
  display: flex; flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.panel-header-title {
  font-size: 12px; font-weight: 600;
  color: rgba(224, 250, 255, 0.72);
  text-transform: uppercase; letter-spacing: 0.07em;
}
.panel-header-badge {
  font-size: 10px; color: rgba(224, 250, 255, 0.38);
  font-family: var(--font-mono); font-weight: 500;
}

.panel-scroll {
  flex: 1; overflow-y: auto; padding: 6px 14px 16px; min-height: 0;
  mask-image: linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 16px), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 16px), transparent 100%);
}
.panel-scroll::-webkit-scrollbar { width: 4px; }
.panel-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }

.playlist-empty { text-align: center; padding: 48px 0 32px; }
.playlist-empty-icon { width: 36px; height: 36px; color: rgba(255, 255, 255, 0.12); margin-bottom: 10px; }
.playlist-empty-text { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 2px; }
.playlist-empty-sub { font-size: 10px; color: var(--muted); }

@media (max-width: 900px) {
  .layout-continue { flex-direction: column; }
  .side-col { width: 100%; max-height: none; }
}
</style>
