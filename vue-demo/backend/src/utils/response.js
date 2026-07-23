/**
 * 统一响应格式
 */
function success(res, data = null, message = 'ok') {
  return res.json({ code: 200, data, message })
}

function fail(res, code = 500, message = '服务器内部错误') {
  return res.json({ code, data: null, message })
}

module.exports = { success, fail }
