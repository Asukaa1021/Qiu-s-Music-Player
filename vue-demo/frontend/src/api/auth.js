/**
 * 登入相关 API
 */
import { get, post } from './index'

// QR 登入三步
export function getQrKey() {
  return get('/auth/qr/key')
}

export function createQr(key) {
  return get('/auth/qr/create', { key })
}

export function checkQr(key) {
  return get('/auth/qr/check', { key })
}

// 状态
export function getLoginStatus() {
  return get('/auth/status')
}

export function logout() {
  return post('/auth/logout')
}

export function getCookieStatus() {
  return get('/auth/cookie')
}
