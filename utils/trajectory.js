/**
 * 侧视抛物线轨迹点 + 速度标量（用于蓝→红渐变）+ 美感辅助指标
 */
const cfg = require('./config.js')

/**
 * 根据飞行结果生成 Canvas 归一化点列 { x, y, v, kind? }
 * x,y 在 0~1，y 向上为飞行高度
 */
function buildTrajectoryPoints(metrics, sampleCount = 48) {
  const { airTimeMs, estimatedHeight } = metrics
  const T = Math.max(0.05, airTimeMs / 1000)
  const H = Math.max(0.1, estimatedHeight)
  const n = Math.max(8, Math.floor(sampleCount))
  const points = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const t = u * T
    /** 对称抛物线：h(t) = H * 4 * u * (1-u) 在 u=0.5 达峰 */
    const h = H * 4 * u * (1 - u)
    const vyApprox = Math.abs(2 * u - 1) * (4 * H) / T
    const vNorm = Math.min(1, vyApprox / (Math.sqrt(2 * cfg.G * H) + 0.001))
    points.push({
      x: u,
      y: h / (H * 1.15),
      v: vNorm,
      kind: i === 0 ? 'start' : i === n ? 'end' : i === Math.floor(n / 2) ? 'apex' : 'path'
    })
  }
  return { points, maxH: H, durationS: T }
}

/**
 * 对称性得分 0-1（用于扩展评分）
 */
function symmetryScore(points) {
  if (points.length < 5) return 0.5
  const mid = Math.floor(points.length / 2)
  let err = 0
  let c = 0
  for (let i = 0; i < mid; i++) {
    const j = points.length - 1 - i
    err += Math.abs(points[i].y - points[j].y)
    c++
  }
  const avg = c ? err / c : 0
  return Math.max(0, 1 - avg * 5)
}

module.exports = {
  buildTrajectoryPoints,
  symmetryScore
}
