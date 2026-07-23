/**
 * SQLite 数据库（sql.js — 纯 JS，无需原生编译）
 * 数据文件：server/data/melody.db
 */
const path = require('path')
const fs = require('fs')
const initSqlJs = require('sql.js')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'melody.db')

let db = null
let saveTimer = null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/** 保存到文件（防抖） */
function saveToFile() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!db) return
    try {
      ensureDataDir()
      const data = db.export()
      fs.writeFileSync(DB_FILE, Buffer.from(data))
    } catch (e) {
      console.error('[DB] 保存失败:', e.message)
    }
  }, 500)
}

/** 每次写操作后自动保存 */
function autoSave(dbInstance) {
  const origRun = dbInstance.run.bind(dbInstance)
  dbInstance.run = function (sql, params) {
    const result = origRun(sql, params)
    if (/^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql.trim())) {
      saveToFile()
    }
    return result
  }
  return dbInstance
}

async function init() {
  ensureDataDir()

  const SQL = await initSqlJs()

  if (fs.existsSync(DB_FILE)) {
    const buffer = fs.readFileSync(DB_FILE)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db = autoSave(db)

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      track_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      artist TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      src TEXT NOT NULL,
      source TEXT DEFAULT 'local',
      song_id TEXT DEFAULT ''
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_playlist_ip ON playlist(ip)')

  db.run(`
    CREATE TABLE IF NOT EXISTS liked_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      song_id TEXT NOT NULL,
      name TEXT NOT NULL,
      artist TEXT DEFAULT '',
      album TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ip, song_id)
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_liked_ip_order ON liked_songs(ip, sort_order)')

  console.log('[DB] SQLite 初始化完成')
  return db
}

function getDb() {
  if (!db) throw new Error('数据库未初始化，请先调用 init()')
  return db
}

module.exports = { init, getDb, saveToFile }
