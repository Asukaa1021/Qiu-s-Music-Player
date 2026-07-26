/**
 * 登入相关 API
 */
import { get, post, del } from './index'

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

export function getPlatformAccounts() { return get('/platforms/accounts') }
export function getPlatformProfile() { return get('/platforms/profile') }
export function getQqQr() { return get('/platforms/qq/qr') }
export function checkQqQr(payload) { return post('/platforms/qq/qr/check', payload) }
export function setActivePlatform(platform) { return post('/platforms/active', { platform }) }
export function logoutPlatform(platform) { return del(`/platforms/${platform}`) }
