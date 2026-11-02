#!/usr/bin/env node
/**
 * bin/make-icon.js — 生成 bin/icon.ico（桌面快捷方式用）。
 *
 * 不引任何依赖：直接写一个 48×48、32 位 BGRA 的图标（BMP-in-ICO，Windows 原生）。
 * 图形和 icon.svg 一致：圆角方框 + 两个勾 + 两条线。
 *
 *   node bin/make-icon.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'icon.ico')
const SIZE = 48

// 背景：上浅下深的品牌蓝
const TOP = [0x4c, 0x7b, 0xff]
const BOTTOM = [0x2f, 0x5b, 0xe0]
const INK = [0xff, 0xff, 0xff]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 点到线段距离的平方 */
function distSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  let t = len === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + t * dx
  const qy = ay + t * dy
  return (px - qx) ** 2 + (py - qy) ** 2
}

/** 圆角方框的覆盖率（0/1），参数用 48 格坐标系 */
function inRoundedRect(x, y) {
  const left = 2.5
  const top = 2.5
  const right = SIZE - 2.5
  const bottom = SIZE - 2.5
  const r = 10
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = x < left + r ? left + r : x > right - r ? right - r : x
  const cy = y < top + r ? top + r : y > bottom - r ? bottom - r : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

const STROKES = [
  // 勾 1
  [13.5, 19.0, 17.6, 23.2],
  [17.6, 23.2, 24.6, 14.8],
  // 勾 2
  [13.5, 31.0, 17.6, 35.2],
  [17.6, 35.2, 24.6, 26.8],
  // 两条横线
  [28.4, 17.2, 37.0, 17.2],
  [28.4, 29.2, 37.0, 29.2],
]

function shade(x, y) {
  if (!inRoundedRect(x, y)) return null
  // 细边框：靠边一圈稍微深一点，让图标在小尺寸下有轮廓
  const t = clamp01((y - 2.5) / (SIZE - 5))
  let rgb = [
    Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
    Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
    Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
  ]
  const nearEdge = x < 4.6 || x > SIZE - 4.6 || y < 4.6 || y > SIZE - 4.6
  if (nearEdge) rgb = rgb.map((v) => Math.round(v * 0.86))
  return rgb
}

// 3×3 超采样
const S = 3
const SAMPLES = S * S
const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let cr = 0 // 预乘累加
    let cg = 0
    let cb = 0
    let hits = 0
    for (let sy = 0; sy < S; sy += 1) {
      for (let sx = 0; sx < S; sx += 1) {
        const px = x + (sx + 0.5) / S
        const py = y + (sy + 0.5) / S
        const base = shade(px, py)
        if (base === null) continue
        let ink = false
        for (let i = 0; i < STROKES.length; i += 1) {
          const [ax, ay, bx, by] = STROKES[i]
          if (distSq(px, py, ax, ay, bx, by) <= 1.9 * 1.9) {
            ink = true
            break
          }
        }
        const color = ink ? INK : base
        cr += color[0]
        cg += color[1]
        cb += color[2]
        hits += 1
      }
    }
    const idx = (y * SIZE + x) * 4
    if (hits === 0) continue
    // 直通 alpha：预乘值除以覆盖率
    pixels[idx] = Math.round(cb / hits) // B
    pixels[idx + 1] = Math.round(cg / hits) // G
    pixels[idx + 2] = Math.round(cr / hits) // R
    pixels[idx + 3] = Math.round((hits / SAMPLES) * 255)
  }
}

// --- 打包成 ICO（BMP-in-ICO）---
const xorRow = SIZE * 4
const andRow = Math.ceil(SIZE / 32) * 4 // 48 bit → 8 字节，已经 4 字节对齐
const imageSize = 40 + xorRow * SIZE + andRow * SIZE

const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type = icon
header.writeUInt16LE(1, 4) // count
header.writeUInt8(SIZE, 6) // width
header.writeUInt8(SIZE, 7) // height
header.writeUInt8(0, 8) // palette
header.writeUInt8(0, 9) // reserved
header.writeUInt16LE(1, 10) // planes
header.writeUInt16LE(32, 12) // bit count
header.writeUInt32LE(imageSize, 14)
header.writeUInt32LE(22, 18) // offset

const info = Buffer.alloc(40)
info.writeUInt32LE(40, 0)
info.writeInt32LE(SIZE, 4)
info.writeInt32LE(SIZE * 2, 8) // XOR + AND
info.writeUInt16LE(1, 12)
info.writeUInt16LE(32, 14)
info.writeUInt32LE(0, 16) // BI_RGB
info.writeUInt32LE(xorRow * SIZE, 20)
info.writeInt32LE(0, 24)
info.writeInt32LE(0, 28)
info.writeUInt32LE(0, 32)
info.writeUInt32LE(0, 36)

const body = Buffer.alloc(xorRow * SIZE + andRow * SIZE)
for (let y = 0; y < SIZE; y += 1) {
  // ICO 的 DIB 是自下而上
  const src = (SIZE - 1 - y) * SIZE * 4
  pixels.copy(body, y * xorRow, src, src + xorRow)
}
// AND mask 全 0 = 全部不透明，由 alpha 通道决定

fs.writeFileSync(OUT, Buffer.concat([header, info, body]))
process.stdout.write(`icon.ico ${SIZE}x${SIZE} ${fs.statSync(OUT).size} bytes\n`)