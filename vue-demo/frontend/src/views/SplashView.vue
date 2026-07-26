<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function onKeydown(e) {
  if (e.key === 'Enter') enter()
}

function enter() {
  router.push('/home')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="splash" @click="enter">
    <div class="splash__content">
      <h1 class="wordmark">
        <span class="wordmark__qiu">Qiu's</span>
        <span class="wordmark__mp">Music <span class="wordmark__o">Player</span></span>
      </h1>
      <div class="signal-line" aria-hidden="true"></div>
      <p class="cta">点击进入</p>
    </div>
  </div>
</template>

<style>
.splash { position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 200; }
.splash__content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 2rem; }
.wordmark { font-family: "Cinzel Decorative", "Noto Sans SC", serif; font-weight: 900; font-size: clamp(3rem, 8vw, 6rem); color: #E8ECEF; text-shadow: 0 0 60px rgba(0, 245, 212, 0.25), 0 0 120px rgba(0, 245, 212, 0.1); letter-spacing: 0.02em; line-height: 1.1; user-select: none; }
.wordmark__o { color: #f4d28a; text-shadow: 0 0 24px rgba(244, 210, 138, 0.45), 0 0 48px rgba(244, 210, 138, 0.2); }
.signal-line { width: clamp(200px, 42vw, 340px); height: 1px; margin: 1.6rem 0 1.2rem; background: linear-gradient(90deg, transparent, rgba(0, 245, 212, 0.25) 18%, rgba(0, 245, 212, 0.75) 50%, rgba(0, 245, 212, 0.25) 82%, transparent); position: relative; }
.signal-line::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(0, 245, 212, 0.5) 50%, transparent); filter: blur(4px); animation: signal-breathe 2.2s ease-in-out infinite; }
@keyframes signal-breathe { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
.cta { margin-top: 1.4rem; font-family: "Noto Sans SC", -apple-system, sans-serif; font-size: clamp(0.8rem, 2vw, 1rem); color: rgba(232, 236, 239, 0.5); letter-spacing: 0.15em; transition: color 0.35s ease, text-shadow 0.35s ease; display: flex; align-items: center; gap: 0.5rem; }
.cta::after { content: ''; display: inline-block; width: 5px; height: 5px; background: #00F5D4; border-radius: 50%; animation: cta-dot 1.6s ease-in-out infinite; }
@keyframes cta-dot { 0%, 100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 1; transform: scale(2); } }
.cta:hover { color: #00F5D4; text-shadow: 0 0 18px rgba(0, 245, 212, 0.45); }
</style>
