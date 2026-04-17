const storage = require('../../utils/storage.js')

function formatDate(ts) {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  const h = `${d.getHours()}`.padStart(2, '0')
  const min = `${d.getMinutes()}`.padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

Page({
  data: {
    list: []
  },

  onShow() {
    const raw = storage.readHistory()
    const list = raw.map((r) => ({
      id: r.id,
      score: r.metrics ? r.metrics.score : 0,
      grade: r.metrics ? r.metrics.grade : '—',
      gradeLabel: r.metrics ? r.metrics.gradeLabel : '',
      airStr:
        r.metrics && r.metrics.airTimeMs != null
          ? `${(r.metrics.airTimeMs / 1000).toFixed(2)}s`
          : '—',
      dateStr: formatDate(r.ts || Date.now())
    }))
    this.setData({ list })
  },

  openReport(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/report/report?id=${id}` })
  }
})
