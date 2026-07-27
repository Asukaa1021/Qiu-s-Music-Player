import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as authApi from '../api/auth'
import * as musicApi from '../api/music'

let uid = 0

// ==================== localStorage ====================
const KEY = 'melody_logins'
const CI_KEY = 'melody_currentIndex'
const VOL_KEY = 'melody_volume'
const AVATAR_KEY = 'melody_avatar'
const NICK_KEY = 'melody_nick'

function loadLogins() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function saveLogins(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

function saveCurrentIndex(i) {
  localStorage.setItem(CI_KEY, String(i))
}
function loadCurrentIndex() {
  const v = localStorage.getItem(CI_KEY)
  return v ? parseInt(v) : -1
}

// ==================== Source Labels ====================
export const sourceLabels = { netease: '網易雲', qq: 'QQ 音樂', mock: 'Demo' }

// ==================== Store ====================
export const useMusicStore = defineStore('music', () => {
  // --- 播放状态 ---
  const playlist = ref([])
  const currentIndex = ref(loadCurrentIndex())
  const isPlaying = ref(false)
  const audioLoading = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(parseFloat(localStorage.getItem(VOL_KEY)) || 0.7)
  // 当前实际出声的播放器。用于页面外的常驻播放栏统一展示状态。
  const activePlayback = ref('playlist') // playlist | fm
  const fmIsPlaying = ref(false)
  const fmCurrentTime = ref(0)
  const fmDuration = ref(0)
  let playlistLoaded = false

  // 从数据库加载播放清单
  async function loadPlaylistFromDB() {
    if (playlistLoaded) return
    try {
      const data = await musicApi.fetchPlaylist()
      playlist.value = (data.tracks || []).map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        cover: t.cover || '',
        src: t.src,
        source: t.source || 'local',
        _songId: t.song_id || '',
        _dbId: t.id,
      }))
      playlistLoaded = true
    } catch {
      // 数据库不可用，静默
    }
  }

  // 启动时加载
  loadPlaylistFromDB()

  // 自动保存到数据库（防抖 1 秒）
  let saveTimer = null
  watch(playlist, () => {
    if (!playlistLoaded) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const tracks = playlist.value.map(t => ({
        title: t.title,
        artist: t.artist,
        cover: t.cover || '',
        src: t.src,
        source: t.source || 'local',
        songId: t._songId || '',
      }))
      musicApi.savePlaylist(tracks).catch(() => {})
    }, 1000)
  }, { deep: true })

  watch(currentIndex, (val) => saveCurrentIndex(val))
  watch(volume, (val) => localStorage.setItem(VOL_KEY, String(val)))

  // --- 搜索 ---
  const searchResults = ref([])
  const searching = ref(false)
  const searchError = ref('')
  const loadingTrackIds = ref(new Set())
  const searchKeyword = ref('')
  const searchOffset = ref(0)
  const searchHasMore = ref(false)
  const SEARCH_LIMIT = 20

  // --- 登录面板 ---
  const showLoginPanel = ref(false)

  // --- 推荐歌曲 ---
  const recommendedSongs = ref([])
  const loadingRecommended = ref(false)

  // --- 我喜欢 ---
  const likedSongs = ref([])
  const loadingLiked = ref(false)
  const loadingMoreLiked = ref(false)
  const likedTotal = ref(0)
  const likedError = ref('')
  const likedHasMore = ref(false)
  const likedOffset = ref(0)
  const LIKED_PAGE_SIZE = 50

  // --- 每日推荐 ---
  const dailySongs = ref([])
  const loadingDaily = ref(false)
  const dailyError = ref('')

  // --- 私人漫游 ---
  const fmSongs = ref([])
  const fmCurrentIndex = ref(0)
  const fmLoading = ref(false)
  const fmError = ref('')
  const fmPrefetchSongs = ref([])
  const fmPrefetching = ref(false)
  const fmTrack = computed(() =>
    fmSongs.value.length > 0 && fmCurrentIndex.value < fmSongs.value.length
      ? fmSongs.value[fmCurrentIndex.value]
      : null
  )

  // 预缓存：播到倒数第2首时拉下一批
  watch(fmCurrentIndex, (idx) => {
    if (
      idx >= fmSongs.value.length - 2 &&
      fmSongs.value.length > 0 &&
      !fmPrefetchSongs.value.length &&
      !fmPrefetching.value &&
      !fmLoading.value &&
      platformLoggedIn.value
    ) {
      prefetchFm()
    }
  })

  async function prefetchFm() {
    if (fmPrefetching.value || !platformLoggedIn.value) return
    fmPrefetching.value = true
    try {
      const data = await musicApi.getPersonalFm()
      const songs = (data.songs || []).map(item => {
        const source = item.source || 'netease'
        return {
        id: `${source === 'qq' ? 'qq' : 'wy'}_${item.id}`,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source,
        cover: item.cover,
        _songId: item.id,
      }})
      fmPrefetchSongs.value = songs
    } catch {
      fmPrefetchSongs.value = []
    } finally {
      fmPrefetching.value = false
    }
  }

  function startPrefetchedFm() {
    if (!fmPrefetchSongs.value.length) return false
    fmSongs.value = fmPrefetchSongs.value
    fmPrefetchSongs.value = []
    fmCurrentIndex.value = 0
    fmError.value = ''
    return true
  }

  async function fetchPersonalFm() {
    if (fmLoading.value || !platformLoggedIn.value) return
    fmLoading.value = true
    fmError.value = ''
    try {
      const data = await musicApi.getPersonalFm()
      const songs = (data.songs || []).map(item => {
        const source = item.source || 'netease'
        return {
        id: `${source === 'qq' ? 'qq' : 'wy'}_${item.id}`,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source,
        cover: item.cover,
        _songId: item.id,
      }})
      if (songs.length) {
        fmSongs.value = songs
        fmCurrentIndex.value = 0
      } else {
        fmError.value = '暂无推荐歌曲'
      }
    } catch {
      fmError.value = '加载失败，请登录后重试'
      fmSongs.value = []
    } finally {
      fmLoading.value = false
    }
  }

  async function fmNext() {
    const nextIdx = fmCurrentIndex.value + 1
    if (nextIdx < fmSongs.value.length) {
      fmCurrentIndex.value = nextIdx
    } else if (fmPrefetchSongs.value.length) {
      // 使用已预缓存的歌曲，无需加载
      fmSongs.value = fmPrefetchSongs.value
      fmPrefetchSongs.value = []
      fmCurrentIndex.value = 0
      fmLoading.value = false
    } else {
      // 播完当前批次且预缓存未就绪，拉取下一批
      await fetchPersonalFm()
    }
  }

  // --- 登录状态 ---
  const loggedIn = ref(false)
  const platformAccounts = ref([])
  const platformLoggedIn = computed(() => loggedIn.value || platformAccounts.value.some(account => account.loggedIn))
  const activePlatform = computed(() => platformAccounts.value.find(account => account.active)?.platform || (loggedIn.value ? 'netease' : ''))
  const platformProfile = ref({ platform: '', nickname: '', avatar: '', vip: false })
  const qrCodeImg = ref('')
  const qrLoginStatus = ref('idle') // idle | loading | waiting | scanned | success | expired | error
  const qrNickname = ref(localStorage.getItem(NICK_KEY) || '')
  const qrAvatarUrl = ref(localStorage.getItem(AVATAR_KEY) || '')
  let qrPollTimer = null

  async function refreshPlatformAccounts() {
    try {
      const previousPlatform = activePlatform.value
      platformAccounts.value = (await authApi.getPlatformAccounts()).accounts || []
      // QQ 登录会使后端退出网易云，同时移除浏览器中遗留的网易云 UI 状态。
      if (!platformAccounts.value.some(account => account.platform === 'netease' && account.loggedIn) && loggedIn.value) {
        loggedIn.value = false
      }
      const nextPlatform = activePlatform.value
      if (previousPlatform && previousPlatform !== nextPlatform) {
        platformProfile.value = { platform: nextPlatform, nickname: '', avatar: '', vip: false }
      }
      try { platformProfile.value = await authApi.getPlatformProfile() } catch { platformProfile.value = { platform: '', nickname: '', avatar: '', vip: false } }
      if (previousPlatform && nextPlatform && previousPlatform !== nextPlatform) {
        // 登录平台切换后，不能继续展示/播放上一个平台的推荐缓存。
        likedSongs.value = []
        likedTotal.value = 0
        likedOffset.value = 0
        likedHasMore.value = false
        dailySongs.value = []
        fmSongs.value = []
        fmPrefetchSongs.value = []
        fmCurrentIndex.value = 0
        fmLyrics.value = []
        window.dispatchEvent(new CustomEvent('melody:fm-stop'))
      }
    } catch { platformAccounts.value = [] }
  }
  refreshPlatformAccounts()

  // 恢复登录状态
  if (loadLogins().length > 0) {
    loggedIn.value = true
  }
  watch(loggedIn, (val) => {
    if (val) {
      saveLogins(['netease'])
      fetchLikedSongs()
    } else {
      saveLogins([])
      likedSongs.value = []
      likedTotal.value = 0
      likedError.value = ''
      likedOffset.value = 0
      likedHasMore.value = false
    }
  })

  // 初始化时如果已登入，拉取喜欢歌曲
  if (loadLogins().length > 0) {
    fetchLikedSongs()
  }

  // ==================== 搜索 ====================

  async function searchTracks(keyword) {
    if (!keyword?.trim()) {
      searchResults.value = []
      searchKeyword.value = ''
      searchOffset.value = 0
      searchHasMore.value = false
      return
    }
    searchKeyword.value = keyword
    searchOffset.value = 0
    searching.value = true
    searchError.value = ''
    try {
      const data = await musicApi.search(keyword, SEARCH_LIMIT, 0)
      searchResults.value = (data.songs || []).map(item => ({
        id: 'wy_' + item.id,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source: item.source || 'netease',
        cover: item.cover,
        _songId: item.id,
      }))
      searchHasMore.value = !!data.hasMore
      if (!searchResults.value.length) {
        searchError.value = '未找到相关歌曲'
      }
    } catch (e) {
      searchError.value = '搜索失败，请检查网络连接'
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }

  async function loadMoreResults() {
    if (!searchKeyword.value || searching.value || !searchHasMore.value) return
    const nextOffset = searchOffset.value + SEARCH_LIMIT
    searching.value = true
    try {
      const data = await musicApi.search(searchKeyword.value, SEARCH_LIMIT, nextOffset)
      const newSongs = (data.songs || []).map(item => ({
        id: 'wy_' + item.id,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source: item.source || 'netease',
        cover: item.cover,
        _songId: item.id,
      }))
      searchResults.value = [...searchResults.value, ...newSongs]
      searchOffset.value = nextOffset
      searchHasMore.value = !!data.hasMore
    } catch (e) {
      searchError.value = '加载更多失败，请重试'
    } finally {
      searching.value = false
    }
  }

  async function fetchRecommended() {
    if (loadingRecommended.value) return
    loadingRecommended.value = true
    try {
      const data = await musicApi.getRecommended()
      recommendedSongs.value = (data.songs || []).map(item => ({
        id: 'wy_' + item.id,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source: item.source || 'netease',
        cover: item.cover,
        _songId: item.id,
      }))
    } catch {
      recommendedSongs.value = []
    } finally {
      loadingRecommended.value = false
    }
  }

  function normalizeLikedSongs(items) {
    return (items || []).map(item => ({
      id: `${item.source === 'qq' ? 'qq' : 'wy'}_${item.id}`,
      name: item.name,
      artist: item.artist,
      album: item.album,
      source: item.source || 'netease',
      cover: item.cover,
      _songId: item.id,
    }))
  }

  async function fetchLikedSongs({ reset = true } = {}) {
    if ((!reset && loadingMoreLiked.value) || (reset && loadingLiked.value) || !platformLoggedIn.value) return
    if (reset) {
      loadingLiked.value = true
      likedError.value = ''
      likedOffset.value = 0
    } else {
      loadingMoreLiked.value = true
    }
    try {
      const offset = reset ? 0 : likedOffset.value
      const data = await musicApi.getLikedSongs(LIKED_PAGE_SIZE, offset)
      const songs = normalizeLikedSongs(data.songs)
      likedSongs.value = reset ? songs : [...likedSongs.value, ...songs]
      likedOffset.value = likedSongs.value.length
      likedTotal.value = data.total || 0
      likedHasMore.value = likedOffset.value < likedTotal.value
    } catch {
      if (reset) likedSongs.value = []
      likedError.value = '加载失败，请检查登录状态'
    } finally {
      if (reset) loadingLiked.value = false
      else loadingMoreLiked.value = false
    }
  }

  function loadMoreLikedSongs() {
    if (likedHasMore.value) return fetchLikedSongs({ reset: false })
  }

  async function fetchDailyRecommend() {
    if (loadingDaily.value || !platformLoggedIn.value) return
    loadingDaily.value = true
    dailyError.value = ''
    try {
      const data = await musicApi.getDailyRecommend()
      dailySongs.value = (data.songs || []).map(item => ({
        id: 'wy_' + item.id,
        name: item.name,
        artist: item.artist,
        album: item.album,
        source: item.source || 'netease',
        cover: item.cover,
        _songId: item.id,
      }))
    } catch {
      dailySongs.value = []
      dailyError.value = '加载失败，请登录后重试'
    } finally {
      loadingDaily.value = false
    }
  }

  // --- 歌词 ---
  const lyrics = ref([])
  const loadingLyric = ref(false)
  let currentLyricId = ''

  // 解析 LRC 格式
  function parseLrc(lrcStr) {
    const lines = []
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
    const parts = lrcStr.split('\n')
    for (const line of parts) {
      let match
      while ((match = regex.exec(line)) !== null) {
        const min = parseInt(match[1])
        const sec = parseInt(match[2])
        const ms = parseInt(match[3].padEnd(3, '0'))
        const time = min * 60 + sec + ms / 1000
        const text = line.replace(/\[.*?\]/g, '').trim()
        if (text) lines.push({ time, text })
      }
    }
    lines.sort((a, b) => a.time - b.time)
    return lines
  }

  async function fetchLyric(songId) {
    if (!songId || songId === currentLyricId) return
    currentLyricId = songId
    loadingLyric.value = true
    try {
      const data = await musicApi.getLyric(songId)
      const lrc = data.lrc || ''
      const tlrc = data.tlrc || ''
      const parsed = parseLrc(lrc)
      // 如果有翻译歌词，合并到对应行
      if (tlrc) {
        const tlrcParsed = parseLrc(tlrc)
        const tlrcMap = {}
        for (const t of tlrcParsed) tlrcMap[t.time] = t.text
        for (const line of parsed) {
          if (tlrcMap[line.time]) line.tlrc = tlrcMap[line.time]
        }
      }
      lyrics.value = parsed
    } catch {
      lyrics.value = []
    } finally {
      loadingLyric.value = false
    }
  }

  // --- 私人漫游歌词（独立于主播放器歌词） ---
  const fmLyrics = ref([])
  const fmLoadingLyric = ref(false)
  let fmCurrentLyricId = ''

  async function fetchFmLyric(songId) {
    if (!songId || songId === fmCurrentLyricId) return
    fmCurrentLyricId = songId
    fmLoadingLyric.value = true
    try {
      const data = await musicApi.getLyric(songId)
      const lrc = data.lrc || ''
      const tlrc = data.tlrc || ''
      const parsed = parseLrc(lrc)
      if (tlrc) {
        const tlrcParsed = parseLrc(tlrc)
        const tlrcMap = {}
        for (const t of tlrcParsed) tlrcMap[t.time] = t.text
        for (const line of parsed) {
          if (tlrcMap[line.time]) line.tlrc = tlrcMap[line.time]
        }
      }
      fmLyrics.value = parsed
    } catch {
      fmLyrics.value = []
    } finally {
      fmLoadingLyric.value = false
    }
  }

  async function addSearchResultToPlaylist(song) {
    const id = song.id || `netease_${song._songId}`
    loadingTrackIds.value = new Set([...loadingTrackIds.value, id])
    try {
      // 直接使用后端流代理（后端携 Cookie 取流，绕过浏览器 Cookie 限制）
      addTrack({
        src: `/api/music/stream?id=${song._songId}`,
        title: song.name || song.title || '未知歌曲',
        artist: song.artist || song.singer || '未知歌手',
        cover: song.cover || song.picUrl || '',
        source: song.source || 'netease',
        album: song.album || '',
        _songId: song._songId,
      })
    } finally {
      const next = new Set(loadingTrackIds.value)
      next.delete(id)
      loadingTrackIds.value = next
    }
  }

  // ==================== 播放列表 ====================
  const currentTrack = computed(() =>
    currentIndex.value >= 0 ? playlist.value[currentIndex.value] : null
  )
  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < playlist.value.length - 1)

  // 切歌时自动拉歌词
  watch(currentTrack, (track) => {
    lyrics.value = []
    currentLyricId = ''
    if (track?._songId) fetchLyric(track._songId)
  })

  function addTrack(track) {
    playlist.value.push({ ...track, id: ++uid })
    if (currentIndex.value === -1) currentIndex.value = 0
  }
  function addTracks(tracks) { for (const t of tracks) addTrack(t) }
  function removeTrack(index) {
    const track = playlist.value[index]
    if (track?.src?.startsWith('blob:')) URL.revokeObjectURL(track.src)
    // 删除本地上传歌曲：调用后端同时删除文件+数据库记录
    if (track?._dbId && track?.source === 'local') {
      musicApi.deletePlaylistTrack(track._dbId).catch(() => {})
    }
    playlist.value.splice(index, 1)
    if (playlist.value.length === 0) { currentIndex.value = -1 }
    else if (index < currentIndex.value) { currentIndex.value-- }
    else if (index === currentIndex.value && currentIndex.value >= playlist.value.length) {
      currentIndex.value = playlist.value.length - 1
    }
  }
  function setTrack(index) {
    if (index >= 0 && index < playlist.value.length) {
      currentIndex.value = index
    }
  }
  function next() { if (hasNext.value) currentIndex.value++ }
  function prev() { if (hasPrev.value) currentIndex.value-- }

  function playDirect(song) {
    if (!song?._songId) return
    const source = song.source || 'netease'
    const track = {
      id: ++uid,
      src: source === 'netease' ? `/api/music/stream?id=${song._songId}` : `/api/music/multi-stream?source=${source}&id=${song._songId}`,
      title: song.name || song.title || '未知歌曲',
      artist: song.artist || '未知歌手',
      cover: song.cover || '',
      source,
      album: song.album || '',
      _songId: song._songId,
    }

    // 单击歌曲时插入到当前曲目之前；尚未选中曲目时则追加到末尾。
    const insertIndex = currentIndex.value >= 0 ? currentIndex.value : playlist.value.length
    playlist.value.splice(insertIndex, 0, track)
    currentIndex.value = insertIndex
    play()
  }
  function play() {
    activePlayback.value = 'playlist'
    // 私人漫游的 Audio 会话可跨页面保留；启动主播放前显式停止它，避免双音源同时播放。
    window.dispatchEvent(new CustomEvent('melody:fm-stop'))
    isPlaying.value = true
  }
  function pause() { isPlaying.value = false }
  function setActivePlayback(source) { activePlayback.value = source }
  function seek(time) { currentTime.value = time }

  // ==================== QR 登入 ====================

  async function startLogin() {
    // 先清除旧的轮询定时器，防止重复轮询
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null }
    qrLoginStatus.value = 'loading'
    qrCodeImg.value = ''
    qrNickname.value = ''
    qrAvatarUrl.value = ''
    localStorage.removeItem(NICK_KEY)
    localStorage.removeItem(AVATAR_KEY)

    try {
      const { unikey } = await authApi.getQrKey()
      const { qrimg } = await authApi.createQr(unikey)
      qrCodeImg.value = qrimg
      qrLoginStatus.value = 'waiting'

      qrPollTimer = setInterval(async () => {
        try {
          const data = await authApi.checkQr(unikey)
          const { code } = data
          switch (code) {
            case 802:
              qrLoginStatus.value = 'scanned'
              qrNickname.value = data.nickname || ''
              qrAvatarUrl.value = data.avatarUrl || ''
              localStorage.setItem(NICK_KEY, qrNickname.value)
              localStorage.setItem(AVATAR_KEY, qrAvatarUrl.value)
              break
            case 803:
              clearInterval(qrPollTimer)
              qrPollTimer = null
              // 重新登录时同步一次网易云到数据库，后续读库
              await musicApi.refreshLikedSongs()
              loggedIn.value = true
              await refreshPlatformAccounts()
              qrLoginStatus.value = 'success'
              break
            case 800:
              clearInterval(qrPollTimer)
              qrPollTimer = null
              qrLoginStatus.value = 'expired'
              break
            default:
              if (code !== 801) {
                clearInterval(qrPollTimer)
                qrPollTimer = null
                qrLoginStatus.value = 'error'
              }
          }
        } catch {
          // 网络波动，继续轮询
        }
      }, 3000)
    } catch (e) {
      qrLoginStatus.value = 'error'
    }
  }

  function cancelLogin() {
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null }
    qrLoginStatus.value = 'idle'
    qrCodeImg.value = ''
    qrNickname.value = ''
    qrAvatarUrl.value = ''
    localStorage.removeItem(NICK_KEY)
    localStorage.removeItem(AVATAR_KEY)
  }

  async function doLogout() {
    await authApi.logout()
    loggedIn.value = false
    cancelLogin()
    localStorage.removeItem(AVATAR_KEY)
    localStorage.removeItem(NICK_KEY)
  }

  return {
    playlist, currentIndex, isPlaying, currentTime, duration, volume,
    activePlayback, fmIsPlaying, fmCurrentTime, fmDuration, setActivePlayback, audioLoading,
    currentTrack, hasPrev, hasNext,
    searchResults, searching, searchError, loadingTrackIds,
    searchKeyword, searchOffset, searchHasMore, SEARCH_LIMIT,
    searchTracks, loadMoreResults, fetchRecommended, addSearchResultToPlaylist,
    recommendedSongs, loadingRecommended,
    likedSongs, loadingLiked, loadingMoreLiked, likedTotal, likedError, likedHasMore, fetchLikedSongs, loadMoreLikedSongs,
    dailySongs, loadingDaily, dailyError, fetchDailyRecommend,
    fmSongs, fmCurrentIndex, fmTrack, fmLoading, fmPrefetching, fmPrefetchSongs, fmError, fetchPersonalFm, prefetchFm, startPrefetchedFm, fmNext,
    lyrics, loadingLyric,
    fmLyrics, fmLoadingLyric, fetchFmLyric,
    showLoginPanel,
    loggedIn, platformAccounts, platformLoggedIn, activePlatform, platformProfile, refreshPlatformAccounts,
    qrCodeImg, qrLoginStatus, qrNickname, qrAvatarUrl,
    startLogin, cancelLogin, doLogout,
    addTrack, addTracks, removeTrack, setTrack, playDirect,
    next, prev, play, pause, seek,
    sourceLabels,
  }
})
