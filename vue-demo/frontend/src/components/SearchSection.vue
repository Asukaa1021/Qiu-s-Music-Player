<script setup>
import { ref, watch, onMounted } from 'vue'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()
const keyword = ref('')
let debounceTimer = null

function doSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.searchTracks(keyword.value) }, 400)
}
watch(keyword, doSearch)

function searchNow() {
  if (debounceTimer) clearTimeout(debounceTimer)
  store.searchTracks(keyword.value)
}
function onKeydown(e) { if (e.key === 'Enter') searchNow() }

function onAddTrack(song) { store.addSearchResultToPlaylist(song) }
function onPlayTrack(song) { store.playDirect(song) }
function getTrackId(song) { return song.id || `netease_${song._songId}` }
function isLoading(song) { return store.loadingTrackIds.has(getTrackId(song)) }
function loadMore() { store.loadMoreResults() }

onMounted(() => { store.fetchRecommended() })
</script>

<template>
  <div class="search">
    <!-- Search Bar -->
    <div class="search-bar">
      <svg class="search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input v-model="keyword" class="search-input" type="text" placeholder="搜索歌曲或歌手..." @keydown="onKeydown" />
      <button v-if="keyword" class="search-clear" @click="keyword = ''; searchNow()" aria-label="清除">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Searching -->
    <div v-if="store.searching" class="status"><span class="spinner"></span>搜索中...</div>

    <!-- Error with no results -->
    <div v-else-if="store.searchError && store.searchResults.length === 0 && keyword" class="status status--error">{{ store.searchError }}</div>

    <!-- Recommended (no search keyword) -->
    <div v-else-if="!keyword && store.searchResults.length === 0" class="recommended">
      <div class="rec-head">
        <svg class="rec-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span class="rec-label">推荐新歌</span>
        <button class="rec-refresh" @click="store.fetchRecommended()" :disabled="store.loadingRecommended" aria-label="刷新">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <div v-if="store.loadingRecommended" class="status"><span class="spinner"></span>加载中...</div>

      <ul v-else-if="store.recommendedSongs.length > 0" class="results">
        <li v-for="song in store.recommendedSongs" :key="getTrackId(song)" class="result-row" @click="onPlayTrack(song)" title="播放此歌曲">
          <div class="result-cover">
            <img v-if="song.cover" :src="song.cover" alt="" loading="lazy" @error="e => e.target.remove()" />
            <svg v-else class="cover-ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="result-meta">
            <p class="result-name">{{ song.name }}</p>
            <p class="result-artist">{{ song.artist }}</p>
          </div>
          <span class="src-tag">网易云</span>
          <button class="add-btn" :class="{ 'add-btn--busy': isLoading(song) }" :disabled="isLoading(song)" @click.stop="onAddTrack(song)" aria-label="添加到播放清单">
            <svg v-if="!isLoading(song)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span v-else class="mini-spinner"></span>
          </button>
        </li>
      </ul>
    </div>

    <!-- Search Results -->
    <ul v-if="store.searchResults.length > 0" class="results">
      <li v-for="song in store.searchResults" :key="getTrackId(song)" class="result-row" @click="onPlayTrack(song)" title="播放此歌曲">
        <div class="result-cover">
          <img v-if="song.cover" :src="song.cover" alt="" loading="lazy" @error="e => e.target.remove()" />
          <svg v-else class="cover-ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div class="result-meta">
          <p class="result-name">{{ song.name }}</p>
          <p class="result-artist">{{ song.artist }}</p>
        </div>
        <span class="src-tag">网易云</span>
        <button class="add-btn" :class="{ 'add-btn--busy': isLoading(song) }" :disabled="isLoading(song)" @click.stop="onAddTrack(song)" aria-label="添加到播放清单">
          <svg v-if="!isLoading(song)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span v-else class="mini-spinner"></span>
        </button>
      </li>
    </ul>

    <!-- Load More -->
    <div v-if="store.searchResults.length > 0 && store.searchHasMore" class="load-more">
      <button class="load-more-btn" :disabled="store.searching" @click="loadMore">
        <span v-if="store.searching" class="spinner"></span>
        <span v-else>加载更多</span>
      </button>
    </div>
    <div v-else-if="store.searchResults.length > 0 && !store.searchHasMore" class="load-more">
      <span class="load-more-end">— 全部结果 —</span>
    </div>
  </div>
