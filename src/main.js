import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { firebaseConfig } from './firebase-config.js'

// ===== カード定義 =====
const CARDS = {
  home_card: {
    title: '🏠 おうちスタンプ',
    containerId: 'homeStamps',
    stamps: [
      'nanaで配信した',
      'nanaのフォロワーを10人増やした',
      '障碍年金のお話を進めた',
    ],
  },
  together_card: {
    title: '💕 一緒スタンプ',
    containerId: 'togetherStamps',
    stamps: [
      'お部屋のお掃除をした',
      'たたにマッサージをした',
      'なんでもいいよ',
    ],
  },
}

// ===== Firebase 初期化 =====
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ===== DOM 要素 =====
const adminPanel    = document.getElementById('adminPanel')
const pendingEl     = document.getElementById('pendingRequests')
const btnResetHome  = document.getElementById('btnResetHome')
const btnResetTogether = document.getElementById('btnResetTogether')
const modal         = document.getElementById('modal')
const modalText     = document.getElementById('modalText')
const modalClose    = document.getElementById('modalClose')
const particles     = document.getElementById('particles')

// ===== タブ切り替え =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const cardId = btn.dataset.card
    document.getElementById('homeStamps').classList.toggle('hidden', cardId !== 'home_card')
    document.getElementById('togetherStamps').classList.toggle('hidden', cardId !== 'together_card')
  })
})

