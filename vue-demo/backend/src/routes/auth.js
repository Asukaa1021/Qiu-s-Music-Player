const { Router } = require('express')
const { success, fail } = require('../utils/response')
const {
  cookieStore,
  qrKey, qrCreate, qrCheck,
  getLoginStatus, doLogout,
} = require('../services/netease')
const { clearLikedCache, refreshNeteaseLikedInBackground } = require('../services/likedCache')

const router = Router()

// QR 登入 — 获取密钥
router.get('/qr/key', async (req, res) => {
  try {
    const data = await qrKey()
    success(res, { unikey: data.data?.unikey })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// QR 登入 — 生成二维码
router.get('/qr/create', async (req, res) => {
  try {
    const { key } = req.query
    if (!key) return fail(res, 400, '缺少 key 参数')
    const data = await qrCreate(key)
    const img = data.data?.qrimg || ''
    success(res, { qrimg: img.startsWith('data:') ? img : `data:image/png;base64,${img}` })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// QR 登入 — 轮询状态（登入成功时按 IP 存储 Cookie）
router.get('/qr/check', async (req, res) => {
  try {
    const { key } = req.query
    if (!key) return fail(res, 400, '缺少 key 参数')
    const ip = req.ip
    const data = await qrCheck(key, ip)
    const result = { code: data.code }
    if (data.nickname) result.nickname = data.nickname
    if (data.avatarUrl) result.avatarUrl = data.avatarUrl
    if (data.cookie) result.cookie = data.cookie
    if (data.code === 803 && data.cookie) {
      clearLikedCache(ip)
      refreshNeteaseLikedInBackground(ip, data.cookie)
    }
    success(res, result)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 登入状态
router.get('/status', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    const data = await getLoginStatus(cookie)
    success(res, { loggedIn: data.data?.account != null, profile: data.data?.profile || null })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 登出
router.post('/logout', async (req, res) => {
  try {
    const ip = req.ip
    const cookie = cookieStore.getCookie(ip)
    await doLogout(cookie, ip)
    success(res, null, '已登出')
  } catch (e) {
    cookieStore.clearCookie(req.ip)
    success(res, null, '已登出')
  }
})

// Cookie 状态
router.get('/cookie', (req, res) => {
  const cookie = cookieStore.getCookie(req.ip)
  success(res, { hasCookie: !!cookie })
})

module.exports = router
