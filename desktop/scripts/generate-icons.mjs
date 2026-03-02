/**
 * 生成 CCB Desktop 应用图标
 *
 * 使用 Electron nativeImage 在运行时创建图标，
 * 无需外部依赖。
 *
 * 运行: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

if (!existsSync(resourcesDir)) {
    mkdirSync(resourcesDir, { recursive: true })
}

/**
 * 生成简单的 PNG 图标（纯 Node.js，无外部依赖）
 * 格式：极简 CCB logo — 蓝色圆角矩形 + 白色 "C" 字母
 */
function createPNG(size) {
    // 创建最简 PNG (RGBA)
    const width = size
    const height = size
    const pixels = Buffer.alloc(width * height * 4, 0)

    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.floor(size * 0.42)

    // 蓝色背景圆
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX
            const dy = y - centerY
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist <= radius) {
                const idx = (y * width + x) * 4
                // CCB 蓝色 #135bec
                pixels[idx] = 0x13     // R
                pixels[idx + 1] = 0x5b // G
                pixels[idx + 2] = 0xec // B
                pixels[idx + 3] = 0xff // A

                // "C" 字母区域（白色）
                const letterRadius = radius * 0.55
                const letterDist = Math.sqrt(dx * dx + dy * dy)
                const angle = Math.atan2(dy, dx)

                if (letterDist > letterRadius * 0.45 && letterDist < letterRadius &&
                    !(angle > -0.7 && angle < 0.7)) {
                    pixels[idx] = 0xff
                    pixels[idx + 1] = 0xff
                    pixels[idx + 2] = 0xff
                    pixels[idx + 3] = 0xff
                }
            }
        }
    }

    return encodePNG(width, height, pixels)
}

/** 极简 PNG 编码器 */
function encodePNG(width, height, rgbaPixels) {
    const { createDeflateRaw } = await import('zlib')

    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

    // IHDR chunk
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8  // bit depth
    ihdr[9] = 6  // color type (RGBA)
    ihdr[10] = 0 // compression
    ihdr[11] = 0 // filter
    ihdr[12] = 0 // interlace

    // Raw data with filter bytes
    const rawData = Buffer.alloc(height * (1 + width * 4))
    for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0 // filter: none
        rgbaPixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
    }

    // Compress
    const { deflateRawSync } = require('zlib')
    const compressed = deflateRawSync(rawData)

    // Build PNG
    function makeChunk(type, data) {
        const buf = Buffer.alloc(4 + 4 + data.length + 4)
        buf.writeUInt32BE(data.length, 0)
        buf.write(type, 4, 4, 'ascii')
        data.copy(buf, 8)
        // CRC
        const crcData = Buffer.concat([Buffer.from(type, 'ascii'), data])
        let crc = 0xffffffff
        for (const byte of crcData) {
            crc ^= byte
            for (let i = 0; i < 8; i++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
            }
        }
        buf.writeInt32BE(~crc, 8 + data.length)
        return buf
    }

    return Buffer.concat([
        signature,
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', compressed),
        makeChunk('IEND', Buffer.alloc(0))
    ])
}

// 生成不同尺寸
const sizes = [16, 32, 64, 128, 256, 512, 1024]

console.log('Generating CCB Desktop icons...')

for (const size of sizes) {
    try {
        const png = createPNG(size)
        const filename = `icon-${size}.png`
        writeFileSync(join(resourcesDir, filename), png)
        console.log(`  ✓ ${filename} (${png.length} bytes)`)
    } catch (e) {
        console.error(`  ✗ icon-${size}.png: ${e.message}`)
    }
}

// Tray 模板图标 (用于 macOS，后缀 Template 使其自动适配暗/亮模式)
try {
    const tray = createPNG(22)
    writeFileSync(join(resourcesDir, 'trayTemplate.png'), tray)
    writeFileSync(join(resourcesDir, 'trayTemplate@2x.png'), createPNG(44))
    console.log('  ✓ trayTemplate.png + trayTemplate@2x.png')
} catch (e) {
    console.error(`  ✗ tray icons: ${e.message}`)
}

console.log('Done!')
