// A tiny streaming ZIP writer ("store" only, no compression: photos and videos are already compressed).
// It never holds a whole file in memory, so a multi-gigabyte download is fine, and it uses the ZIP64
// layout everywhere, so archives and files bigger than 4 GB work too.

const te = new TextEncoder()

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crcUpdate(crc: number, chunk: Uint8Array): number {
  let c = crc ^ 0xffffffff
  for (let i = 0; i < chunk.length; i++) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time: time & 0xffff, date: date & 0xffff }
}

// DataView helpers. Numbers up to 2^53 are written as 8 bytes (little endian).
function put64(v: DataView, pos: number, n: number) {
  v.setUint32(pos, n % 0x100000000, true)
  v.setUint32(pos + 4, Math.floor(n / 0x100000000), true)
}

type Entry = { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number }

export type ZipSink = (chunk: Uint8Array) => Promise<void> | void

export class ZipWriter {
  private offset = 0
  private entries: Entry[] = []
  private names = new Set<string>()
  constructor(private sink: ZipSink) {}

  private async write(chunk: Uint8Array) {
    await this.sink(chunk)
    this.offset += chunk.length
  }

  /** Two files can not share a name inside a zip, so repeats become "name (2).ext". */
  uniqueName(name: string): string {
    let n = name
    let i = 2
    while (this.names.has(n.toLowerCase())) {
      const dot = name.lastIndexOf('.')
      n = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`
      i++
    }
    this.names.add(n.toLowerCase())
    return n
  }

  async addFile(name: string, stream: ReadableStream<Uint8Array>, onBytes?: (n: number) => void, mtime = new Date()) {
    const nameBytes = te.encode(this.uniqueName(name))
    const { time, date } = dosDateTime(mtime)
    const localOffset = this.offset

    // Local header. Sizes and checksum are unknown yet, so they follow the data in a "data descriptor".
    const head = new Uint8Array(30 + nameBytes.length + 20)
    const h = new DataView(head.buffer)
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 45, true) // version needed (ZIP64)
    h.setUint16(6, 0x0808, true) // bit 3: data descriptor follows, bit 11: UTF-8 names
    h.setUint16(8, 0, true) // stored
    h.setUint16(10, time, true)
    h.setUint16(12, date, true)
    h.setUint32(14, 0, true)
    h.setUint32(18, 0xffffffff, true)
    h.setUint32(22, 0xffffffff, true)
    h.setUint16(26, nameBytes.length, true)
    h.setUint16(28, 20, true)
    head.set(nameBytes, 30)
    const x = 30 + nameBytes.length
    h.setUint16(x, 0x0001, true) // ZIP64 extra field
    h.setUint16(x + 2, 16, true)
    await this.write(head)

    let crc = 0
    let size = 0
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || !value.length) continue
      crc = crcUpdate(crc, value)
      size += value.length
      await this.write(value)
      onBytes?.(value.length)
    }

    const dd = new Uint8Array(24)
    const d = new DataView(dd.buffer)
    d.setUint32(0, 0x08074b50, true)
    d.setUint32(4, crc, true)
    put64(d, 8, size)
    put64(d, 16, size)
    await this.write(dd)

    this.entries.push({ name: nameBytes, crc, size, offset: localOffset, time, date })
  }

  async finish() {
    const cdStart = this.offset
    for (const e of this.entries) {
      const rec = new Uint8Array(46 + e.name.length + 28)
      const v = new DataView(rec.buffer)
      v.setUint32(0, 0x02014b50, true)
      v.setUint16(4, 45, true)
      v.setUint16(6, 45, true)
      v.setUint16(8, 0x0808, true)
      v.setUint16(10, 0, true)
      v.setUint16(12, e.time, true)
      v.setUint16(14, e.date, true)
      v.setUint32(16, e.crc, true)
      v.setUint32(20, 0xffffffff, true)
      v.setUint32(24, 0xffffffff, true)
      v.setUint16(28, e.name.length, true)
      v.setUint16(30, 28, true)
      v.setUint16(32, 0, true)
      v.setUint16(34, 0, true)
      v.setUint16(36, 0, true)
      v.setUint32(38, 0, true)
      v.setUint32(42, 0xffffffff, true)
      rec.set(e.name, 46)
      const x = 46 + e.name.length
      v.setUint16(x, 0x0001, true)
      v.setUint16(x + 2, 24, true)
      put64(v, x + 4, e.size)
      put64(v, x + 12, e.size)
      put64(v, x + 20, e.offset)
      await this.write(rec)
    }
    const cdSize = this.offset - cdStart
    const eocd64Offset = this.offset

    const z = new Uint8Array(56 + 20 + 22)
    const v = new DataView(z.buffer)
    v.setUint32(0, 0x06064b50, true)
    put64(v, 4, 44)
    v.setUint16(12, 45, true)
    v.setUint16(14, 45, true)
    v.setUint32(16, 0, true)
    v.setUint32(20, 0, true)
    put64(v, 24, this.entries.length)
    put64(v, 32, this.entries.length)
    put64(v, 40, cdSize)
    put64(v, 48, cdStart)
    v.setUint32(56, 0x07064b50, true)
    v.setUint32(60, 0, true)
    put64(v, 64, eocd64Offset)
    v.setUint32(72, 1, true)
    v.setUint32(76, 0x06054b50, true)
    v.setUint16(80, 0, true)
    v.setUint16(82, 0, true)
    v.setUint16(84, 0xffff, true)
    v.setUint16(86, 0xffff, true)
    v.setUint32(88, 0xffffffff, true)
    v.setUint32(92, 0xffffffff, true)
    v.setUint16(96, 0, true)
    await this.write(z)
  }
}
