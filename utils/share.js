const theme = require('./canvas-theme.js')

/**
 * 分享图：纸本手绘风，2d canvas 绘制后导出临时文件
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {object} data { score, grade, gradeLabel, airTimeMs, estimatedHeight, rotationCount }
 * @param {Array} trajectoryPoints 0~1 归一化点
 */
function drawShareCard(ctx, w, h, data, trajectoryPoints) {
  const pad = 24
  const ink = theme.ink
  const paper = theme.sharePaper
  const muted = theme.textMuted
  const rule = theme.shareRule

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, w, h)

  let y = 0
  while (y < h) {
    ctx.strokeStyle = rule
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    y += 32
  }

  const headerH = 112
  ctx.strokeStyle = ink
  ctx.lineWidth = 3
  ctx.strokeRect(pad, pad, w - pad * 2, headerH)
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad + 5, pad + 5, w - pad * 2 - 10, headerH - 10)

  ctx.fillStyle = ink
  ctx.font = 'bold 26px "PingFang SC", sans-serif'
  ctx.fillText('飞机模式', pad + 18, pad + 52)
  ctx.font = '15px "PingFang SC", sans-serif'
  ctx.fillText('飞行报告 · 纸本记录', pad + 18, pad + 86)

  ctx.fillStyle = ink
  ctx.font = 'bold 56px "PingFang SC", sans-serif'
  ctx.fillText(String(data.score), pad + 16, pad + 210)
  ctx.font = '20px "PingFang SC", sans-serif'
  ctx.fillText(`等级 ${data.grade} · ${data.gradeLabel}`, pad + 16, pad + 252)

  ctx.font = '14px "PingFang SC", sans-serif'
  const line1 = `滞空 ${(data.airTimeMs / 1000).toFixed(2)}s · 估高 ${data.estimatedHeight.toFixed(2)}m`
  const line2 = `旋转 ${data.rotationCount.toFixed(1)} 圈`
  ctx.fillStyle = muted
  ctx.fillText(line1, pad + 16, pad + 292)
  ctx.fillText(line2, pad + 16, pad + 316)

  const chartTop = pad + 348
  const chartH = 140
  const chartW = w - pad * 2
  ctx.strokeStyle = ink
  ctx.lineWidth = 2
  ctx.setLineDash([6, 5])
  ctx.strokeRect(pad, chartTop, chartW, chartH)
  ctx.setLineDash([])

  if (trajectoryPoints && trajectoryPoints.length > 1) {
    ctx.beginPath()
    for (let i = 0; i < trajectoryPoints.length; i++) {
      const p = trajectoryPoints[i]
      const px = pad + p.x * chartW
      const py = chartTop + chartH - p.y * (chartH - 16) - 8
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = ink
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  ctx.fillStyle = muted
  ctx.font = '12px "PingFang SC", sans-serif'
  ctx.fillText('风险提示：在开阔、软垫/草地上方抛掷，别朝人或硬地扔。', pad, h - 20)
}

/**
 * @param {string} canvasId wxml 中 canvas id
 * @param {object} componentInstance 组件或页面的 this
 */
function renderShareCardToTempFile(canvasId, componentInstance, data, trajectoryPoints) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(componentInstance)
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('canvas not found'))
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 1
        const w = res[0].width > 0 ? res[0].width : 375
        const h = res[0].height > 0 ? res[0].height : 640
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        drawShareCard(ctx, w, h, data, trajectoryPoints)
        wx.canvasToTempFilePath(
          {
            canvas,
            width: w,
            height: h,
            destWidth: w * dpr,
            destHeight: h * dpr,
            fileType: 'png',
            success: (r) => resolve(r.tempFilePath),
            fail: reject
          },
          componentInstance
        )
      })
  })
}

module.exports = {
  drawShareCard,
  renderShareCardToTempFile
}
