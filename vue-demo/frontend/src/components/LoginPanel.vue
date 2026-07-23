<script setup>
import { watch } from 'vue'
import { useMusicStore } from '../stores/music'

const store = useMusicStore()

watch(() => store.showLoginPanel, (val) => { if (!val) store.cancelLogin() })
</script>

<template>
  <Teleport to="body">
    <transition name="overlay">
      <div v-if="store.showLoginPanel" class="overlay" @click.self="store.showLoginPanel = false">
        <div class="panel glass-lg">
          <!-- Header -->
          <div class="panel-header">
            <h2 class="panel-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              帐号登入
            </h2>
            <button class="close-btn" @click="store.showLoginPanel = false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>

          <!-- Logged In -->
          <div v-if="store.loggedIn" class="logged-in">
            <div class="check-ring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p class="logged-label">已登入網易雲音樂</p>
            <p class="logged-hint">可搜索及播放 VIP 歌曲</p>
            <button class="btn-outline btn-outline--danger" @click="store.doLogout()">登出</button>
          </div>

          <!-- Not Logged In -->
          <template v-else>
            <!-- idle -->
            <template v-if="store.qrLoginStatus === 'idle'">
              <p class="desc">使用网易云音乐 App 扫描二维码登录。登入后可搜索及播放 VIP 歌曲。</p>
              <button class="btn-primary" @click="store.startLogin()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="17" y1="14" x2="21" y2="14"/><line x1="19" y1="12" x2="19" y2="16"/></svg>
                掃碼登入
              </button>
            </template>

            <!-- loading -->
            <template v-else-if="store.qrLoginStatus === 'loading'">
              <div class="center"><span class="spinner"></span><span class="stat-text">正在生成 QR 码...</span></div>
            </template>

            <!-- QR -->
            <template v-else-if="store.qrLoginStatus === 'waiting' || store.qrLoginStatus === 'scanned'">
              <div class="qr-section">
                <div v-if="store.qrAvatarUrl" class="user-badge">
                  <img :src="store.qrAvatarUrl" alt="" class="avatar" /><span class="nickname">{{ store.qrNickname || '用户' }}</span>
                </div>
                <div class="qr-wrap">
                  <img :src="store.qrCodeImg" alt="QR" class="qr-img" />
                  <div v-if="store.qrLoginStatus === 'scanned'" class="qr-mask"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>
                <p class="stat-text">{{ store.qrLoginStatus === 'waiting' ? '请使用 App 扫描 QR 码' : '已在 App 中确认登录' }}</p>
                <button class="btn-text" @click="store.cancelLogin()">取消</button>
              </div>
            </template>

            <!-- success -->
            <template v-else-if="store.qrLoginStatus === 'success'">
              <div class="center">
                <svg class="done-icon" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="stat-text">登录成功！</span>
              </div>
            </template>

            <!-- expired / error -->
            <template v-else>
              <div class="center">
                <svg class="warn-icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span class="stat-text stat-text--warn">{{ store.qrLoginStatus === 'expired' ? 'QR 码已过期' : '连接异常' }}</span>
                <button class="btn-primary btn-primary--sm" @click="store.startLogin()">重新生成</button>
              </div>
            </template>
          </template>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);
}
.panel {
  width: 360px; max-width: 92vw;
  padding: var(--space-6);
}

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-5);
}
.panel-title {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: 14px; font-weight: 600; color: var(--ink); margin: 0;
}
.panel-title svg { width: 16px; height: 16px; color: var(--accent); }

.close-btn {
  width: 28px; height: 28px; border-radius: var(--radius-full);
  border: 1px solid var(--hair-2); background: var(--hair);
  color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-base);
}
.close-btn svg { width: 14px; height: 14px; }
.close-btn:hover { border-color: var(--hair-3); color: var(--ink-2); background: var(--hair-2); }

.desc { font-size: 12px; color: var(--muted); line-height: 1.6; margin-bottom: var(--space-4); }

/* Buttons */
.btn-primary {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: var(--space-2);
  padding: 10px; border-radius: var(--radius-full);
  border: 1px solid rgba(0,245,212,0.2); background: rgba(0,245,212,0.06);
  color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-base);
}
.btn-primary svg { width: 15px; height: 15px; }
.btn-primary:hover { background: rgba(0,245,212,0.12); border-color: rgba(0,245,212,0.35); }
.btn-primary--sm { width: auto; padding: 7px 20px; }
.btn-outline {
  width: 100%; padding: 8px; border-radius: var(--radius-full);
  border: 1px solid var(--hair-2); background: transparent;
  color: var(--muted); font-size: 12px; cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-base);
}
.btn-outline--danger:hover { border-color: var(--rose); color: var(--rose); background: rgba(217,91,103,0.06); }
.btn-text {
  width: 100%; padding: 6px; border: none; background: transparent;
  color: var(--muted); font-size: 11px; cursor: pointer; font-family: inherit;
  transition: color var(--transition-base);
}
.btn-text:hover { color: var(--ink-2); }

/* Logged in */
.logged-in {
  display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
  padding: var(--space-5) 0;
}
.check-ring {
  width: 44px; height: 44px; border-radius: var(--radius-full);
  background: rgba(0,245,212,0.08); border: 1px solid rgba(0,245,212,0.2);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent);
}
.check-ring svg { width: 22px; height: 22px; }
.logged-label { font-size: 14px; font-weight: 600; color: var(--ink); }
.logged-hint { font-size: 11px; color: var(--muted); }

/* QR */
.qr-section {
  display: flex; flex-direction: column; align-items: center;
}
.qr-wrap {
  width: 180px; height: 180px; margin: var(--space-4) auto;
  border-radius: var(--radius-md); overflow: hidden;
  background: #fff; padding: 8px; position: relative;
}
.qr-img { width: 100%; height: 100%; object-fit: contain; display: block; image-rendering: pixelated; }
.qr-mask {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.8);
}
.qr-mask svg { width: 48px; height: 48px; }

.user-badge { display: flex; align-items: center; gap: var(--space-2); justify-content: center; margin-top: var(--space-3); }
.avatar { width: 26px; height: 26px; border-radius: var(--radius-full); border: 2px solid rgba(0,245,212,0.3); }
.nickname { font-size: 12px; font-weight: 500; color: var(--ink); }

/* Center states */
.center {
  display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
  padding: var(--space-6) 0;
}
.spinner { width: 18px; height: 18px; border: 2px solid var(--hair-2); border-top-color: var(--accent); border-radius: var(--radius-full); animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.stat-text { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.5; }
.stat-text--warn { color: #fbbf24; }
.done-icon, .warn-icon { width: 36px; height: 36px; }

/* Transitions */
.overlay-enter-active { transition: opacity 0.25s var(--ease-out); }
.overlay-leave-active { transition: opacity 0.15s var(--ease-out); }
.overlay-enter-from { opacity: 0; }
.overlay-enter-from .panel { transform: scale(0.95) translateY(8px); opacity: 0; }
.overlay-leave-to { opacity: 0; }
.overlay-leave-to .panel { transform: scale(0.95) translateY(8px); opacity: 0; }
</style>
