const theme = require('../../utils/canvas-theme.js')

const MAX_DRAW_POINTS = 320

const FONT_STACK =
  '13px PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, sans-serif'
const FONT_STACK_SMALL =
  '11px PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, sans-serif'

/** 与 canvas-theme 中 pencil / ink 对齐，非法 hex 时回退 */
const RGB_PENCIL = { r: 0x6b, g: 0x65, b: 0x5c }
const RGB_INK = { r: 0x14, g: 0x13, b: 0x11 }

/** 轨迹浓淡：铅笔灰 → 浓墨（纸本单色） */
function lerpInk(t) {
  const a = hexToRgb(theme.pencil, RGB_PENCIL)
  const b = hexToRgb(theme.ink, RGB_INK)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r},${g},${bl})`
}

function hexToRgb(hex, fallback) {
  const h = String(hex || '')
    .replace('#', '')
    .trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    return { r: fallback.r, g: fallback.g, b: fallback.b }
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

function downsamplePoints(pts, maxN) {
  if (!pts || pts.length <= maxN) return pts || []
  const n = pts.length
  const out = []
  const step = (n - 1) / (maxN - 1)
  for (let i = 0; i < maxN; i++) {
    out.push(pts[Math.min(n - 1, Math.round(i * step))])
  }
  return out
}

function buildSummaryText(pts) {
  if (!pts || pts.length < 2) {
    return '暂无足够轨迹点。侧视示意曲线用于看「起—抬—落」节奏与相对高低，不代表真实弹道。'
  }
  const n = pts.length
  let apexIdx = Math.floor(n / 2)
  for (let i = 0; i < n; i++) {
    if (pts[i].kind === 'apex') apexIdx = i
  }
  const t = apexIdx / Math.max(1, n - 1)
  const seg = t < 0.34 ? '前段' : t < 0.67 ? '中段' : '后段'
  return `侧视示意曲线由 ${n} 个采样点连成；最高点大约出现在全程${seg}。用于看节奏与相对高低，不用于精确对比。`
}

Component({
  properties: {
    points: {
      type: Array,
      value: []
    }
  },

  data: {
    canvasReady: false,
    summaryText: '轨迹说明加载中…'
  },

  lifetimes: {
    ready() {
      this.initCanvas()
    }
  },

  observers: {
    points(val) {
      const summary = buildSummaryText(val)
      this.setData({ summaryText: summary })
      if (this.ctx) this.draw()
    }
  },

  methods: {
    initCanvas() {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('#flightChartCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio || 1
          const w = res[0].width
          const h = res[0].height
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)
          this.canvas = canvas
          this.ctx = ctx
          this.cssW = w
          this.cssH = h
          const summary = buildSummaryText(this.properties.points)
          this.setData({ canvasReady: true, summaryText: summary })
          this.draw()
        })
    },

    draw() {
      const ctx = this.ctx
      if (!ctx) return
      const ptsRaw = this.properties.points || []
      const pts = downsamplePoints(ptsRaw, MAX_DRAW_POINTS)
      const w = this.cssW
      const h = this.cssH
      if (!w || !h) return

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = theme.bgChart
      ctx.fillRect(0, 0, w, h)

      if (pts.length < 2) {
        ctx.fillStyle = theme.textMuted
        ctx.font = FONT_STACK
        ctx.textBaseline = 'middle'
        ctx.fillText('暂无轨迹数据', 16, h / 2)
        return
      }

      const pad = 20
      const plotW = w - pad * 2
      const plotH = h - pad * 2

      ctx.strokeStyle = theme.baselineLight
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pad, pad + plotH)
      ctx.lineTo(pad + plotW, pad + plotH)
      ctx.stroke()

      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i]
        const p1 = pts[i + 1]
        const x0 = pad + p0.x * plotW
        const y0 = pad + plotH - p0.y * plotH
        const x1 = pad + p1.x * plotW
        const y1 = pad + plotH - p1.y * plotH
        const vm = ((p0.v || 0) + (p1.v || 0)) / 2
        ctx.strokeStyle = lerpInk(vm)
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }

      const mark = (p, label, color) => {
        if (!p) return
        const x = pad + p.x * plotW
        const y = pad + plotH - p.y * plotH
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = theme.textPrimary
        ctx.font = FONT_STACK_SMALL
        ctx.fillText(label, x + 8, y + 4)
      }

      const start = ptsRaw[0]
      const end = ptsRaw[ptsRaw.length - 1]
      let apex = ptsRaw[Math.floor(ptsRaw.length / 2)]
      for (let i = 0; i < ptsRaw.length; i++) {
        if (ptsRaw[i].kind === 'apex') apex = ptsRaw[i]
      }
      mark(start, '起飞', theme.markStart)
      mark(apex, '最高点', theme.markApex)
      mark(end, '着陆', theme.markEnd)
    }
  }
})
