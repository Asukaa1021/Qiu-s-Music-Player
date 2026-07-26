const { Router } = require('express')
const { success, fail } = require('../utils/response')
const cookieStore = require('../utils/cookieStore')
const { getLoginStatus } = require('../services/netease')

const QQ_BRIDGE = 'http://127.0.0.1:3401'

async function bridge(path, options = {}) {
  const response = await fetch(QQ_BRIDGE + path, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'QQ 音乐登录服务不可用')
  return body
}

const router = Router()

function accountSummary(ip) {
  const session = cookieStore.getSession(ip)
  return {
    accounts: ['netease', 'qq'].map(platform => {
      const loggedIn = platform === 'qq' ? !!session.qqCredential : !!session[platform]
      return { platform, loggedIn, active: loggedIn && session.last === platform }
    }),
    lastPlatform: session.last || '',
  }
}

router.get('/accounts', (req, res) => success(res, accountSummary(req.ip)))

router.get('/profile', async (req, res) => {
  try {
    const session = cookieStore.getSession(req.ip)
    if (session.last === 'qq' && session.qqCredential) {
      return success(res, await bridge('/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: session.qqCredential }) }))
    }
    if (session.netease) {
      const data = await getLoginStatus(session.netease)
      const profile = data.data?.profile || {}
      const account = data.data?.account || {}
      return success(res, {
        platform: 'netease',
        nickname: profile.nickname || '网易云用户',
        avatar: profile.avatarUrl || '',
        vip: Boolean(account.vipType || profile.vipType),
      })
    }
    success(res, { platform: '', nickname: '', avatar: '', vip: false })
  } catch (error) { fail(res, 502, error.message || '账号资料获取失败') }
})

router.get('/qq/qr', async (req, res) => {
  try {
    success(res, await bridge('/qr', { method: 'POST' }))
  } catch (error) { fail(res, 502, error.message || 'QQ 二维码生成失败') }
})

router.post('/qq/qr/check', async (req, res) => {
  try {
    const { sessionId } = req.body || {}
    if (!sessionId) return fail(res, 400, '缺少 QQ 二维码会话')
    const body = await bridge(`/qr/${encodeURIComponent(sessionId)}`)
    if (body.status === 'done' && body.credential) cookieStore.setQqCredential(req.ip, body.credential)
    success(res, { ...body, loggedIn: body.status === 'done', accounts: accountSummary(req.ip).accounts })
  } catch (error) { fail(res, 502, error.message || 'QQ 登录检查失败') }
})

router.post('/active', (req, res) => {
  const platform = req.body?.platform
  if (!cookieStore.setLastPlatform(req.ip, platform)) return fail(res, 400, '该平台尚未登录')
  success(res, accountSummary(req.ip))
})

router.delete('/:platform', (req, res) => {
  const { platform } = req.params
  if (!['netease', 'qq'].includes(platform)) return fail(res, 400, '未知平台')
  cookieStore.clearPlatformCookie(req.ip, platform)
  success(res, accountSummary(req.ip), '已退出登录')
})

module.exports = router
