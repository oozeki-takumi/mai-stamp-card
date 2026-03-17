import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firebaseConfig, COLLECTION, DOCUMENT_ID } from './firebase-config.js'

// ===== Firebase 初期化 =====
const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)
const cardRef = doc(db, COLLECTION, DOCUMENT_ID)

// ===== DOM 要素 =====
const stampCard   = document.getElementById('stampCard')
const stampCount  = document.getElementById('stampCount')
const adminPanel  = document.getElementById('adminPanel')
const btnStamp    = document.getElementById('btnStamp')
const btnReset    = document.getElementById('btnReset')
const modal       = document.getElementById('modal')
const modalClose  = document.getElementById('modalClose')
const particles   = document.getElementById('particles')

const TOTAL = 10

// ===== スタンプ枠を生成 =====
for (let i = 0; i < TOTAL; i++) {
  const slot = document.createElement('div')
  slot.className = 'stamp-slot'
  slot.dataset.index = i
  stampCard.appendChild(slot)
}

// ===== 管理者モード判定（URL に ?admin=1） =====
const isAdmin = new URLSearchParams(location.search).get('admin') === '1'
if (isAdmin) adminPanel.style.display = 'flex'

// ===== Firestore リアルタイム監視 =====
let prevCount = 0
let modalShown = false

onSnapshot(cardRef, (snapshot) => {
  if (!snapshot.exists()) {
    // ドキュメントが無ければ初期化
    setDoc(cardRef, { count: 0 })
    return
  }

  const count = snapshot.data().count ?? 0
  renderStamps(count)

  // 新たにスタンプが増えたときだけ演出
  if (count > prevCount) {
    spawnParticles()
  }

  // 10個コンプリート
  if (count >= TOTAL && !modalShown) {
    modalShown = true
    modal.style.display = 'flex'
  }

  prevCount = count
}, (err) => {
  showError(`Firebase 接続エラー: ${err.message}`)
})

// ===== スタンプ描画 =====
function renderStamps(count) {
  stampCount.textContent = `スタンプ: ${count} / ${TOTAL}`

  const slots = stampCard.querySelectorAll('.stamp-slot')
  slots.forEach((slot, i) => {
    const filled = i < count
    if (filled && !slot.classList.contains('stamped')) {
      slot.classList.add('stamped')
      slot.textContent = '🌸'
    } else if (!filled) {
      slot.classList.remove('stamped')
      slot.textContent = ''
    }
  })

  if (isAdmin) btnStamp.disabled = count >= TOTAL
}

// ===== キラキラパーティクル =====
function spawnParticles() {
  const colors = ['#ff7eb3', '#ffe066', '#a0e4ff', '#b5f5c8', '#ffb347', '#d4aaff']
  const count = 24

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'particle'

    const size  = 6 + Math.random() * 10
    const angle = Math.random() * 2 * Math.PI
    const dist  = 80 + Math.random() * 140

    el.style.cssText = `
      width:  ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${40 + Math.random() * 20}%;
      top:  ${30 + Math.random() * 30}%;
      --tx: ${(Math.cos(angle) * dist).toFixed(1)}px;
      --ty: ${(Math.sin(angle) * dist).toFixed(1)}px;
    `

    particles.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
}

// ===== 管理者ボタン =====
btnStamp.addEventListener('click', async () => {
  btnStamp.disabled = true
  try {
    const snap = await import('firebase/firestore').then(({ getDoc }) => getDoc(cardRef))
    const current = snap.exists() ? (snap.data().count ?? 0) : 0
    if (current < TOTAL) {
      await updateDoc(cardRef, { count: current + 1 })
    }
  } catch (e) {
    showError(`スタンプ失敗: ${e.message}`)
  } finally {
    // onSnapshot のコールバックで disabled を再設定するのでここでは戻さない
    btnStamp.disabled = false
  }
})

btnReset.addEventListener('click', async () => {
  if (!confirm('スタンプをリセットしますか？')) return
  try {
    await setDoc(cardRef, { count: 0 })
    modalShown = false
    modal.style.display = 'none'
  } catch (e) {
    showError(`リセット失敗: ${e.message}`)
  }
})

modalClose.addEventListener('click', () => {
  modal.style.display = 'none'
})

// ===== エラー表示 =====
function showError(msg) {
  const existing = document.querySelector('.error-banner')
  if (existing) existing.remove()

  const banner = document.createElement('div')
  banner.className = 'error-banner'
  banner.textContent = msg
  document.getElementById('app').prepend(banner)
}
