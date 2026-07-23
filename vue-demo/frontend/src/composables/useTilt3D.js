/**
 * 3D 点击拖拽旋转 composable（共享单例 RAF 循环）
 * 点击板块后拖拽鼠标控制旋转角度，松开后平滑归位
 */
import { ref, onUnmounted } from 'vue'

/* ========== 共享动画循环 ========== */
const instances = new Set()
let tickRaf = null

function sharedTick() {
  const now = Date.now()
  for (const inst of instances) {
    inst.update(now)
  }
  tickRaf = requestAnimationFrame(sharedTick)
}

function register(inst) {
  instances.add(inst)
  if (instances.size === 1) tickRaf = requestAnimationFrame(sharedTick)
}
function unregister(inst) {
  instances.delete(inst)
  if (instances.size === 0 && tickRaf) {
    cancelAnimationFrame(tickRaf)
    tickRaf = null
  }
}

/* ========== 每个实例 ========== */
export function useTilt3D(options = {}) {
  const {
    maxRotateX = 12,
    maxRotateY = 15,
    smoothFactor = 0.1,
    perspective = 800,
  } = options

  const elRef = ref(null)
  const style = ref({})

  let targetX = 0, targetY = 0
  let currentX = 0, currentY = 0
  let isPressed = false

  // 缓存固定检测区域（不受 3D 旋转影响）
  const EXPAND = 12
  let cachedRect = null

  function updateCachedRect() {
    const el = elRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    cachedRect = {
      left: r.left - EXPAND,
      top: r.top - EXPAND,
      width: r.width + EXPAND * 2,
      height: r.height + EXPAND * 2,
    }
  }

  function calcRotation(clientX, clientY) {
    if (!cachedRect) return
    const cx = cachedRect.left + cachedRect.width / 2
    const cy = cachedRect.top + cachedRect.height / 2
    let mx = (clientX - cx) / (cachedRect.width / 2)
    let my = (clientY - cy) / (cachedRect.height / 2)
    mx = Math.max(-1, Math.min(1, mx))
    my = Math.max(-1, Math.min(1, my))
    targetY = mx * maxRotateY
    targetX = -my * maxRotateX
  }

  function onPointerDown(e) {
    updateCachedRect()
    isPressed = true
    calcRotation(e.clientX, e.clientY)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e) {
    if (!isPressed) return
    calcRotation(e.clientX, e.clientY)
  }

  function onPointerUp() {
    isPressed = false
    targetX = 0
    targetY = 0
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  // 鼠标离开文档时也归位
  function onDocLeave() {
    if (!isPressed) return
    isPressed = false
    targetX = 0
    targetY = 0
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  function update(now) {
    currentX += (targetX - currentX) * smoothFactor
    currentY += (targetY - currentY) * smoothFactor

    const floatZ = Math.sin(now / 1800) * 2

    style.value = {
      transform: `perspective(${perspective}px) rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg) translateZ(${floatZ.toFixed(1)}px)`,
      transition: 'box-shadow 0.4s ease, background 0.4s ease',
    }
  }

  function mount(el) {
    if (!el) return
    elRef.value = el
    updateCachedRect()
    window.addEventListener('scroll', updateCachedRect, { passive: true, capture: true })
    window.addEventListener('resize', updateCachedRect, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mouseleave', onDocLeave)
    register({ update })
  }

  function unmount() {
    const el = elRef.value
    if (el) {
      el.removeEventListener('pointerdown', onPointerDown)
    }
    window.removeEventListener('scroll', updateCachedRect, { capture: true })
    window.removeEventListener('resize', updateCachedRect)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('mouseleave', onDocLeave)
    elRef.value = null
    cachedRect = null
    for (const inst of instances) {
      if (inst.update === update) {
        unregister(inst)
        break
      }
    }
  }

  onUnmounted(unmount)

  return { style, mount, unmount }
}
