<script setup>
import { useMusicStore } from '../stores/music'

const store = useMusicStore()

const playTrack = (i) => {
  if (i === store.currentIndex && store.isPlaying) {
    store.pause()
  } else {
    store.setTrack(i)
    store.play()
  }
}
</script>

<template>
  <div class="playlist-page">
    <div class="playlist-header glass-lg">
      <div class="header-row">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </div>
        <div class="header-meta">
          <h2 class="header-title">播放清单</h2>
          <p class="header-count" v-if="store.playlist.length">共 <strong>{{ store.playlist.length }}</strong> 首歌曲</p>
        </div>
      </div>
    </div>

    <div class="playlist-body glass-lg">
      <ul class="tracks" v-if="store.playlist.length">
        <li
          v-for="(t, i) in store.playlist"
          :key="t.id"
          class="row"
          :class="{ 'row--active': i === store.currentIndex }"
          @click="playTrack(i)"
        >
          <span class="row-index" :class="{ 'row-index--on': i === store.currentIndex }">
            <template v-if="i === store.currentIndex && store.isPlaying">
              <span class="eq-bars">
                <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
              </span>
            </template>
            <template v-else>{{ i + 1 }}</template>
          </span>

          <div class="row-cover" v-if="t.cover">
            <img :src="t.cover" alt="" loading="lazy" @error="e => e.target.remove()" />
          </div>
          <div class="row-cover row-cover--empty" v-else>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>

          <div class="row-meta">
            <p class="row-title">{{ t.title }}</p>
            <p class="row-artist">{{ t.artist }}</p>
          </div>

          <div class="row-actions">
            <button
              class="act-btn"
              :class="{ 'act-btn--playing': i === store.currentIndex && store.isPlaying }"
              @click.stop="playTrack(i)"
              :aria-label="i === store.currentIndex && store.isPlaying ? '暂停' : '播放'"
            >
              <svg v-if="i === store.currentIndex && store.isPlaying" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v14l11-7-11-7z"/>
              </svg>
            </button>
            <button class="act-btn act-btn--del" @click.stop="store.removeTrack(i)" aria-label="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </li>
      </ul>

      <div class="empty" v-else>
        <div class="empty-ring">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <p class="empty-title">播放清單是空的</p>
        <p class="empty-sub">回到首頁新增歌曲吧</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playlist-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Header card */
.playlist-header {
  padding: var(--space-5) var(--space-6);
}

.header-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(0, 245, 212, 0.06);
  border: 1px solid rgba(0, 245, 212, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

.header-icon svg {
  width: 18px;
  height: 18px;
}

.header-meta {
  min-width: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  letter-spacing: -0.01em;
}

.header-count {
  font-size: 11px;
  color: var(--muted);
  margin: 2px 0 0 0;
}

.header-count strong {
  color: var(--accent);
  font-weight: 600;
}

/* Body card */
.playlist-body {
  padding: var(--space-3);
  min-height: 200px;
}

/* Track list */
.tracks {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 480px;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-base);
  border: 1px solid transparent;
  position: relative;
}

.row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.row--active {
  background: rgba(0, 245, 212, 0.04);
  border-color: rgba(0, 245, 212, 0.1);
  box-shadow: 0 0 16px rgba(0, 245, 212, 0.03);
}

/* Index */
.row-index {
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--faint);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.row-index--on {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* EQ bars animation (Mineradio style) */
.eq-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.eq-bar {
  width: 2.5px;
  background: var(--accent);
  border-radius: 1px;
  animation: eq-bounce 0.7s ease-in-out infinite alternate;
}

.eq-bar:nth-child(1) { height: 6px; animation-delay: 0s; }
.eq-bar:nth-child(2) { height: 12px; animation-delay: 0.15s; }
.eq-bar:nth-child(3) { height: 8px; animation-delay: 0.3s; }

@keyframes eq-bounce {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}

.row--active .row-index {
  color: var(--accent);
}

/* Cover */
.row-cover {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-xs);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--hair);
  border: 1px solid var(--hair-2);
}

.row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.row-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-cover--empty svg {
  width: 18px;
  height: 18px;
  color: var(--faint);
}

/* Meta */
.row-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-artist {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.3;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row--active .row-title {
  color: var(--accent);
}

/* Actions */
.row-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
  opacity: 0.3;
  transition: opacity var(--transition-base);
}

.row:hover .row-actions,
.row--active .row-actions {
  opacity: 1;
}

.act-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--hair-2);
  border-radius: var(--radius-full);
  background: var(--hair);
  color: var(--ink-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  outline: none;
}

.act-btn svg {
  width: 14px;
  height: 14px;
}

.act-btn:hover {
  border-color: var(--hair-3);
  color: var(--accent);
  background: rgba(0, 245, 212, 0.06);
}

.act-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.act-btn--playing {
  background: rgba(0, 245, 212, 0.1);
  border-color: rgba(0, 245, 212, 0.22);
  color: var(--accent);
  box-shadow: 0 0 14px rgba(0, 245, 212, 0.1);
}

.act-btn--del:hover {
  border-color: rgba(217, 91, 103, 0.35);
  color: var(--rose);
  background: rgba(217, 91, 103, 0.06);
}

.act-btn--del:focus-visible {
  box-shadow: 0 0 0 2px rgba(217, 91, 103, 0.25);
}

/* Empty state */
.empty {
  text-align: center;
  padding: var(--space-12) 0;
  color: var(--muted);
}

.empty-ring {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--hair);
  border: 1px solid var(--hair-2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-4);
  color: var(--faint);
}

.empty-ring svg {
  width: 24px;
  height: 24px;
}

.empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
  margin: 0 0 var(--space-1);
}

.empty-sub {
  font-size: 12px;
  color: var(--faint);
}
</style>
