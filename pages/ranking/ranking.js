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
    topLocal: []
  },

  onShow() {
    const list = storage.readHistory()
    const enriched = list
      .map((r) => ({
        id: r.id,
        score: r.metrics ? r.metrics.score : 0,
        airStr:
          r.metrics && r.metrics.airTimeMs != null
            ? `${(r.metrics.airTimeMs / 1000).toFixed(2)}s`
            : '—',
        dateStr: formatDate(r.ts || Date.now())
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
    this.setData({ topLocal: enriched })
  }
})
