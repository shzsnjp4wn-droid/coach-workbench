/** Client-side media shrink before Storage upload (phone clips → ~720p / ~1 Mbps). */

const VIDEO_MAX_EDGE = 720
const VIDEO_FPS = 30
const VIDEO_BITRATE = 1_000_000
const IMAGE_MAX_EDGE = 1600
const IMAGE_QUALITY = 0.72
/** Skip re-encode only for tiny already-compressed clips. */
const SKIP_VIDEO_UNDER_BYTES = 1.5 * 1024 * 1024

function pickRecorderMime() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return null
  }
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null
}

function extensionForMime(mime, fallback = 'bin') {
  if (!mime) return fallback
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return fallback
}

function renameWithExt(name, ext) {
  const base = String(name || 'clip').replace(/\.[^.]+$/, '')
  return `${base}.${ext}`
}

async function compressImage(blob) {
  if (typeof createImageBitmap !== 'function') {
    return { blob, type: blob.type, compressed: false }
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, IMAGE_MAX_EDGE / bitmap.width, IMAGE_MAX_EDGE / bitmap.height)
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob, type: blob.type, compressed: false }
    ctx.drawImage(bitmap, 0, 0, w, h)
    const out = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', IMAGE_QUALITY)
    })
    if (!out || out.size >= blob.size) {
      return { blob, type: blob.type, compressed: false }
    }
    return { blob: out, type: 'image/jpeg', compressed: true }
  } finally {
    bitmap.close?.()
  }
}

function waitForEvent(target, event, errorEvent = 'error') {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error(`media ${event} failed`))
    }
    const cleanup = () => {
      target.removeEventListener(event, onOk)
      target.removeEventListener(errorEvent, onErr)
    }
    target.addEventListener(event, onOk, { once: true })
    target.addEventListener(errorEvent, onErr, { once: true })
  })
}

async function compressVideo(blob) {
  if (typeof document === 'undefined') {
    return { blob, type: blob.type, compressed: false }
  }
  const mime = pickRecorderMime()
  if (!mime) return { blob, type: blob.type, compressed: false }

  const objectUrl = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = objectUrl

  try {
    await waitForEvent(video, 'loadedmetadata')
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return { blob, type: blob.type, compressed: false }
    }

    const srcW = video.videoWidth || 1280
    const srcH = video.videoHeight || 720
    const scale = Math.min(1, VIDEO_MAX_EDGE / srcW, VIDEO_MAX_EDGE / srcH)
    const outW = Math.max(2, Math.round((srcW * scale) / 2) * 2)
    const outH = Math.max(2, Math.round((srcH * scale) / 2) * 2)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob, type: blob.type, compressed: false }

    const canvasStream = canvas.captureStream(VIDEO_FPS)
    try {
      const raw = typeof video.captureStream === 'function'
        ? video.captureStream()
        : (typeof video.mozCaptureStream === 'function' ? video.mozCaptureStream() : null)
      raw?.getAudioTracks?.().forEach((track) => canvasStream.addTrack(track))
    } catch {
      // Audio optional — form clips are fine silent.
    }

    const recorder = new MediaRecorder(canvasStream, {
      mimeType: mime,
      videoBitsPerSecond: VIDEO_BITRATE,
    })
    const chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data)
    }

    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('MediaRecorder failed'))
    })

    recorder.start(250)
    video.currentTime = 0
    await video.play()

    let raf = 0
    const draw = () => {
      if (video.ended || video.paused) return
      ctx.drawImage(video, 0, 0, outW, outH)
      raf = requestAnimationFrame(draw)
    }
    draw()

    await waitForEvent(video, 'ended')
    cancelAnimationFrame(raf)
    // Final frame
    ctx.drawImage(video, 0, 0, outW, outH)
    if (recorder.state !== 'inactive') recorder.stop()
    await stopped
    canvasStream.getTracks().forEach((t) => t.stop())

    const outType = mime.split(';')[0]
    const out = new Blob(chunks, { type: outType })
    if (!out.size) return { blob, type: blob.type, compressed: false }
    // Keep original only if compress barely helped (or grew).
    if (out.size >= blob.size * 0.92) {
      return { blob, type: blob.type, compressed: false }
    }
    return { blob: out, type: outType, compressed: true }
  } catch (err) {
    console.warn('[media] compress video failed — uploading original', err)
    return { blob, type: blob.type, compressed: false }
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Shrink a local File/Blob for durable Storage upload.
 * Videos → ~720p @ ~1 Mbps (webm/mp4). Images → JPEG ≤1600px.
 */
export async function compressMediaForUpload(media) {
  let blob = media?.file instanceof Blob ? media.file : null
  if (!blob && media?.url) {
    try {
      blob = await fetch(media.url).then((r) => r.blob())
    } catch {
      blob = null
    }
  }
  if (!blob) {
    return {
      file: null,
      type: media?.type || '',
      name: media?.name || 'clip',
      compressed: false,
      originalSize: 0,
    }
  }

  const originalSize = blob.size
  const name = media?.name || 'clip'
  const type = media?.type || blob.type || ''
  const isImage = type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(name)
  const isVideo = type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(name)

  if (isImage) {
    const result = await compressImage(blob)
    const ext = extensionForMime(result.type, 'jpg')
    return {
      file: result.blob,
      type: result.type || type,
      name: result.compressed ? renameWithExt(name, ext) : name,
      compressed: result.compressed,
      originalSize,
    }
  }

  if (isVideo && blob.size > SKIP_VIDEO_UNDER_BYTES) {
    const result = await compressVideo(blob)
    const ext = extensionForMime(result.type, 'mp4')
    return {
      file: result.blob,
      type: result.type || type,
      name: result.compressed ? renameWithExt(name, ext) : name,
      compressed: result.compressed,
      originalSize,
    }
  }

  return {
    file: blob,
    type: type || blob.type,
    name,
    compressed: false,
    originalSize,
  }
}
