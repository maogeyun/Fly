const cfg = require('./config.js')

const KEY_DISCLAIMER = 'disclaimerAccepted'
const KEY_HISTORY = 'flightHistory'
const KEY_CURRENT = 'currentFlightReport'

function readHistory() {
  try {
    const raw = wx.getStorageSync(KEY_HISTORY)
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

function saveHistory(list) {
  wx.setStorageSync(KEY_HISTORY, list.slice(0, cfg.HISTORY_MAX))
}

/** @param {object} record 含 id, ts, metrics, trajectoryPoints, samplesLite */
function addFlightRecord(record) {
  const list = readHistory()
  list.unshift(record)
  saveHistory(list)
}

function getDisclaimerAccepted() {
  try {
    return !!wx.getStorageSync(KEY_DISCLAIMER)
  } catch (e) {
    return false
  }
}

function setDisclaimerAccepted(v) {
  wx.setStorageSync(KEY_DISCLAIMER, !!v)
}

function setCurrentReport(payload) {
  wx.setStorageSync(KEY_CURRENT, payload)
}

function getCurrentReport() {
  try {
    return wx.getStorageSync(KEY_CURRENT) || null
  } catch (e) {
    return null
  }
}

function clearCurrentReport() {
  try {
    wx.removeStorageSync(KEY_CURRENT)
  } catch (e) {}
}

function getFlightById(id) {
  return readHistory().find((r) => r.id === id) || null
}

module.exports = {
  KEY_DISCLAIMER,
  KEY_HISTORY,
  KEY_CURRENT,
  readHistory,
  addFlightRecord,
  getDisclaimerAccepted,
  setDisclaimerAccepted,
  setCurrentReport,
  getCurrentReport,
  clearCurrentReport,
  getFlightById
}
