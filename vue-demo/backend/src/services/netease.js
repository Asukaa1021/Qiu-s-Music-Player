/**
 * 网易云 API 服务层
 * 封装 NeteaseCloudMusicApi，Cookie 由调用方传入（按 IP 隔离）
 */
const {
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
  logout,
  song_url_v1,
  cloudsearch,
  lyric,
  personalized_newsong,
  likelist,
  song_detail,
  recommend_songs,
  personal_fm,
  like,
} = require('NeteaseCloudMusicApi')

const cookieStore = require('../utils/cookieStore')

// ==================== 登入 ====================

async function qrKey() {
  const result = await login_qr_key({})
  return result.body
}

async function qrCreate(key) {
  const result = await login_qr_create({ key, qrimg: true })
  return result.body
}

async function qrCheck(key, ip) {
  const result = await login_qr_check({ key })
  const body = result.body
  if (body.code === 803 && body.cookie) {
    cookieStore.setCookie(ip, body.cookie)
    console.log(`[Netease] IP=${ip} 登入成功`)
  }
  return body
}

async function getLoginStatus(cookie) {
  const result = await login_status({ cookie })
  return result.body
}

async function doLogout(cookie, ip) {
  await logout({ cookie })
  cookieStore.clearCookie(ip)
  return { code: 200, message: '已登出' }
}

// ==================== 音乐 ====================

async function getSongUrl(id, level = 'lossless', cookie = '') {
  const result = await song_url_v1({ id, level, cookie })
  return result.body
}

async function searchMusic(keywords, limit = 10, offset = 0) {
  const result = await cloudsearch({ keywords, limit, type: 1, offset })
  return result.body
}

// ==================== 歌词 ====================

async function getLyric(id) {
  const result = await lyric({ id })
  return result.body
}

async function getRecommended() {
  const result = await personalized_newsong({ limit: 12 })
  return result.body
}

async function getLikedSongs(cookie) {
  // 1. 获取登录状态及 uid
  const status = await login_status({ cookie })
  const data = status.body?.data

  if (!data || data.code !== 200) {
    console.log('[getLikedSongs] 未登录或登录已过期, body:', JSON.stringify(status.body).substring(0, 200))
    throw new Error('未登录，请先扫码登入')
  }

  const uid = data.account?.id || data.profile?.userId
  if (!uid) {
    console.log('[getLikedSongs] 无法获取 UID, data:', JSON.stringify(data).substring(0, 200))
    throw new Error('无法获取用户 UID')
  }
  console.log('[getLikedSongs] uid:', uid)

  // 2. 获取全部喜欢的歌曲 ID 列表
  const likeResult = await likelist({ uid, cookie })
  console.log('[getLikedSongs] likelist code:', likeResult.body?.code, 'ids count:', likeResult.body?.ids?.length || 0)
  const ids = likeResult.body?.ids || []
  if (!ids.length) return { songs: [], total: 0 }

  // likelist 返回从旧到新排序，反转使最新喜欢在前
  ids.reverse()

  // 3. 分批获取歌曲详情（每批 500 个，并行请求）
  const BATCH = 500
  const batches = []
  for (let i = 0; i < ids.length; i += BATCH) {
    batches.push(ids.slice(i, i + BATCH))
  }

  const detailResults = await Promise.all(
    batches.map(batch => song_detail({ ids: batch.join(','), cookie }))
  )

  // 4. 合并所有结果，保持顺序
  const songMap = {}
  for (const r of detailResults) {
    const songs = r.body?.songs || []
    for (const s of songs) {
      songMap[s.id] = {
        id: String(s.id),
        name: s.name || '',
        artist: (s.ar || []).map(a => a.name).join('/'),
        album: s.al?.name || '',
        cover: s.al?.picUrl || '',
      }
    }
  }

  // 按 likelist 顺序输出（最新喜欢在前）
  const songs = ids.map(id => songMap[id]).filter(Boolean)
  console.log('[getLikedSongs] 最终歌曲数:', songs.length)

  return { songs, total: ids.length }
}

async function getDailyRecommendations(cookie) {
  const result = await recommend_songs({ cookie })
  const body = result.body
  const songs = (body.data?.dailySongs || []).map(item => ({
    id: String(item.id),
    name: item.name || '',
    artist: (item.ar || []).map(a => a.name).join('/'),
    album: item.al?.name || '',
    cover: item.al?.picUrl || '',
  }))
  return { songs, total: songs.length }
}

// 私人漫游（需登录，每次返回 3 首）
async function getPersonalFm(cookie) {
  const result = await personal_fm({ cookie })
  const body = result.body
  // personal_fm 使用 artists / album 全拼字段，不同于其他 API 的 ar / al 缩写
  const songs = (body.data || []).map(item => ({
    id: String(item.id),
    name: item.name || '',
    artist: (item.artists || []).map(a => a.name).join('/'),
    album: item.album?.name || '',
    cover: item.album?.picUrl || '',
  }))
  return { songs }
}

// 喜欢/取消喜欢歌曲
async function likeTrack(cookie, trackId, isLike = true) {
  const result = await like({ id: trackId, like: isLike, cookie })
  return result.body
}

module.exports = {
  cookieStore,
  qrKey, qrCreate, qrCheck,
  getLoginStatus, doLogout,
  getSongUrl, searchMusic, getRecommended, getLikedSongs, getDailyRecommendations, getPersonalFm, likeTrack,
  getLyric,
}
