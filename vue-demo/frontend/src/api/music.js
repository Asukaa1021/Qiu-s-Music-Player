/**
 * 音乐相关 API
 */
import { get, post, put, del } from './index'

export function search(keywords, limit = 20, offset = 0) {
  return get('/music/search', { keywords, limit: String(limit), offset: String(offset) })
}

export function getRecommended() {
  return get('/music/recommended')
}

export function getDailyRecommend() {
  return get('/music/daily')
}

export function getLikedSongs(limit = 50, offset = 0) {
  return get('/liked', { limit: String(limit), offset: String(offset) })
}

export function refreshLikedSongs() {
  return post('/liked/refresh')
}

export function getSongUrl(id, level = 'lossless') {
  return get('/music/song/url', { id, level })
}

// ==================== 播放清单（数据库持久化） ====================

export function fetchPlaylist() {
  return get('/playlist')
}

export function savePlaylist(tracks) {
  return put('/playlist', { tracks })
}

export function addPlaylistTrack(track) {
  return post('/playlist/add', track)
}

export function deletePlaylistTrack(id) {
  return del('/playlist/' + id)
}

// ==================== 歌词 ====================

export function getLyric(songId) {
  return get('/music/lyric', { id: songId })
}

export function getSongComments(songId) {
  return get('/music/comments', { id: songId })
}

// 私人漫游
export function getPersonalFm() {
  return get('/music/personal_fm')
}

// 喜欢/取消喜欢歌曲
export function likeTrack(id, isLike = true) {
  return post('/music/like', { id, like: isLike })
}

export function uploadSong(formData) {
  return fetch('/api/upload', { method: 'POST', body: formData }).then(r => r.json()).then(d => {
    if (d.code !== 200) throw new Error(d.message || '上传失败')
    return d.data
  })
}
