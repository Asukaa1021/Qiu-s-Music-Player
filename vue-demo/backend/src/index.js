require('dotenv').config()

const express = require('express')
const path = require('path')
const { spawn } = require('child_process')
const authRoutes = require('./routes/auth')
const musicRoutes = require('./routes/music')
const playlistRoutes = require('./routes/playlist')
const likedRoutes = require('./routes/liked')
const uploadRoutes = require('./routes/upload')
const platformRoutes = require('./routes/platforms')
const { init } = require('./utils/db')

const app = express()
const PORT = process.env.PORT || 3001

function startQqBridge() {
  const script = path.join(__dirname, 'services', 'qq_bridge.py')
  const bundledPython = process.platform === 'win32'
    ? path.join(__dirname, '..', 'vendor', 'qqmusic-venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '..', 'vendor', 'qqmusic-venv', 'bin', 'python')
  const python = require('fs').existsSync(bundledPython) ? bundledPython : (process.platform === 'win32' ? null : 'python3')
  if (!python) return console.warn('[QQ Bridge] 未找到本地 QQ Music 运行环境，QQ 登录不可用。')
  const child = spawn(python, [script], { windowsHide: true, stdio: 'ignore' })
  child.on('error', error => console.warn('[QQ Bridge] 启动失败:', error.message))
  process.on('exit', () => child.kill())
}
startQqBridge()

// 静态文件服务 — 让前端能访问上传的音频文件
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use(express.json({ limit: '10mb' }))

// 路由
app.use('/api/auth', authRoutes)
app.use('/api/music', musicRoutes)
app.use('/api/playlist', playlistRoutes)
app.use('/api/liked', likedRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/platforms', platformRoutes)


// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'Melody API Server' })
})

// 初始化数据库并启动
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Melody Server] http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[DB] 数据库初始化失败，使用内存模式:', err.message)
    app.listen(PORT, () => {
      console.log(`[Melody Server] http://localhost:${PORT} (memory mode)`)
    })
  })
