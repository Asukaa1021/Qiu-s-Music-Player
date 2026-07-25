<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()
const router = useRouter()

const searchQuery = ref('')
const showDropdown = ref(false)
const searchWrapRef = ref(null)
const toast = ref({ visible: false, text: '' })
let debounceTimer = null
let toastTimer = null
// 记录刚添加的歌曲 ID，用于按钮动画
const addedIds = ref(new Set())

onMounted(() => {
  if (store.loggedIn && store.likedSongs.length === 0) {
    store.fetchLikedSongs()
  }
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  clearTimeout(debounceTimer)
  clearTimeout(toastTimer)
})

function onClickOutside(e) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

watch(searchQuery, (val) => {
  clearTimeout(debounceTimer)
  const q = val.trim()
  if (!q) {
    showDropdown.value = false
    store.searchResults = []
    return
  }
  debounceTimer = setTimeout(() => {
    store.searchTracks(q)
    showDropdown.value = true
  }, 300)
})

function onLoginClick() {
  store.showLoginPanel = true
}

function onSearchFocus() {
  if (searchQuery.value.trim() && store.searchResults.length) {
    showDropdown.value = true
  }
}

function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  router.push({ path: '/player', query: { view: 'search', q } })
}

function onCardClick(view) {
  if ((view === 'daily' || view === 'liked' || view === 'radio') && !store.loggedIn) {
    store.showLoginPanel = true
    return
  }
  router.push({ path: '/player', query: { view } })
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

  // Toast 提示
  const title = song.name?.length > 20 ? song.name.slice(0, 20) + '...' : song.name
  toast.value = { visible: true, text: `已添加「${title}」` }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = { visible: false, text: '' }
  }, 1800)
}
</script>

