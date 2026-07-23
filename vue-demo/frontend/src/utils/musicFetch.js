/**
 * 封裝 fetch，多重後備代理訪問音樂平台 API（解決 CORS）。
 */

export function createMusicFetch() {
  return async function musicFetch(url, options = {}) {
    const input = typeof url === 'string' ? url : url.url
    const headers = { ...(options.headers || {}) }
    const fetchOptions = { ...options, headers }
    const lastErr = { message: '' }

    // 方案 1：Vite 內建代理
    try {
      const proxyUrl = `/api-proxy?url=${encodeURIComponent(input)}`
      const res = await fetch(proxyUrl, fetchOptions)
      if (res.ok) return res
    } catch (e) { lastErr.message = e.message || '' }

    // 方案 2：public CORS proxy
    for (const base of [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
    ]) {
      try {
        const res = await fetch(base + encodeURIComponent(input), fetchOptions)
        if (res.ok) return res
      } catch (_) {}
    }

    // 方案 3：直接請求（同域或已處理 CORS）
    try {
      const res = await fetch(input, fetchOptions)
      if (res.ok) return res
    } catch (_) {}

    throw new Error(lastErr.message || '網路請求失敗')
  }
}
