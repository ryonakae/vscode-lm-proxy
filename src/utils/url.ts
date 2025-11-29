interface DataUrl {
  mimeType: string
  data: Uint8Array
}

export function parseDataUrl(dataUrl: string): DataUrl | null {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) {
    return null
  }
  const mimeType = match[1]
  const base64Data = match[2]
  const bytes = Buffer.from(base64Data, 'base64')
  return {
    mimeType,
    data: bytes,
  }
}
