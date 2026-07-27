/**
 * 喜欢曲目 API — SQLite 缓存 + 网易云实时拉取
 */
const { Router } = require('express')
const { success, fail } = require('../utils/response')
const { getDb } = require('../utils/db')
const { cookieStore, getLikedSongs } = require('../services/netease')
const { getQqLiked } = require('../services/qq')
const { saveLikedToDB, refreshNeteaseLikedInBackground } = require('../services/likedCache')

const router = Router()

// 获取喜欢曲目（先返回缓存，后台更新）
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100)
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0)
    if (cookieStore.getLastPlatform(req.ip) === 'qq') {
      const data = await getQqLiked(req)
      const songs = data.songs || []
      return success(res, { songs: songs.slice(offset, offset + limit), total: data.total || songs.length, offset, limit })
    }
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 403, '未登录')

    const db = getDb()
    const stmt = db.prepare(
      'SELECT song_id, name, artist, album, cover, sort_order FROM liked_songs WHERE ip = ? ORDER BY sort_order ASC'
    )
    stmt.bind([req.ip])
    const cached = []
    while (stmt.step()) {
      cached.push(stmt.getAsObject())
    }
    stmt.free()

    if (cached.length > 0) {
      const songs = cached.map(r => ({
        id: r.song_id,
        name: r.name,
        artist: r.artist,
        album: r.album,
        cover: r.cover,
      }))
      return success(res, { songs: songs.slice(offset, offset + limit), total: cached.length, offset, limit, cached: true })
    }

    // 首次打开仅请求当前页的详情，避免数百首喜欢歌曲阻塞首屏。
    const data = await getLikedSongs(cookie, { offset, limit })
    // 同时在后台补齐服务器缓存；下一次进入即可直接从 SQLite 分页读取。
    refreshNeteaseLikedInBackground(req.ip, cookie)
    return success(res, { ...data, offset, limit })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 强制刷新
router.post('/refresh', async (req, res) => {
  try {
    if (cookieStore.getLastPlatform(req.ip) === 'qq') return success(res, await getQqLiked(req))
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 403, '未登录')
    const data = await getLikedSongs(cookie)
    await saveLikedToDB(req.ip, data.songs)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

module.exports = router
