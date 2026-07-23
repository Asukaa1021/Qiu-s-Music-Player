/**
 * 统一请求封装
 * 开发时通过 Vite proxy 将 /api 转发到 http://localhost:3001
 * 生产环境需配置 nginx 反向代理或使用绝对路径
 */
const BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(json.message || '请求失败')
  }
  return json.data
}

export function get(url, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(qs ? `${url}?${qs}` : url)
}

export function post(url, data = {}) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function put(url, data = {}) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function del(url) {
  return request(url, { method: 'DELETE' })
}