// ===== 管理者判定 =====
const isAdmin = new URLSearchParams(location.search).get('admin') === '1'
if (isAdmin) {
  adminPanel.style.display = 'block'
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

// ===== State =====
const cardStates    = { home_card: [false, false, false], together_card: [false, false, false] }
const completedCards = new Set()
let pendingRequests = {}

// ===== カード描画 =====
function renderCard(cardId) {
  const { containerId, stamps } = CARDS[cardId]
  const container = document.getElementById(containerId)
  const state = cardStates[cardId]

  container.innerHTML = ''
  stamps.forEach((label, i) => {
    const cell = document.createElement('div')
    cell.className = 'stamp-cell'

    const slot = document.createElement('div')
    slot.className = 'stamp-slot' + (state[i] ? ' stamped' : '')
    slot.textContent = state[i] ? '🌸' : ''

    const text = document.createElement('p')
    text.className = 'stamp-label'
    text.textContent = label

    cell.appendChild(slot)
    cell.appendChild(text)

    // まいちゃん用「お願いする」ボタン
    if (!isAdmin && !state[i]) {
      const isPending = Object.values(pendingRequests).some(
        r => r.cardId === cardId && r.stampIndex === i
      )
      const btn = document.createElement('button')
      btn.className = 'btn-request' + (isPending ? ' pending' : '')
      btn.textContent = isPending ? 'リクエスト中…' : 'お願いする'
      btn.disabled = isPending
      btn.addEventListener('click', () => requestStamp(cardId, i))
      cell.appendChild(btn)
    }

    container.appendChild(cell)
  })
}

// ===== Firestore 監視: カードデータ =====
Object.keys(CARDS).forEach(cardId => {
  const ref = doc(db, 'stampCards', cardId)
  onSnapshot(ref, snap => {
    if (!snap.exists()) {
      setDoc(ref, { stamps: [false, false, false] })
      return
    }
    const stamps = snap.data().stamps ?? [false, false, false]
    const wasComplete = completedCards.has(cardId)
    cardStates[cardId] = stamps
    renderCard(cardId)

    // コンプリート判定
    if (stamps.every(s => s) && !wasComplete) {
      completedCards.add(cardId)
      const title = CARDS[cardId].title
      modalText.innerHTML = `おめでとう！<br>${title}<br>コンプリート！🌸`
      modal.style.display = 'flex'
      spawnParticles()
    }
  }, err => showError(`Firebase 接続エラー: ${err.message}`))
})

// ===== Firestore 監視: スタンプリクエスト =====
let isFirstLoad = true
onSnapshot(collection(db, 'stampRequests'), snap => {
  const newRequests = {}
  snap.forEach(d => { newRequests[d.id] = { ...d.data(), id: d.id } })

  // 管理者への通知（新規リクエストが来たとき）
  if (!isFirstLoad && isAdmin) {
    const addedCount = snap.docChanges().filter(c => c.type === 'added').length
    if (addedCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('まいちゃんからスタンプのお願いが届きました！', {
        body: 'スタンプカードを確認してください 🌸',
      })
    }
  }
  isFirstLoad = false

  pendingRequests = newRequests

  // カード再描画（ボタン状態更新）
  Object.keys(CARDS).forEach(cardId => renderCard(cardId))

  if (isAdmin) renderPendingList()
}, err => showError(`リクエスト監視エラー: ${err.message}`))

// ===== 管理者: リクエスト一覧 =====
function renderPendingList() {
  const list = Object.values(pendingRequests)
  if (list.length === 0) {
    pendingEl.innerHTML = '<p class="no-requests">リクエストなし</p>'
    return
  }

  pendingEl.innerHTML = '<h3 class="pending-title">📬 スタンプのお願い</h3>'
  list.forEach(req => {
    const cardDef = CARDS[req.cardId]
    const label = cardDef?.stamps[req.stampIndex] ?? '?'
    const cardTitle = cardDef?.title ?? req.cardId

    const item = document.createElement('div')
    item.className = 'request-item'

    const info = document.createElement('span')
    info.textContent = `${cardTitle}：「${label}」`

    const btn = document.createElement('button')
    btn.className = 'btn-stamp'
    btn.textContent = 'スタンプを押す'
    btn.addEventListener('click', () => approveRequest(req))

    item.appendChild(info)
    item.appendChild(btn)
    pendingEl.appendChild(item)
  })
}

// ===== スタンプリクエスト送信 =====
async function requestStamp(cardId, stampIndex) {
  try {
    await addDoc(collection(db, 'stampRequests'), {
      cardId,
      stampIndex,
      requestedAt: serverTimestamp(),
    })
  } catch (e) {
    showError(`リクエスト失敗: ${e.message}`)
  }
}

// ===== リクエスト承認（スタンプ押す） =====
async function approveRequest(req) {
  try {
    const stamps = [...cardStates[req.cardId]]
    stamps[req.stampIndex] = true
    await updateDoc(doc(db, 'stampCards', req.cardId), { stamps })
    await deleteDoc(doc(db, 'stampRequests', req.id))
    spawnParticles()
  } catch (e) {
    showError(`承認失敗: ${e.message}`)
  }
}

// ===== リセットボタン =====
btnResetHome.addEventListener('click', async () => {
  if (!confirm('おうちスタンプをリセットしますか？')) return
  await setDoc(doc(db, 'stampCards', 'home_card'), { stamps: [false, false, false] })
  completedCards.delete('home_card')
  modal.style.display = 'none'
})

btnResetTogether.addEventListener('click', async () => {
  if (!confirm('一緒スタンプをリセットしますか？')) return
  await setDoc(doc(db, 'stampCards', 'together_card'), { stamps: [false, false, false] })
  completedCards.delete('together_card')
  modal.style.display = 'none'
})

modalClose.addEventListener('click', () => {
  modal.style.display = 'none'
})

// ===== キラキラパーティクル =====
function spawnParticles() {
  const colors = ['#ff7eb3', '#ffe066', '#a0e4ff', '#b5f5c8', '#ffb347', '#d4aaff']
  for (let i = 0; i < 24; i++) {
    const el = document.createElement('div')
    el.className = 'particle'
    const size  = 6 + Math.random() * 10
    const angle = Math.random() * 2 * Math.PI
    const dist  = 80 + Math.random() * 140
    el.style.cssText = `
      width: ${size}px; height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${40 + Math.random() * 20}%;
      top: ${30 + Math.random() * 30}%;
      --tx: ${(Math.cos(angle) * dist).toFixed(1)}px;
      --ty: ${(Math.sin(angle) * dist).toFixed(1)}px;
    `
    particles.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
}

// ===== エラー表示 =====
function showError(msg) {
  const existing = document.querySelector('.error-banner')
  if (existing) existing.remove()
  const banner = document.createElement('div')
  banner.className = 'error-banner'
  banner.textContent = msg
  document.getElementById('app').prepend(banner)
}
