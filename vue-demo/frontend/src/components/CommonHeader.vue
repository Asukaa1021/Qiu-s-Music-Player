<script setup>
import { computed } from 'vue'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()
const profileAvatar = computed(() => store.platformProfile.avatar || (store.activePlatform === 'netease' ? store.qrAvatarUrl : ''))
const profileName = computed(() => store.platformProfile.nickname || (store.activePlatform === 'netease' ? store.qrNickname : '') || '已登录用户')
</script>

<template>
  <header class="header glass-saved-panel">
    <router-link to="/" class="brand">
      <svg class="logo" viewBox="0 0 24 24" fill="none">
        <path d="M9 18V5l12-2v13" stroke="url(#logo-grad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="6" cy="18" r="2.5" fill="rgba(0,245,212,0.25)" stroke="var(--accent)" stroke-width="1.2"/>
        <circle cx="18" cy="16" r="2.5" fill="rgba(217,91,103,0.2)" stroke="var(--rose)" stroke-width="1.2"/>
        <defs>
          <linearGradient id="logo-grad" x1="9" y1="5" x2="21" y2="18">
            <stop stop-color="var(--accent)"/>
            <stop offset="1" stop-color="var(--champagne)"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="brand-name">Melody</span>
    </router-link>

    <nav class="nav-items">
      <router-link to="/" class="nav-chip" exact-active-class="nav-chip--active">
        首页
      </router-link>

      <button
        class="nav-chip nav-chip--user"
        :class="{ 'nav-chip--logged': store.platformLoggedIn }"
        @click="store.showLoginPanel = true"
        aria-label="帐号设定"
        title="帐号设置"
      >
        <!-- 已登入：显示头像 -->
        <img
          v-if="store.platformLoggedIn && profileAvatar"
          :src="profileAvatar"
          class="user-avatar"
          alt=""
          referrerpolicy="no-referrer"
          @error="e => e.target.remove()"
        />
        <!-- 未登入：显示人形图标 -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="user-name" v-if="store.platformLoggedIn">{{ profileName }}</span>
        <span class="membership-state" :class="{ 'membership-state--active': store.platformProfile.vip }" v-if="store.platformLoggedIn">{{ store.platformProfile.vip ? '会员已启用' : '基础账户' }}</span>
      </button>
    </nav>
  </header>
</template>

<style scoped>
/* ==================== Mineradio saved-panel glass header ==================== */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  margin-bottom: 24px;
  flex-shrink: 0;
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.logo {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.brand-name {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.02em;
}

/* Nav chips */
.nav-items {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-chip {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 200ms var(--ease-out);
  outline: none;
}
.nav-chip:hover {
  color: var(--ink-2);
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}
.nav-chip--active {
  color: var(--accent);
  border-color: rgba(0, 245, 212, 0.3);
  background: rgba(0, 245, 212, 0.06);
  box-shadow: 0 0 14px rgba(0, 245, 212, 0.06);
}

/* User avatar button */
.nav-chip--user {
  padding: 6px 16px;
}
.nav-chip--user.nav-chip--logged {
  padding: 4px 14px 4px 4px;
}
.nav-chip--logged {
  color: var(--ink);
  border-color: rgba(0, 245, 212, 0.25);
  background: rgba(0, 245, 212, 0.04);
  box-shadow: 0 0 12px rgba(0, 245, 212, 0.06);
}

.nav-chip svg {
  width: 15px;
  height: 15px;
}

.nav-chip--user svg {
  width: 16px;
  height: 16px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid rgba(0, 245, 212, 0.3);
  box-shadow: 0 0 10px rgba(0, 245, 212, 0.15);
}

.user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-2);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.membership-state { position: relative; padding: 3px 7px 3px 14px; border: 1px solid rgba(126,133,142,.34); border-radius: 2px 9px 9px 2px; color: #9098a1; background: linear-gradient(90deg, rgba(126,133,142,.12), transparent); font: 650 8px var(--font-mono); letter-spacing: .04em; line-height: 1; }
.membership-state::before { content: ''; position: absolute; left: 6px; top: 50%; width: 4px; height: 4px; border-radius: 50%; transform: translateY(-50%); background: currentColor; }
.membership-state--active { color: #d7f9ef; border-color: rgba(0,245,212,.45); background: linear-gradient(90deg, rgba(0,245,212,.2), rgba(0,245,212,.03)); box-shadow: 0 0 14px rgba(0,245,212,.12); }
</style>
