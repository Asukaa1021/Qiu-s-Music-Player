const { getPlatformCookie, getQqCredential } = require('../utils/cookieStore')

const QQ_BRIDGE = 'http://127.0.0.1:3401'

async function bridge(req, path) {
  const credential = getQqCredential(req.ip)
  if (!credential) throw new Error('请先登录 QQ 音乐')
  const response = await fetch(QQ_BRIDGE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'QQ 音乐服务暂不可用')
  return body
}

function qqUid(cookie = '') {
  return (cookie.match(/(?:^|;\s*)uin=o?(\d+)/)?.[1] || '')
}

function qqGtk(cookie = '') {
  const pSkey = cookie.match(/(?:^|;\s*)p_skey=([^;]+)/)?.[1] || ''
  let hash = 5381
  for (let index = 0; index < pSkey.length; index++) hash += (hash << 5) + pSkey.charCodeAt(index)
  return hash & 0x7fffffff
}

async function qqMusicu(req, requestKey, module, method, param) {
  const cookie = getPlatformCookie(req.ip, 'qq')
  const uin = qqUid(cookie)
  if (!uin) throw new Error('QQ 登录态无效，请重新扫码登录')
  const body = {
    comm: { uin: Number(uin), format: 'json', inCharset: 'utf-8', outCharset: 'utf-8', ct: 24, cv: 0, g_tk: qqGtk(cookie), g_tk_new_20200303: qqGtk(cookie) },
  }
  body[requestKey] = { module, method, param: { ...param, uin: Number(uin), login: 1 } }
  const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/', Cookie: cookie }, body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('QQ 音乐服务暂不可用')
  return response.json()
}

async function requestQq(req, path) {
  const cookie = getPlatformCookie(req.ip, 'qq')
  if (!cookie) throw new Error('请先登录 QQ 音乐')
  const base = `http://127.0.0.1:${process.env.PORT || 3001}/api/qq`
  const response = await fetch(base + path, { headers: { Cookie: cookie } })
  if (!response.ok) throw new Error('QQ 音乐服务暂不可用')
  return response.json()
}

function normalizeQqSongs(payload) {
  const found = []
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(walk); return }
    const id = value.mid || value.songmid || value.songMid
    const title = value.title || value.name || value.songname
    if (id && title) found.push(value)
    Object.values(value).forEach(child => { if (child && typeof child === 'object') walk(child) })
  }
  walk(payload)
  const seen = new Set()
  return found.map(song => {
    const id = String(song.mid || song.songmid || song.songMid)
    const album = song.album && typeof song.album === 'object' ? song.album : {}
    const albumMid = album.mid || song.albumMid || song.albummid || ''
    const singer = song.singer || song.singers || song.artist || []
    const artist = Array.isArray(singer) ? singer.map(item => item.name || item.title || '').filter(Boolean).join('/') : String(singer || '')
    return { id, name: song.title || song.name || song.songname, artist, album: album.name || song.albumname || '', cover: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : '', source: 'qq' }
  }).filter(song => song.name && !seen.has(song.id) && seen.add(song.id))
}

async function getQqDaily(req) {
  return bridge(req, '/daily')
}

async function getQqFm(req) {
  return bridge(req, '/fm')
}

async function getQqLiked(req) {
  return bridge(req, '/liked')
}

module.exports = { qqUid, requestQq, normalizeQqSongs, getQqDaily, getQqFm, getQqLiked }
