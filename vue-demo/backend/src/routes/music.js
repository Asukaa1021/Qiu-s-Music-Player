const { Router } = require('express')
const https = require('https')
const http = require('http')
const { success, fail } = require('../utils/response')
const { cookieStore, getSongUrl, searchMusic, getRecommended, getLikedSongs, getDailyRecommendations, getPersonalFm, likeTrack, getLyric, getSongComments } = require('../services/netease')

const router = Router()

// 搜索
router.get('/search', async (req, res) => {
  try {
    const { keywords, limit = '10', offset = '0' } = req.query
    if (!keywords) return fail(res, 500, '缺少 keywords 参数')
    const l = parseInt(limit)
    const o = parseInt(offset)
    const data = await searchMusic(keywords, l, o)
    const songs = (data.result?.songs || []).map(item => ({
      id: String(item.id),
      name: item.name || '',
      artist: (item.ar || []).map(a => a.name).join('/'),
      album: item.al?.name || '',
      cover: item.al?.picUrl || '',
    }))
    const total = data.result?.songCount || 0
    const hasMore = o + l < total
    success(res, { songs, total, hasMore })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 推荐新歌
router.get('/recommended', async (req, res) => {
  try {
    const data = await getRecommended()
    const songs = (data.result || []).map(item => ({
      id: String(item.id),
      name: item.name || item.song?.name || '',
      artist: (item.song?.artists || item.artists || []).map(a => a.name).join('/'),
      album: item.song?.album?.name || item.album?.name || '',
      cover: item.picUrl || item.song?.album?.picUrl || item.album?.picUrl || '',
    })).filter(s => s.name && s.id)
    success(res, { songs })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 我喜欢的歌曲（按 IP 获取对应账号的喜欢列表）
router.get('/liked', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    const data = await getLikedSongs(cookie)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 获取歌曲 URL（原始链接，不代理）
router.get('/song/url', async (req, res) => {
  try {
    const { id, level = 'lossless' } = req.query
    if (!id) return fail(res, 400, '缺少 id 参数')
    const cookie = cookieStore.getCookie(req.ip)
    const data = await getSongUrl(id, level, cookie)
    if (data.code === 200 && data.data?.length > 0) {
      success(res, { url: data.data[0].url || '', br: data.data[0].br || 0 })
    } else {
      fail(res, 404, '未找到可用音源')
    }
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 音频流代理 — 多级音质回退
router.get('/stream', async (req, res) => {
  try {
    const { id, level: reqLevel } = req.query
    if (!id) {
      res.status(400).end('缺少 id 参数')
      return
    }

    const cookie = cookieStore.getCookie(req.ip)

    const levels = reqLevel ? [reqLevel] : ['lossless', 'exhigh', 'higher', 'standard']
    let audioUrl = null
    let usedLevel = ''

    for (const lv of levels) {
      const data = await getSongUrl(id, lv, cookie)
      if (data.code === 200 && data.data?.length && data.data[0]?.url) {
        const url = data.data[0].url
        if (data.data[0].freeTrialInfo) continue
        audioUrl = url
        usedLevel = lv
        break
      }
    }

    if (!audioUrl) {
      console.log(`[Stream] song=${id} no valid URL, cookie=${cookie ? 'yes' : 'no'}`)
      res.status(404).end('未找到可用音源（可能需要登录）')
      return
    }

    console.log(`[Stream] song=${id} level=${usedLevel} url=${audioUrl.substring(0, 60)}...`)

    const urlObj = new URL(audioUrl)
    const client = urlObj.protocol === 'https:' ? https : http

    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Cookie': cookie,
    }

    const range = req.headers.range
    if (range) {
      proxyHeaders.Range = range
    }

    const proxyReq = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: proxyHeaders,
    }, (proxyRes) => {
      const { statusCode, headers: resHeaders } = proxyRes

      const passHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range']
      for (const h of passHeaders) {
        if (resHeaders[h]) res.setHeader(h, resHeaders[h])
      }
      if (!resHeaders['accept-ranges']) res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Access-Control-Allow-Origin', '*')

      if (statusCode !== 206 && statusCode !== 200) {
        res.status(statusCode).end()
        return
      }

      res.status(statusCode)
      proxyRes.pipe(res)

      proxyRes.on('error', () => {
        if (!res.headersSent) res.status(500).end()
      })
    })

    proxyReq.on('error', (e) => {
      console.error('[Stream] proxy error:', e.message)
      if (!res.headersSent) res.status(502).end()
    })

    proxyReq.setTimeout(300000, () => {
      proxyReq.destroy()
      if (!res.headersSent) res.status(504).end()
    })

    proxyReq.end()

    req.on('close', () => {
      if (!res.writableEnded) proxyReq.destroy()
    })
  } catch (e) {
    console.error('[Stream] error:', e.message)
    if (!res.headersSent) res.status(500).end()
  }
})

// 歌词
router.get('/lyric', async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return fail(res, 400, '缺少 id 参数')
    const data = await getLyric(id)
    success(res, { lrc: data.lrc?.lyric || '', tlrc: data.tlyric?.lyric || '' })
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 歌曲评论（播放器内轮播展示）
router.get('/comments', async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return fail(res, 400, '缺少 id 参数')
    const data = await getSongComments(id, cookieStore.getCookie(req.ip))
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 每日推荐（需登录）
router.get('/daily', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 401, '请先登录网易云账号')
    const data = await getDailyRecommendations(cookie)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 私人漫游（需登录，每次返回 3 首）
router.get('/personal_fm', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 401, '请先登录网易云账号')
    const data = await getPersonalFm(cookie)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

// 喜欢/取消喜欢歌曲（同步到网易云我喜欢）
router.post('/like', async (req, res) => {
  try {
    const cookie = cookieStore.getCookie(req.ip)
    if (!cookie) return fail(res, 401, '请先登录网易云账号')
    const { id, like: isLike = true } = req.body
    if (!id) return fail(res, 400, '缺少歌曲 id')
    const data = await likeTrack(cookie, String(id), isLike)
    success(res, data)
  } catch (e) {
    fail(res, 500, e.message)
  }
})

module.exports = router