</template>

<style scoped>
.search { display: flex; flex-direction: column; gap: 4px; }

/* ==================== Search Bar ==================== */
.search-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 0 14px;
  height: 38px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 9999px;
  transition: border-color 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
}
.search-bar:focus-within {
  border-color: rgba(0, 245, 212, 0.25);
  box-shadow: 0 0 0 3px rgba(0, 245, 212, 0.06);
}
.search-bar-icon { width: 14px; height: 14px; color: var(--muted); flex-shrink: 0; }
.search-input {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  color: var(--ink); font-size: 12px; font-family: var(--font-sans);
}
.search-input::placeholder { color: rgba(138, 144, 153, 0.4); }
.search-clear {
  width: 22px; height: 22px; border: none; border-radius: 50%;
  background: rgba(255, 255, 255, 0.06); color: var(--muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all var(--transition);
}
.search-clear svg { width: 9px; height: 9px; }
.search-clear:hover { background: rgba(255, 255, 255, 0.12); color: var(--ink-2); }

/* ==================== Status ==================== */
.status {
  text-align: center; padding: 20px 0 12px;
  font-size: 11px; color: var(--muted);
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.status--error { color: var(--source-netease); }

.spinner { width: 13px; height: 13px; border: 2px solid rgba(255, 255, 255, 0.06); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
.mini-spinner { width: 11px; height: 11px; border: 2px solid rgba(255, 255, 255, 0.08); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ==================== Recommended ==================== */
.recommended { margin-top: 4px; }
.rec-head {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; margin-bottom: 4px;
}
.rec-star { width: 12px; height: 12px; color: var(--champagne); flex-shrink: 0; }
.rec-label {
  font-size: 10px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.rec-refresh {
  margin-left: auto; width: 24px; height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 50%;
  background: transparent; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
}
.rec-refresh svg { width: 12px; height: 12px; }
.rec-refresh:hover:not(:disabled) { border-color: rgba(0, 245, 212, 0.25); color: var(--accent); }
.rec-refresh:disabled { opacity: 0.3; animation: spin 0.6s linear infinite; }

/* ==================== Results List ==================== */
.results { list-style: none; display: flex; flex-direction: column; gap: 1px; }

.result-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 180ms var(--ease-out);
}
.result-row:hover { background: rgba(255, 255, 255, 0.03); }

.result-cover {
  width: 34px; height: 34px; border-radius: 6px;
  overflow: hidden; flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
}
.result-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-ph { width: 100%; height: 100%; padding: 6px; color: rgba(255, 255, 255, 0.1); }

.result-meta { flex: 1; min-width: 0; overflow: hidden; }
.result-name {
  font-size: 11px; font-weight: 500; color: var(--ink-2);
  line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.result-artist {
  font-size: 10px; color: var(--muted); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.src-tag {
  font-size: 9px; font-weight: 600; padding: 2px 7px;
  border-radius: 4px; border: 1px solid rgba(217, 91, 103, 0.25);
  color: var(--source-netease); flex-shrink: 0;
  line-height: 1.4;
}

.add-btn {
  width: 26px; height: 26px; border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%; background: transparent;
  color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all var(--transition);
}
.add-btn svg { width: 13px; height: 13px; }
.add-btn:hover:not(:disabled) { border-color: rgba(0, 245, 212, 0.25); color: var(--accent); background: rgba(0, 245, 212, 0.06); transform: scale(1.08); }
.add-btn:active:not(:disabled) { transform: scale(0.9); }
.add-btn:disabled { opacity: 0.3; cursor: default; }
.add-btn--busy { border-color: rgba(0, 245, 212, 0.12); }

/* ==================== Load More ==================== */
.load-more { text-align: center; padding: 8px 0 4px; }
.load-more-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 20px; border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9999px; background: transparent;
  color: var(--muted); font-size: 11px; font-family: var(--font-sans);
  cursor: pointer; transition: all var(--transition);
}
.load-more-btn:hover:not(:disabled) { border-color: rgba(0, 245, 212, 0.25); color: var(--accent); }
.load-more-btn:disabled { opacity: 0.4; cursor: default; }
.load-more-end { font-size: 10px; color: rgba(138, 144, 153, 0.4); }
</style>
