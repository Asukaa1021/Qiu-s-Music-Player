/**
 * 从音频文件中提取嵌入式专辑封面（ID3v2 / FLAC）
 * @param {File} file
 * @returns {Promise<string|null>} blob URL 或 null
 */
export function extractCover(file) {
  return new Promise((resolve) => {
    const chunk = file.slice(0, 512 * 1024) // 读前 512KB
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const buf = new Uint8Array(reader.result)
        const url = parseId3v2(buf) || parseFlac(buf)
        resolve(url)
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(chunk)
  })
}

/** 解析 ID3v2 APIC 帧 */
function parseId3v2(buf) {
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null // "ID3"

  const ver = buf[3]
  const size = readSynchSafe(buf, 6)

  let offset = 10
  // 跳过扩展头 (v2.4)
  if (ver === 4 && (buf[5] & 0x40)) {
    const extSize = readSynchSafe(buf, offset)
    offset += 4 + extSize
  }

  const end = Math.min(10 + size, buf.length)

  while (offset < end - 10) {
    const id = String.fromCharCode(...buf.slice(offset, offset + 4))
    offset += 4

    let frameSize
    if (ver === 4) {
      frameSize = readSynchSafe(buf, offset)
    } else {
      frameSize = (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
    }
    offset += 4
    offset += 2 // flags

    if (frameSize <= 0 || offset + frameSize > buf.length) break

    if (id === 'APIC') {
      // 跳过 text encoding + MIME type
      let pos = offset + 1
      while (pos < offset + frameSize && buf[pos] !== 0) pos++
      const mime = String.fromCharCode(...buf.slice(offset + 1, pos)).toLowerCase()
      pos++ // null byte

      // 跳过 picture type (1 byte)
      pos++

      // 跳过 description
      while (pos < offset + frameSize && buf[pos] !== 0) pos++
      pos++ // null byte

      const imgData = buf.slice(pos, offset + frameSize)
      const format = mime.includes('png') ? 'png' : mime.includes('bmp') ? 'bmp' : mime.includes('gif') ? 'gif' : 'jpeg'
      const blob = new Blob([imgData], { type: `image/${format}` })
      return URL.createObjectURL(blob)
    }

    offset += frameSize
  }

  return null
}

/** 读取 synchsafe 整数 */
function readSynchSafe(buf, offset) {
  return ((buf[offset] & 0x7f) << 21) |
         ((buf[offset + 1] & 0x7f) << 14) |
         ((buf[offset + 2] & 0x7f) << 7) |
         (buf[offset + 3] & 0x7f)
}

/** FLAC PICTURE block */
function parseFlac(buf) {
  if (buf[0] !== 0x66 || buf[1] !== 0x4c || buf[2] !== 0x61 || buf[3] !== 0x43) return null // "fLaC"

  let offset = 4
  while (offset < buf.length - 4) {
    const isLast = buf[offset] & 0x80
    const blockType = buf[offset] & 0x7f
    const blockSize = (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
    offset += 4

    if (blockSize <= 0 || offset + blockSize > buf.length) break

    if (blockType === 6) {
      // PICTURE block
      const typeOffset = offset + 4
      const mimeLen = (() => {
        for (let i = typeOffset; i < offset + blockSize; i++) {
          if (buf[i] === 0) return i - typeOffset
        }
        return 0
      })()
      const mime = String.fromCharCode(...buf.slice(typeOffset, typeOffset + mimeLen)).toLowerCase()
      const descEnd = typeOffset + mimeLen + 1
      const descLen = (() => {
        for (let i = descEnd + 4; i < offset + blockSize; i++) {
          if (buf[i] === 0) return i - descEnd - 4
        }
        return 0
      })()
      const imgStart = descEnd + 4 + descLen + 1 + 4 + 4 + 4 + 4
      const imgData = buf.slice(imgStart, offset + blockSize)
      const format = mime.includes('png') ? 'png' : mime.includes('bmp') ? 'bmp' : mime.includes('gif') ? 'gif' : 'jpeg'
      if (imgData.length > 0) {
        const blob = new Blob([imgData], { type: `image/${format}` })
        return URL.createObjectURL(blob)
      }
    }

    offset += blockSize
    if (isLast) break
  }

  return null
}
