const sensor = require('../../utils/sensor.js')
const algorithm = require('../../utils/algorithm.js')
const trajectory = require('../../utils/trajectory.js')
const storage = require('../../utils/storage.js')
const cfg = require('../../utils/config.js')
const theme = require('../../utils/canvas-theme.js')

function magnitude3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z)
}

function downsampleSamples(samples, maxPoints) {
  if (!samples.length) return []
  const n = samples.length
  if (n <= maxPoints) {
    return samples.map((s) => ({
      t: s.t,
      am: magnitude3(s.ax, s.ay, s.az),
      gm: magnitude3(s.gx, s.gy, s.gz)
    }))
  }
  const out = []
  const step = (n - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.round(i * step))
    const s = samples[idx]
    out.push({
      t: s.t,
      am: magnitude3(s.ax, s.ay, s.az),
      gm: magnitude3(s.gx, s.gy, s.gz)
    })
  }
  return out
}

const UI_THROTTLE_MS = 72
const CURVE_DRAW_MS = 48
const MAX_CURVE_POINTS = 240

function phaseHint(phase) {
  const map = {
    IDLE: '拿稳手机，准备出手',
    THROW: '起速中——',
    AIRBORNE: '在空中——',
    LANDED: '好像落地了，正在确认…'
  }
  return map[phase] || '收集数据中'
}

function phaseAnim(phase) {
  if (phase === 'THROW') return 'throw'
  if (phase === 'AIRBORNE') return 'air'
  if (phase === 'LANDED') return 'land'
  return 'idle'
}

/**
 * 由合加速度采样粗略积分出「侧视高度」轮廓（非真实位移，仅用于实时可视化）
 */
function computeSideViewPoints(samples) {
  if (samples.length < 2) return []
  const n = samples.length
  const G = cfg.G
  let h = 0
  let hMax = 1e-6
  const out = []
  for (let i = 0; i < n; i++) {
    const dt =
      i === 0 ? 0.018 : Math.max(0.007, (samples[i].t - samples[i - 1].t) / 1000)
    const m = samples[i].m
    const lift = Math.max(0, m - G * 0.9)
    h += lift * dt * 5.8
    if (lift < 0.45 && m < G + 1.3) {
      h *= 0.986
    }
    h = Math.max(0, h)
    hMax = Math.max(hMax, h)
    const x = i / (n - 1)
    const yNorm = Math.min(1, h / (hMax * 1.1))
    out.push({ x, y: yNorm })
  }
  return out
}

function drawLiveSideView(ctx, w, h, samples) {
  const pad = 10
  const pw = w - pad * 2
  const ph = h - pad * 2
  ctx.fillStyle = theme.bgChart
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = theme.baseline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, pad + ph)
  ctx.lineTo(pad + pw, pad + ph)
  ctx.stroke()

  const pts = computeSideViewPoints(samples)
  if (pts.length < 2) {
    ctx.fillStyle = theme.textMuted
    ctx.font =
      '13px PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('侧视曲线绘制中…', pad + 8, pad + ph * 0.48)
    return
  }

  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    const px = pad + pts[i].x * pw
    const py = pad + ph - pts[i].y * ph
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.lineTo(pad + pw, pad + ph)
  ctx.lineTo(pad, pad + ph)
  ctx.closePath()
  ctx.fillStyle = theme.areaFill
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    const px = pad + pts[i].x * pw
    const py = pad + ph - pts[i].y * ph
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = theme.ink
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

