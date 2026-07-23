/**
 * IP → Cookie 持久化存储
 * 服务重启后自动恢复，每个 IP 独立保存登录态
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const COOKIE_FILE = path.join(DATA_DIR, 'cookies.json')

let cookieMap = new Map()

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function save() {
  ensureDataDir()
  const obj = Object.fromEntries(cookieMap)
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(obj, null, 2))
}

function load() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const raw = fs.readFileSync(COOKIE_FILE, 'utf-8')
      const obj = JSON.parse(raw)
      cookieMap = new Map(Object.entries(obj))
      console.log(`[CookieStore] 已加载 ${cookieMap.size} 个 IP 的 Cookie`)
    }
  } catch (e) {
    console.error('[CookieStore] 加载失败:', e.message)
  }
}

function getCookie(ip) {
  return cookieMap.get(ip) || ''
}

function setCookie(ip, c) {
  let cookieStr = ''
  if (typeof c === 'string') {
    cookieStr = c
  } else if (Array.isArray(c)) {
    cookieStr = c.map(ck => `${ck.name}=${ck.value}`).join('; ')
  }
  if (!cookieStr) return
  cookieMap.set(ip, cookieStr)
  save()
  console.log(`[CookieStore] IP=${ip} Cookie 已保存`)
}

function clearCookie(ip) {
  cookieMap.delete(ip)
  save()
  console.log(`[CookieStore] IP=${ip} Cookie 已清除`)
}

// 启动时加载
load()

module.exports = { getCookie, setCookie, clearCookie }
