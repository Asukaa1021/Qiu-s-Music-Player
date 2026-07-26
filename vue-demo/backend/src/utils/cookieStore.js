/**
 * IP → Cookie 持久化存储
 * 服务重启后自动恢复，每个 IP 独立保存登录态
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const COOKIE_FILE = path.join(DATA_DIR, 'cookies.json')

let cookieMap = new Map()
const PLATFORMS = ['netease', 'qq']

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
      // 兼容旧版本的 IP -> Cookie 数据，迁移为 IP -> 多平台会话。
      cookieMap = new Map(Object.entries(obj).map(([ip, value]) => [
        ip,
        typeof value === 'string' ? { netease: value, qq: '', qqCredential: null, last: 'netease' } : { netease: value.netease || '', qq: value.qq || '', qqCredential: value.qqCredential || null, last: value.last === 'kuwo' ? ((value.qqCredential || value.qq) ? 'qq' : value.netease ? 'netease' : '') : value.last || '' },
      ]))
      console.log(`[CookieStore] 已加载 ${cookieMap.size} 个 IP 的 Cookie`)
    }
  } catch (e) {
    console.error('[CookieStore] 加载失败:', e.message)
  }
}

function getCookie(ip) {
  return getPlatformCookie(ip, 'netease')
}

function setCookie(ip, c) {
  return setPlatformCookie(ip, 'netease', c)
}

function getSession(ip) {
  const value = cookieMap.get(ip)
  if (!value) return { netease: '', qq: '', qqCredential: null, last: '' }
  return typeof value === 'string' ? { netease: value, qq: '', qqCredential: null, last: 'netease' } : value
}

function getPlatformCookie(ip, platform) {
  return getSession(ip)[platform] || ''
}

function setPlatformCookie(ip, platform, c) {
  if (!PLATFORMS.includes(platform)) return
  let cookieStr = ''
  if (typeof c === 'string') {
    cookieStr = c
  } else if (Array.isArray(c)) {
    cookieStr = c.map(ck => `${ck.name}=${ck.value}`).join('; ')
  }
  if (!cookieStr) return
  const session = getSession(ip)
  session[platform] = cookieStr
  // 单平台登录：网易云登录成功后，自动清除 QQ 登录态。
  if (platform === 'netease') {
    session.qq = ''
    session.qqCredential = null
  }
  session.last = platform
  cookieMap.set(ip, session)
  save()
  console.log(`[CookieStore] IP=${ip} ${platform} Cookie 已保存`)
}

function getQqCredential(ip) {
  return getSession(ip).qqCredential || null
}

function setQqCredential(ip, credential) {
  if (!credential || typeof credential !== 'object' || !credential.musickey) return false
  const session = getSession(ip)
  // 单平台登录：QQ 登录成功后，自动清除网易云 Cookie。
  session.netease = ''
  session.qqCredential = credential
  session.qq = ''
  session.last = 'qq'
  cookieMap.set(ip, session)
  save()
  console.log(`[CookieStore] IP=${ip} QQ Music 凭据已保存`)
  return true
}

function clearCookie(ip) {
  const session = getSession(ip)
  session.netease = ''
  cookieMap.set(ip, session)
  save()
  console.log(`[CookieStore] IP=${ip} netease Cookie 已清除`)
}

function clearPlatformCookie(ip, platform) {
  const session = getSession(ip)
  session[platform] = ''
  if (platform === 'qq') session.qqCredential = null
  if (session.last === platform) session.last = PLATFORMS.find(name => session[name]) || ''
  cookieMap.set(ip, session)
  save()
}

function setLastPlatform(ip, platform) {
  const session = getSession(ip)
  if (!PLATFORMS.includes(platform) || !(session[platform] || (platform === 'qq' && session.qqCredential))) return false
  session.last = platform
  cookieMap.set(ip, session)
  save()
  return true
}

function getLastPlatform(ip) {
  return getSession(ip).last || ''
}

// 启动时加载
load()

module.exports = { getCookie, setCookie, clearCookie, getPlatformCookie, setPlatformCookie, getQqCredential, setQqCredential, clearPlatformCookie, setLastPlatform, getLastPlatform, getSession, PLATFORMS }