Page({
  data: {
    phase: 'countdown',
    countdown: 3,
    flightPhase: 'IDLE',
    flightAnim: 'idle',
    phaseHint: '拿稳手机，准备出手',
    planeRot: 0
  },

  accumulator: null,
  sessionStartWall: 0,
  ended: false,
  _lastFlightPhase: 'IDLE',
  _curvePts: [],
  _uiDebounce: null,
  _pendingPlaneRot: 0,
  _drawDebounce: null,
  _liveCtx: null,
  _liveW: 0,
  _liveH: 0,
  _liveTrajInited: false,
  _liveTrajRetry: 0,

  onUnload() {
    this.cleanup()
  },

  onHide() {
    this.cleanup()
  },

  cleanup() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    if (this._uiDebounce) {
      clearTimeout(this._uiDebounce)
      this._uiDebounce = null
    }
    if (this._drawDebounce) {
      clearTimeout(this._drawDebounce)
      this._drawDebounce = null
    }
    sensor.stopRecording()
  },

  onCancel() {
    this.cleanup()
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/index/index' }) })
  },

  onLoad() {
    this.ended = false
    this._lastFlightPhase = 'IDLE'
    this._curvePts = []
    this.setData({
      phase: 'countdown',
      countdown: 3,
      flightPhase: 'IDLE',
      flightAnim: 'idle',
      phaseHint: phaseHint('IDLE'),
      planeRot: 0
    })
    this.runCountdown()
  },

  runCountdown() {
    let c = 3
    this.setData({ countdown: c })
    this.countdownTimer = setInterval(() => {
      c--
      if (c <= 0) {
        clearInterval(this.countdownTimer)
        this.countdownTimer = null
        this.startFlight()
        return
      }
      this.setData({ countdown: c })
    }, 1000)
  },

  initLiveTrajCanvas() {
    if (this.ended || this.data.phase !== 'flying') return
    const q = wx.createSelectorQuery().in(this)
    q.select('#liveTrajCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this._liveTrajRetry = (this._liveTrajRetry || 0) + 1
          if (this._liveTrajRetry < 10) {
            setTimeout(() => this.initLiveTrajCanvas(), 50)
          }
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
        this._liveCtx = ctx
        this._liveW = w
        this._liveH = h
        this._liveTrajInited = true
        this.drawLiveTrajCanvas()
      })
  },

  scheduleLiveDraw() {
    if (this._drawDebounce) return
    this._drawDebounce = setTimeout(() => {
      this._drawDebounce = null
      this.drawLiveTrajCanvas()
    }, CURVE_DRAW_MS)
  },

  drawLiveTrajCanvas() {
    if (!this._liveCtx || !this._liveW || !this._liveH) return
    drawLiveSideView(this._liveCtx, this._liveW, this._liveH, this._curvePts)
  },

  startFlight() {
    this.sessionStartWall = Date.now()
    this.accumulator = algorithm.createStreamingAccumulator()
    this.ended = false
    this._lastFlightPhase = 'IDLE'
    this._curvePts = []
    this._liveTrajInited = false
    this._liveTrajRetry = 0
    this._liveCtx = null
    this._liveW = 0
    this._liveH = 0

    this.setData(
      {
        phase: 'flying',
        flightPhase: 'IDLE',
        flightAnim: 'idle',
        phaseHint: phaseHint('IDLE'),
        planeRot: 0
      },
      () => {
        setTimeout(() => this.initLiveTrajCanvas(), 0)
      }
    )

    try {
      sensor.startRecording((sample) => this.onSample(sample))
    } catch (e) {
      wx.showToast({ title: '传感器启动失败', icon: 'none' })
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    this.sessionTimer = setInterval(() => {
      if (this.ended) return
      if (Date.now() - this.sessionStartWall > cfg.MAX_SESSION_MS) {
        this.finishSession(false, false)
      }
    }, 400)
  },

  onSample(sample) {
    if (this.ended) return
    const acc = this.accumulator
    if (!acc) return

    const r = algorithm.pushStreamingSample(acc, sample)

    const gz = sample.gz || 0
    const gy = sample.gy || 0
    const gx = sample.gx || 0
    const planeRot = Math.max(-34, Math.min(34, gz * 12 + gy * 6 + gx * 3))
    this._pendingPlaneRot = planeRot

    this._curvePts.push({ t: sample.t, m: r.magnitude })
    if (this._curvePts.length > MAX_CURVE_POINTS) this._curvePts.shift()

    const phaseChanged = r.phase !== this._lastFlightPhase
    if (phaseChanged) {
      this._lastFlightPhase = r.phase
      if (this._uiDebounce) {
        clearTimeout(this._uiDebounce)
        this._uiDebounce = null
      }
      this.setData({
        flightPhase: r.phase,
        flightAnim: phaseAnim(r.phase),
        phaseHint: phaseHint(r.phase),
        planeRot
      })
    } else if (!this._uiDebounce) {
      this._uiDebounce = setTimeout(() => {
        this._uiDebounce = null
        this.setData({
          flightPhase: r.phase,
          flightAnim: phaseAnim(r.phase),
          phaseHint: phaseHint(r.phase),
          planeRot: this._pendingPlaneRot
        })
      }, UI_THROTTLE_MS)
    }

    if (this._liveTrajInited) {
      this.scheduleLiveDraw()
    }

    if (r.landed) {
      this.finishSession(r.strongImpact, false)
    }
  },

  onManualStop() {
    if (this.data.phase !== 'flying' || this.ended) return
    this.finishSession(false, true)
  },

  finishSession(strongImpact, manual) {
    if (this.ended) return
    this.ended = true
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    if (this._uiDebounce) {
      clearTimeout(this._uiDebounce)
      this._uiDebounce = null
    }
    if (this._drawDebounce) {
      clearTimeout(this._drawDebounce)
      this._drawDebounce = null
    }
    sensor.stopRecording()

    this.setData({ phase: 'generating' })

    const metrics = algorithm.finalizeMetricsFromAccumulator(this.accumulator)
    const traj = trajectory.buildTrajectoryPoints(metrics, 40)
    const samplesLite = downsampleSamples(this.accumulator.samples, 200)

    const id = `${Date.now()}`
    const record = {
      id,
      ts: Date.now(),
      metrics: {
        airTimeMs: metrics.airTimeMs,
        estimatedHeight: metrics.estimatedHeight,
        rotationCount: metrics.rotationCount,
        maxAcc: metrics.maxAcc,
        score: metrics.score,
        grade: metrics.grade,
        gradeLabel: metrics.gradeLabel,
        airScore: metrics.airScore,
        poseScore: metrics.poseScore,
        trajScore: metrics.trajScore,
        ok: metrics.ok,
        manual,
        strongImpact: !!strongImpact
      },
      trajectoryPoints: traj.points,
      samplesLite
    }

    storage.setCurrentReport(record)
    if (this.accumulator.samples.length > 8) {
      storage.addFlightRecord(record)
    }

    if (strongImpact) {
      wx.showModal({
        title: '检测到较强冲击',
        content: '请检查手机是否完好。即将查看本次飞行报告。',
        showCancel: false,
        success: () => this.goReport()
      })
      return
    }

    this.goReport()
  },

  goReport() {
    wx.redirectTo({ url: '/pages/report/report' })
  }
})
