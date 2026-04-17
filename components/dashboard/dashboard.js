const theme = require('../../utils/canvas-theme.js')

const FONT_EMPTY =
  '13px PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, sans-serif'

function drawSeries(ctx, w, h, series, color) {
  if (!series || series.length < 2) {
    ctx.fillStyle = theme.textMuted
    ctx.font = FONT_EMPTY
    ctx.textBaseline = 'middle'
    ctx.fillText('无数据', 8, h / 2)
    return
  }
  const pad = 6
  const pw = w - pad * 2
  const ph = h - pad * 2
  let min = series[0]
  let max = series[0]
  for (const v of series) {
    if (v < min) min = v
    if (v > max) max = v
  }
  if (max - min < 1e-6) {
    max = min + 1
  }
  ctx.strokeStyle = theme.baseline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, pad + ph)
  ctx.lineTo(pad + pw, pad + ph)
  ctx.stroke()

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < series.length; i++) {
    const x = pad + (i / (series.length - 1)) * pw
    const y = pad + ph - ((series[i] - min) / (max - min)) * ph
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function buildDashSummary(samples) {
  const n = samples && samples.length ? samples.length : 0
  if (n < 2) {
    return '暂无足够采样点。上图表示合加速度随时间变化，下图表示角速度随时间变化；均为示意曲线，非精密测量。'
  }
  return `上图（合加速度）与下图（角速度）各以 ${n} 个采样点连成；走势仅为示意，非精密测量。`
}

Component({
  properties: {
    samplesLite: { type: Array, value: [] },
    metrics: { type: Object, value: {} }
  },

  data: {
    display: {
      air: '—',
      h: '—',
      rot: '—',
      acc: '—'
    },
    summaryText:
      '暂无足够采样点。上图表示合加速度随时间变化，下图表示角速度随时间变化；均为示意曲线，非精密测量。'
  },

  observers: {
    'samplesLite, metrics': function () {
      this.updateDisplay()
      this.queueDrawCharts()
    }
  },

  lifetimes: {
    ready() {
      this.chartReady = 0
      this.initCanvas('accLine', 'accCtx', 'accW', 'accH', () => {
        this.chartReady++
        this.drawChartsImpl()
      })
      this.initCanvas('gyroLine', 'gyroCtx', 'gyroW', 'gyroH', () => {
        this.chartReady++
        this.drawChartsImpl()
      })
    },
    detached() {
      if (this._drawTimer) {
        clearTimeout(this._drawTimer)
        this._drawTimer = null
      }
    }
  },

  methods: {
    initCanvas(id, ctxKey, wKey, hKey, cb) {
      const query = wx.createSelectorQuery().in(this)
      query
        .select(`#${id}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            if (cb) cb()
            return
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio || 1
          const w = res[0].width
          const h = res[0].height
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)
          this[ctxKey] = ctx
          this[wKey] = w
          this[hKey] = h
          if (cb) cb()
        })
    },

    updateDisplay() {
      const m = this.properties.metrics || {}
      const air =
        m.airTimeMs != null ? `${(m.airTimeMs / 1000).toFixed(2)} s` : '—'
      const h =
        m.estimatedHeight != null ? `${m.estimatedHeight.toFixed(2)} m` : '—'
      const rot =
        m.rotationCount != null ? `${m.rotationCount.toFixed(1)} 圈` : '—'
      const acc = m.maxAcc != null ? `${m.maxAcc.toFixed(1)}` : '—'
      const summaryText = buildDashSummary(this.properties.samplesLite || [])
      this.setData({ display: { air, h, rot, acc }, summaryText })
    },

    queueDrawCharts() {
      if (this._drawTimer) clearTimeout(this._drawTimer)
      this._drawTimer = setTimeout(() => {
        this._drawTimer = null
        this.drawChartsImpl()
      }, 32)
    },

    drawChartsImpl() {
      const samples = this.properties.samplesLite || []
      const am = samples.map((s) => s.am)
      const gm = samples.map((s) => s.gm)

      if (this.accCtx && this.accW && this.accH) {
        this.accCtx.clearRect(0, 0, this.accW, this.accH)
        this.accCtx.fillStyle = theme.bgChart
        this.accCtx.fillRect(0, 0, this.accW, this.accH)
        drawSeries(this.accCtx, this.accW, this.accH, am, theme.accStroke)
      }
      if (this.gyroCtx && this.gyroW && this.gyroH) {
        this.gyroCtx.clearRect(0, 0, this.gyroW, this.gyroH)
        this.gyroCtx.fillStyle = theme.bgChart
        this.gyroCtx.fillRect(0, 0, this.gyroW, this.gyroH)
        drawSeries(this.gyroCtx, this.gyroW, this.gyroH, gm, theme.ink)
      }
    }
  }
})
