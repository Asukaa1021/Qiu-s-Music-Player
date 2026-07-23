/**
 * 文件上传 API — 本地上传歌曲
 */
const { Router } = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { success, fail } = require('../utils/response')
const { getDb, saveToFile } = require('../utils/db')

const router = Router()

// uploads 目录
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// multer 配置
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename(req, file, cb) {
    // 生成唯一文件名：时间戳+随机+原始扩展名
    const ext = path.extname(file.originalname)
    const name = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext
    cb(null, name)
  },
})

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    const allowed = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) return cb(null, true)
    cb(new Error(`不支持的文件类型: ${ext}`))
  },
})

// POST /api/upload  — 上传一首歌曲
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, '未收到文件')

    const file = req.file
    const originalName = path.parse(file.originalname).name
    const title = req.body.title || originalName
    const artist = req.body.artist || '本地檔案'
    const cover = req.body.cover || ''

    // 相对路径（前端拼 http://localhost:3001/ + 相对路径即可访问）
    const src = 'uploads/' + file.filename

    // 插入数据库 playlist 表
    const db = getDb()
    const ip = req.ip

    // 获取当前最大 track_index
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
      [ip, nextIndex, title, artist, cover, src, 'local', '']
    )

    // 获取新插入的 id
    const idStmt = db.prepare('SELECT last_insert_rowid() as id')
    let newId = 0
    if (idStmt.step()) {
      newId = idStmt.getAsObject().id
    }
    idStmt.free()
    saveToFile()

    success(res, {
      id: newId,
      track_index: nextIndex,
      title,
      artist,
      cover,
      src,
      source: 'local',
      song_id: '',
    })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

module.exports = router