<template>
  <div class="home">
    <!-- Toast -->
    <Transition name="toast-fade">
      <div v-if="toast.visible" class="toast">{{ toast.text }}</div>
    </Transition>

    <!-- ==================== Top Bar ==================== -->
    <div class="topbar">
      <button
        class="glass-btn login-btn"
        :class="{ 'login-btn--logged': store.loggedIn }"
        @click="onLoginClick"
        aria-label="帐号"
        title="网易云登入"
      >
        <template v-if="store.loggedIn && store.qrAvatarUrl">
          <img
            :src="store.qrAvatarUrl"
            class="login-avatar"
            alt=""
            referrerpolicy="no-referrer"
            @error="e => e.target.remove()"
          />
          <span class="login-nick">{{ store.qrNickname || '用户' }}</span>
        </template>
        <template v-else>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span>登录</span>
        </template>
      </button>
    </div>

    <!-- ==================== Search Area ==================== -->
    <div ref="searchWrapRef" class="search-area">
      <div class="search-wrap">
        <svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索歌曲或歌手..."
          @focus="onSearchFocus"
          @keydown.enter="doSearch"
        />
        <button class="search-go" @click="doSearch" aria-label="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      <!-- 实时搜索下拉 -->
      <div v-if="showDropdown" class="search-dropdown">
        <div v-if="store.searching" class="dd-loading">
          <span class="spinner-sm"></span> 搜索中...
        </div>
        <template v-else-if="store.searchResults.length">
          <div class="dd-list">
            <div
              v-for="song in store.searchResults.slice(0, 8)"
              :key="song.id"
              class="dd-item"
              :class="{ 'dd-item--added': addedIds.has(song.id || `netease_${song._songId}`) }"
            >
              <img
                v-if="song.cover"
                :src="song.cover"
                class="dd-cover"
                alt=""
                loading="lazy"
                @error="e => e.target.remove()"
              />
              <div v-else class="dd-cover dd-cover--placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div class="dd-meta">
                <p class="dd-title">{{ song.name }}</p>
                <p class="dd-artist">{{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span></p>
              </div>
              <button
                class="dd-add"
                :disabled="store.loadingTrackIds.has(song.id || `netease_${song._songId}`)"
                @click="addToPlaylist(song)"
                title="添加到播放清单"
                aria-label="添加到播放清单"
              >
                <svg v-if="store.loadingTrackIds.has(song.id || `netease_${song._songId}`)" class="spinner-sm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="dd-footer">
            <span>共 {{ store.searchResults.length }} 条结果</span>
            <button class="dd-more" @click="doSearch">查看全部 →</button>
          </div>
        </template>
        <div v-else class="dd-empty">未找到结果</div>
      </div>
    </div>

    <!-- ==================== 4 Card Grid ==================== -->
    <section class="card-grid">
      <!-- 我喜欢 -->
      <div class="home-card" data-tone="liked" @click="onCardClick('liked')">
        <div class="card-accent card-accent--rose"></div>
        <div class="card-body">
          <div class="card-icon card-icon--liked">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span class="card-label">Liked</span>
          <h3 class="card-title">我喜欢</h3>
          <p class="card-sub">{{ store.loggedIn ? `${store.likedTotal || 0} 首收藏歌曲` : '登录后同步你的喜欢' }}</p>
        </div>
      </div>

      <!-- 每日推荐 -->
      <div class="home-card" data-tone="daily" @click="onCardClick('daily')">
        <div class="card-accent card-accent--champagne"></div>
        <div class="card-body">
          <div class="card-icon card-icon--daily">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <span class="card-label">Daily</span>
          <h3 class="card-title">每日推荐</h3>
          <p class="card-sub">{{ store.loggedIn ? '基于你的口味推荐' : '登录后获取今日推荐' }}</p>
        </div>
      </div>

      <!-- 私人漫游 -->
      <div class="home-card" data-tone="radio" @click="onCardClick('radio')">
        <div class="card-accent card-accent--gold"></div>
        <div class="card-body">
          <div class="card-icon card-icon--radio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="M8 4v4"/><path d="M12 2v4"/><path d="M16 4v4"/>
            </svg>
          </div>
          <span class="card-label">Radio</span>
          <h3 class="card-title">私人漫游</h3>
          <p class="card-sub">{{ store.loggedIn ? 'AI 推荐你喜欢的歌' : '登录后开启智能推荐' }}</p>
        </div>
      </div>

      <!-- 继续听 -->
      <div class="home-card" data-tone="continue" @click="onCardClick('continue')">
        <div class="card-accent card-accent--cyan"></div>
        <div class="card-body">
          <div class="card-icon card-icon--continue">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z"/>
            </svg>
          </div>
          <span class="card-label">Continue</span>
          <h3 class="card-title">继续听</h3>
          <p class="card-sub">{{ store.currentTrack ? store.currentTrack.title : '播放器和播放清单' }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ==================== Layout ==================== */
.home {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 clamp(16px, 4vw, 48px) 132px;
  overflow-y: auto;
  overflow-x: hidden;
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

/* ==================== Top Bar ==================== */
.topbar {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  z-index: 10;
}

.login-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
}
.login-btn svg { width: 15px; height: 15px; }
.login-btn--logged {
  padding: 4px 14px 4px 4px;
  border-color: rgba(0, 245, 212, 0.25);
  background: rgba(0, 245, 212, 0.04);
}
.login-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid rgba(0, 245, 212, 0.3);
}
.login-nick {
  font-size: 12px; font-weight: 500;
  color: var(--ink-2);
  max-width: 80px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ==================== Search Area ==================== */
.search-area {
  margin-top: 72px;
  margin-bottom: 48px;
  width: 100%;
  max-width: 520px;
}
.search-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 0 18px; height: 48px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  transition: border-color 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
}
.search-wrap:focus-within {
  border-color: rgba(0, 245, 212, 0.35);
  box-shadow: 0 0 0 3px rgba(0, 245, 212, 0.08), 0 4px 24px rgba(0, 0, 0, 0.4);
}
.search-svg { width: 18px; height: 18px; color: var(--muted); flex-shrink: 0; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--ink); font-size: 14px; font-family: var(--font-sans); min-width: 0;
}
.search-input::placeholder { color: rgba(138, 144, 153, 0.5); }
.search-go {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: rgba(0, 245, 212, 0.1); color: var(--accent);
  cursor: pointer; flex-shrink: 0; transition: all var(--transition);
}
.search-go svg { width: 14px; height: 14px; }
.search-go:hover { background: rgba(0, 245, 212, 0.2); box-shadow: 0 0 16px rgba(0, 245, 212, 0.15); }

/* ==================== Search Dropdown ==================== */
.search-area {
  position: relative;
}

.search-dropdown {
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  background: rgba(12, 15, 18, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
  overflow: hidden;
  z-index: 50;
  max-height: 420px;
  overflow-y: auto;
}
.search-dropdown::-webkit-scrollbar { width: 4px; }
.search-dropdown::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

.dd-loading,
.dd-empty {
  padding: 28px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dd-list {
  padding: 6px;
}

.dd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.dd-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.dd-cover {
  width: 40px; height: 40px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.dd-cover--placeholder {
  background: rgba(255, 255, 255, 0.04);
  display: flex; align-items: center; justify-content: center;
  color: var(--muted);
}
.dd-cover--placeholder svg { width: 18px; height: 18px; }

.dd-meta {
  flex: 1;
  min-width: 0;
}
.dd-title {
  font-size: 13px; font-weight: 600;
  color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dd-artist {
  font-size: 11px; color: var(--muted);
  margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.dd-add {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}
.dd-add svg { width: 14px; height: 14px; }
.dd-add:hover:not(:disabled) {
  border-color: rgba(0, 245, 212, 0.35);
  background: rgba(0, 245, 212, 0.08);
  color: var(--accent);
}
.dd-add:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* 添加成功弹跳动画 */
.dd-item--added .dd-add {
  animation: dd-bounce 0.5s var(--ease-spring);
  border-color: rgba(0, 245, 212, 0.45) !important;
  background: rgba(0, 245, 212, 0.12) !important;
  color: var(--accent) !important;
}
@keyframes dd-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.dd-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 14px;
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.dd-more {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.dd-more:hover { opacity: 0.7; }

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: dd-spin 0.6s linear infinite;
  display: inline-block;
}
.spinner-sm-svg {
  width: 14px; height: 14px;
  animation: dd-spin 0.8s linear infinite;
}
@keyframes dd-spin { to { transform: rotate(360deg); } }

/* ==================== Card Grid ==================== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  width: 100%;
  max-width: 600px;
}

.home-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s var(--ease-out);
}
.home-card:hover {
  transform: translateY(-3px);
  border-color: rgba(0, 245, 212, 0.3);
  box-shadow: 0 8px 32px rgba(0, 245, 212, 0.06), 0 0 0 1px rgba(0, 245, 212, 0.1);
}

.card-accent { height: 3px; width: 100%; }
.card-accent--rose { background: linear-gradient(90deg, var(--source-netease), rgba(217, 91, 103, 0.3)); }
.card-accent--champagne { background: linear-gradient(90deg, var(--champagne), rgba(244, 210, 138, 0.3)); }
.card-accent--gold { background: linear-gradient(90deg, #f4d28a, rgba(244, 210, 138, 0.3)); }
.card-accent--cyan { background: linear-gradient(90deg, var(--accent), rgba(0, 245, 212, 0.3)); }

.card-body {
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}
.card-icon svg { width: 20px; height: 20px; }
.card-icon--liked { background: rgba(217, 91, 103, 0.1); color: var(--source-netease); }
.card-icon--daily { background: rgba(244, 210, 138, 0.1); color: var(--champagne); }
.card-icon--search,
.card-icon--continue { background: rgba(0, 245, 212, 0.08); color: var(--accent); }
.card-icon--radio { background: rgba(244, 210, 138, 0.08); color: var(--champagne); }
.card-label {
  font-size: 10px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.card-title {
  font-family: var(--font-sans);
  font-size: 20px; font-weight: 700;
  color: var(--ink); margin: 0; line-height: 1.2;
}
.card-sub {
  font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5;
}

@media (max-width: 900px) {
  .search-area { margin-top: 56px; margin-bottom: 32px; max-width: 500px; }
  .card-grid { max-width: 560px; gap: 18px; }
  .card-body { padding: 24px 20px 20px; }
}

@media (max-width: 600px) {
  .home { padding-left: 16px; padding-right: 16px; padding-bottom: 112px; }
  .topbar { right: 16px; }
  .search-area { margin-top: 58px; margin-bottom: 26px; max-width: none; }
  .search-wrap { height: 46px; padding: 0 14px; }
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .home-card { border-radius: 20px; }
  .card-body { min-height: 148px; padding: 18px 15px 16px; gap: 7px; }
  .card-icon { width: 34px; height: 34px; border-radius: 10px; margin-bottom: 2px; }
  .card-icon svg { width: 17px; height: 17px; }
  .card-title { font-size: 17px; }
  .card-sub { font-size: 11px; line-height: 1.4; }
  .login-btn { padding: 5px 12px; }
}

@media (max-width: 380px) {
  .home { padding-left: 12px; padding-right: 12px; }
  .card-grid { gap: 9px; }
  .card-body { min-height: 136px; padding: 15px 12px; }
  .card-title { font-size: 16px; }
  .card-sub { font-size: 10px; }
}

@media (max-height: 700px) and (min-width: 601px) {
  .search-area { margin-top: 38px; margin-bottom: 24px; }
  .card-grid { gap: 16px; }
  .card-body { padding: 20px 20px 18px; }
}

@media (max-height: 620px) {
  .search-area { margin-top: 30px; margin-bottom: 18px; }
  .card-body { min-height: 0; padding: 15px; }
  .card-sub { display: none; }
}
</style>
