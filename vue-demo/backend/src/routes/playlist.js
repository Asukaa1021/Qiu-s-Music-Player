/**
 * 播放清单 API — 按 IP 隔离，SQLite 持久化
 * 删除本地歌曲时同时清理上传的文件
 */
const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const { success, fail } = require('../utils/response')
const { getDb } = require('../utils/db')

const router = Router()

// 获取播放清单
router.get('/', async (req, res) => {
  try {
    const ip = req.ip
    const db = getDb()
    const stmt = db.prepare(
      'SELECT id, track_index, title, artist, cover, src, source, song_id FROM playlist WHERE ip = ? ORDER BY track_index ASC'
    )
    stmt.bind([ip])
    const rows = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    success(res, { tracks: rows })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 同步整个播放清单（前端全量替换）
router.put('/', async (req, res) => {
  try {
    const ip = req.ip
    const { tracks } = req.body
    if (!Array.isArray(tracks)) return fail(res, 400, 'tracks 必须是数组')

    const db = getDb()

    // 先清理旧的本地上传文件
    const oldStmt = db.prepare('SELECT src FROM playlist WHERE ip = ?')
    oldStmt.bind([ip])
    const oldSrcs = []
    while (oldStmt.step()) {
      oldSrcs.push(oldStmt.getAsObject().src)
    }
    oldStmt.free()

    db.run('DELETE FROM playlist WHERE ip = ?', [ip])

    const insert = db.prepare(
      'INSERT INTO playlist (ip, track_index, title, artist, cover, src, source, song_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const newSrcs = new Set()
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      const src = t.src || ''
      newSrcs.add(src)
      insert.run([ip, i, t.title || '', t.artist || '', t.cover || '', src, t.source || 'local', t.songId || ''])
    }
    insert.free()

    // 删除不在新列表中的本地文件
    for (const src of oldSrcs) {
      if (src && src.startsWith('uploads/') && !newSrcs.has(src)) {
        const filePath = path.join(__dirname, '..', '..', src)
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
      }
    }

    success(res, { count: tracks.length })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 添加单首到播放清单
router.post('/add', async (req, res) => {
  try {
    const ip = req.ip
    const t = req.body
    if (!t) return fail(res, 400, '缺少 track 数据')

    const db = getDb()
    const maxStmt = db.prepare('SELECT MAX(track_index) as mx FROM playlist WHERE ip = ?')
    maxStmt.bind([ip])
    let nextIndex = 0
    if (maxStmt.step()) {
      const row = maxStmt.getAsObject()
      nextIndex = (row.mx != null) ? row.mx + 1 : 0
    }
    maxStmt.free()

    db.run(
      'INSERT INTO playlist (ip, track_index, title, artist, cover, src, source, song_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ip, nextIndex, t.title || '', t.artist || '', t.cover || '', t.src || '', t.source || 'local', t.songId || '']
    )

    const idStmt = db.prepare('SELECT last_insert_rowid() as id')
    let newId = 0
    if (idStmt.step()) {
      newId = idStmt.getAsObject().id
    }
    idStmt.free()

    success(res, { id: newId, track_index: nextIndex })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 删除单首（同时删除本地文件）
router.delete('/:id', async (req, res) => {
  try {
    const ip = req.ip
    const { id } = req.params

    const db = getDb()
    // 先查 src 以便清理文件
    const stmt = db.prepare('SELECT src FROM playlist WHERE ip = ? AND id = ?')
    stmt.bind([ip, parseInt(id)])
    let src = ''
    if (stmt.step()) {
      src = stmt.getAsObject().src
    }
    stmt.free()

    // 如果是本地上传文件，删除
    if (src && src.startsWith('uploads/')) {
      const filePath = path.join(__dirname, '..', '..', src)
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
    }

    db.run('DELETE FROM playlist WHERE ip = ? AND id = ?', [ip, parseInt(id)])
    success(res, null, '已删除')
  } catch (e) {
    fail(res, 500, e.message)
  }
})

module.exports = router
