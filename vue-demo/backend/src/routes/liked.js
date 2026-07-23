/**
 * 喜欢曲目 API — SQLite 缓存 + 网易云实时拉取
 */
const { Router } = require('express')
const { success, fail } = require('../utils/response')
const { getDb, saveToFile } = require('../utils/db')
const { cookieStore, getLikedSongs } = require('../services/netease')

const router = Router()

// 获取喜欢曲目（先返回缓存，后台更新）
router.get('/', async (req, res) => {
  try {
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

    // 后台从网易云刷新
    refreshLikedInBackground(req.ip, cookie)

    if (cached.length > 0) {
      const songs = cached.map(r => ({
        id: r.song_id,
        name: r.name,
        artist: r.artist,
        album: r.album,
        cover: r.cover,
      }))
      return success(res, { songs, total: cached.length, cached: true })
    }

    // 无缓存，同步拉取
    const data = await getLikedSongs(cookie)
    await saveLikedToDB(req.ip, data.songs)
    return success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 强制刷新
router.post('/refresh', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 403, '未登录')
    const data = await getLikedSongs(cookie)
    await saveLikedToDB(req.ip, data.songs)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// ==================== 内部函数 ====================

async function saveLikedToDB(ip, songs) {
  if (!songs.length) return
  const db = getDb()
  db.run('DELETE FROM liked_songs WHERE ip = ?', [ip])
  const insert = db.prepare(
    'INSERT INTO liked_songs (ip, song_id, name, artist, album, cover, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  for (let i = 0; i < songs.length; i++) {
    const s = songs[i]
    insert.run([ip, s.id, s.name, s.artist, s.album || '', s.cover || '', i])
  }
  insert.free()
  saveToFile()
  console.log(`[Liked] IP=${ip} 缓存了 ${songs.length} 首喜欢歌曲`)
}

function refreshLikedInBackground(ip, cookie) {
  getLikedSongs(cookie)
    .then(data => saveLikedToDB(ip, data.songs))
    .catch(e => console.error('[Liked] 后台刷新失败:', e.message))
}

module.exports = router
