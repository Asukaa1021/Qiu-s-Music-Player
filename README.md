# Qiu's Music Player

基于 Vue 3 + Express + 网易云 API 的全栈在线音乐播放器，支持扫码登录、在线搜索、私人漫游、歌词显示、频谱可视化。

## 功能

- **扫码登录** — 网易云音乐二维码登录，Cookie 后端按 IP 隔离
- **在线搜索** — 搜索网易云曲库，支持分页加载
- **播放清单** — 添加/删除/切歌，自动持久化到 SQLite
- **全功能播放器** — 播放/暂停、上下首、拖拽进度、音量调节、Web Audio 频谱
- **歌词显示** — LRC 解析，支持双语合并，逐行动态高亮
- **私人漫游** — 网易云 FM，智能预缓存，切歌零延迟
- **我喜欢 / 每日推荐** — 登录后同步网易云账户数据
- **本地上传** — 支持上传本地音频文件
- **动态背景** — 专辑封面模糊背景，3D 卡片拖拽交互

## 技术栈

| 层       | 技术                          |
| -------- | ----------------------------- |
| 前端框架 | Vue 3 (Composition API)       |
| 构建工具 | Vite 8                        |
| 状态管理 | Pinia                         |
| 路由     | Vue Router 4 (History 模式)   |
| 音频     | HTML5 Audio + Web Audio API   |
| 样式     | 原生 CSS (Glassmorphism)      |
| 后端框架 | Express.js                    |
| 数据库   | sql.js (纯 JS SQLite)         |
| 音乐源   | NeteaseCloudMusicApi          |
| 部署     | Nginx 反向代理 + 静态资源     |

## 项目结构

```
music_player/
├── nginx.conf                         # 生产 Nginx 配置
├── package.json                       # 根级脚本 (concurrently)
├── vue-demo/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.js               # Express 入口 (端口 3001)
│   │   │   ├── routes/                # auth / liked / music / playlist / upload
│   │   │   ├── services/netease.js    # 网易云 API 封装
│   │   │   └── utils/                 # Cookie 隔离 / 数据库 / 响应
│   │   └── data/                      # cookies.json / melody.db (运行时)
│   ├── frontend/
│   │   └── src/
│   │       ├── views/                 # Splash / Home / Player
│   │       ├── components/            # MusicPlayer / PersonalRadio / LoginPanel / SearchSection
│   │       ├── stores/music.js        # Pinia 核心状态 (~600 行)
│   │       ├── composables/           # useAudio / useTilt3D
│   │       ├── api/                   # auth / music
│   │       └── router/                # 路由配置
└── README.md
```

## 快速开始

### 一键启动

```bash
# 安装根依赖
npm install

# 安装前后端依赖
cd vue-demo/frontend && npm install
cd ../backend    && npm install
cd ../..

# 并行启动前后端
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`
- 前端 `/api/*` 请求自动代理到后端

### 分别启动

```bash
# 终端 1 — 后端
cd vue-demo/backend
npm install
npm start

# 终端 2 — 前端
cd vue-demo/frontend
npm install
npm run dev
```

### 生产构建

```bash
cd vue-demo/frontend
npm run build              # 输出到 dist/

# 使用 nginx.conf 部署
cp nginx.conf /etc/nginx/sites-available/music
```

## 环境变量

| 变量      | 默认值 | 说明                 |
| --------- | ------ | -------------------- |
| `PORT`    | `3001` | 后端服务端口         |
| `VITE_APP_TITLE` | Qiu's Music Player | 页面标题 |

## 路由

| 路径      | 说明                                  |
| --------- | ------------------------------------- |
| `/`       | 启动页                                |
| `/home`   | 首页（搜索/我喜欢/每日推荐/私人漫游入口） |
| `/player` | 播放器页面（播放清单/歌词/光谱）        |
