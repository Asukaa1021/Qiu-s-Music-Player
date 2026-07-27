const { getDb, saveToFile } = require('../utils/db')
const { getLikedSongs } = require('./netease')
const { getQqLiked } = require('./qq')

function clearLikedCache(ip) {
  const db = getDb()
  db.run('DELETE FROM liked_songs WHERE ip = ?', [ip])
  saveToFile()
}

async function saveLikedToDB(ip, songs = []) {
  clearLikedCache(ip)
  if (!songs.length) return
  const db = getDb()
  const insert = db.prepare(
    'INSERT INTO liked_songs (ip, song_id, name, artist, album, cover, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]
    insert.run([ip, song.id, song.name, song.artist, song.album || '', song.cover || '', i])
  }
  insert.free()
  saveToFile()
  console.log(`[Liked] IP=${ip} 缓存了 ${songs.length} 首喜欢歌曲`)
}

function refreshNeteaseLikedInBackground(ip, cookie) {
  getLikedSongs(cookie)
    .then(data => saveLikedToDB(ip, data.songs))
    .catch(error => console.error('[Liked] 网易云缓存刷新失败:', error.message))
}

function refreshQqLikedInBackground(req) {
  getQqLiked(req)
    .then(data => saveLikedToDB(req.ip, data.songs))
    .catch(error => console.error('[Liked] QQ 缓存刷新失败:', error.message))
}

module.exports = { clearLikedCache, saveLikedToDB, refreshNeteaseLikedInBackground, refreshQqLikedInBackground }
