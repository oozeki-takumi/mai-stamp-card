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
  increment,
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

// ===== ハムスターセリフ =====
const SPEECH = {
  hungry:  ['腹減ったわ〜！', 'めし食わせてくれへん？', 'もうアカン…腹ペコや', 'はよ食わせてや〜'],
  normal:  ['やあやあ！', 'まあまあ元気やで〜', 'ひまやなあ', 'なんかせえへんか〜', 'おっさん暇やで！'],
  full:    ['うまかったわ〜！', '満腹や〜！', 'ありがとさん！', 'ええ気分やで〜💕'],
  stamped: ['よっしゃ！🌸', 'ナイスやないか！', 'やるやんけ〜！'],
}

// ===== Firebase 初期化 =====
const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// ===== DOM 要素 =====
const adminPanel      = document.getElementById('adminPanel')
const pendingEl       = document.getElementById('pendingRequests')
const btnResetHome    = document.getElementById('btnResetHome')
const btnResetTogether= document.getElementById('btnResetTogether')
const modal           = document.getElementById('modal')
const modalText       = document.getElementById('modalText')
const modalClose      = document.getElementById('modalClose')
const particles       = document.getElementById('particles')
const submitArea      = document.getElementById('submitArea')
const btnSubmit       = document.getElementById('btnSubmit')
const coinsDisplay    = document.getElementById('coinsDisplay')
const levelDisplay    = document.getElementById('levelDisplay')
const feedDisplay     = document.getElementById('feedDisplay')
const hungerFill      = document.getElementById('hungerFill')
const hungerPct       = document.getElementById('hungerPct')
const btnBuyFeed      = document.getElementById('btnBuyFeed')
const btnGiveFeed     = document.getElementById('btnGiveFeed')
const speechBubble    = document.getElementById('speechBubble')
const hamsterX        = document.getElementById('hamsterX')
const hamsterSprite   = document.getElementById('hamsterSprite')
const chatInput       = document.getElementById('chatInput')
const btnChatSend     = document.getElementById('btnChatSend')

// ===== タブ切り替え =====
let activeCardId = 'home_card'
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    activeCardId = btn.dataset.card
    document.getElementById('homeStamps').classList.toggle('hidden', activeCardId !== 'home_card')
    document.getElementById('togetherStamps').classList.toggle('hidden', activeCardId !== 'together_card')
    updateSubmitButton()
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
const cardStates     = { home_card: [false, false, false], together_card: [false, false, false] }
let pendingRequests  = {}
let hamsterData      = { coins: 0, exp: 0, hunger: 50, feed: 0 }

// ===== 提出ボタン表示制御 =====
function updateSubmitButton() {
  if (isAdmin) return
  const allDone = cardStates[activeCardId].every(s => s)
  submitArea.classList.toggle('hidden', !allDone)
}

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

  updateSubmitButton()
}

// ===== Firestore 監視: カードデータ =====
Object.keys(CARDS).forEach(cardId => {
  const ref = doc(db, 'stampCards', cardId)
  onSnapshot(ref, snap => {
    if (!snap.exists()) {
      setDoc(ref, { stamps: [false, false, false] })
      return
    }
    cardStates[cardId] = snap.data().stamps ?? [false, false, false]
    renderCard(cardId)
  }, err => showError(`Firebase 接続エラー: ${err.message}`))
})

// ===== Firestore 監視: リクエスト =====
let isFirstLoad = true
onSnapshot(collection(db, 'stampRequests'), snap => {
  if (!isFirstLoad && isAdmin) {
    const added = snap.docChanges().filter(c => c.type === 'added').length
    if (added > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('まいちゃんからスタンプのお願いが届きました！', { body: 'スタンプカードを確認してください 🌸' })
    }
  }
  isFirstLoad = false
  pendingRequests = {}
  snap.forEach(d => { pendingRequests[d.id] = { ...d.data(), id: d.id } })
  Object.keys(CARDS).forEach(cardId => renderCard(cardId))
  if (isAdmin) renderPendingList()
}, err => showError(`リクエスト監視エラー: ${err.message}`))

// ===== Firestore 監視: ハムスターデータ =====
const hamsterRef = doc(db, 'hamster', 'data')
onSnapshot(hamsterRef, snap => {
  if (!snap.exists()) {
    setDoc(hamsterRef, { coins: 0, exp: 0, hunger: 50, feed: 0 })
    return
  }
  hamsterData = { coins: 0, exp: 0, hunger: 50, feed: 0, ...snap.data() }
  renderHamsterStats()
}, err => showError(`ハムスターデータエラー: ${err.message}`))

// ===== ハムスターステータス描画 =====
function renderHamsterStats() {
  const { coins, exp, hunger, feed } = hamsterData
  const level = Math.floor(exp / 100) + 1
  const h = Math.min(100, Math.max(0, hunger))

  coinsDisplay.textContent = coins
  levelDisplay.textContent = level
  feedDisplay.textContent  = feed
  hungerFill.style.width   = h + '%'
  hungerPct.textContent    = h + '%'

  // 空腹度で色変化
  hungerFill.style.background = h < 30 ? '#ff6b6b' : h > 70 ? '#4caf50' : '#ffb347'

  btnBuyFeed.disabled  = coins < 100
  btnGiveFeed.disabled = feed <= 0
}

// ===== 提出ボタン =====
btnSubmit.addEventListener('click', async () => {
  btnSubmit.disabled = true
  try {
    await setDoc(doc(db, 'stampCards', activeCardId), { stamps: [false, false, false] })
    await updateDoc(hamsterRef, { coins: increment(1000) })
    modalText.innerHTML = `🌸 ${CARDS[activeCardId].title}<br>コンプリート！<br><span style="font-size:1.4rem">💰 1000コインゲット！</span>`
    modal.style.display = 'flex'
    spawnParticles()
    showSpeech('stamped')
  } catch (e) {
    showError(`提出失敗: ${e.message}`)
  } finally {
    btnSubmit.disabled = false
  }
})

// ===== 餌を買う =====
btnBuyFeed.addEventListener('click', async () => {
  if (hamsterData.coins < 100) return
  btnBuyFeed.disabled = true
  try {
    await updateDoc(hamsterRef, { coins: increment(-100), feed: increment(1) })
  } catch (e) {
    showError(`購入失敗: ${e.message}`)
  } finally {
    btnBuyFeed.disabled = false
  }
})

// ===== 餌をあげる =====
btnGiveFeed.addEventListener('click', async () => {
  if (hamsterData.feed <= 0) return
  btnGiveFeed.disabled = true
  const newHunger = Math.min(100, hamsterData.hunger + 20)
  try {
    await updateDoc(hamsterRef, {
      feed:   increment(-1),
      exp:    increment(20),
      hunger: newHunger,
    })
    showSpeech('full')
    spawnParticles()
  } catch (e) {
    showError(`エサ失敗: ${e.message}`)
  } finally {
    btnGiveFeed.disabled = false
  }
})

// ===== 管理者: リクエスト一覧 =====
function renderPendingList() {
  const list = Object.values(pendingRequests)
  if (list.length === 0) {
    pendingEl.innerHTML = '<p class="no-requests">リクエストなし</p>'
    return
  }
  pendingEl.innerHTML = '<h3 class="pending-title">📬 スタンプのお願い</h3>'
  list.forEach(req => {
    const cardDef  = CARDS[req.cardId]
    const label    = cardDef?.stamps[req.stampIndex] ?? '?'
    const cardTitle= cardDef?.title ?? req.cardId
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

async function requestStamp(cardId, stampIndex) {
  try {
    await addDoc(collection(db, 'stampRequests'), { cardId, stampIndex, requestedAt: serverTimestamp() })
  } catch (e) {
    showError(`リクエスト失敗: ${e.message}`)
  }
}

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

// ===== リセット =====
btnResetHome.addEventListener('click', async () => {
  if (!confirm('おうちスタンプをリセットしますか？')) return
  await setDoc(doc(db, 'stampCards', 'home_card'), { stamps: [false, false, false] })
})
btnResetTogether.addEventListener('click', async () => {
  if (!confirm('一緒スタンプをリセットしますか？')) return
  await setDoc(doc(db, 'stampCards', 'together_card'), { stamps: [false, false, false] })
})
modalClose.addEventListener('click', () => { modal.style.display = 'none' })

// ===== ハムスター移動アニメーション =====
let facingRight = true
hamsterX.addEventListener('animationiteration', () => {
  facingRight = !facingRight
  hamsterSprite.style.transform = facingRight ? 'scaleX(1)' : 'scaleX(-1)'
})

// ===== セリフ表示 =====
function showSpeech(mood) {
  const list = SPEECH[mood] ?? SPEECH.normal
  speechBubble.textContent = list[Math.floor(Math.random() * list.length)]
  speechBubble.classList.add('pop')
  setTimeout(() => speechBubble.classList.remove('pop'), 400)
}

function autoSpeech() {
  const h = hamsterData.hunger
  const mood = h < 30 ? 'hungry' : h > 70 ? 'full' : 'normal'
  showSpeech(mood)
}
autoSpeech()
setInterval(autoSpeech, 7000)

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

// ===== ハムスターAIチャット =====
async function sendChatMessage() {
  const message = chatInput.value.trim()
  if (!message) return

  btnChatSend.disabled = true
  chatInput.disabled = true

  // 考え中セリフ
  speechBubble.textContent = 'ちょっと待ちいや〜'
  speechBubble.classList.add('pop')
  setTimeout(() => speechBubble.classList.remove('pop'), 400)

  try {
    const { hunger, exp, coins } = hamsterData
    const level = Math.floor(exp / 100) + 1
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, hunger, level, coins }),
    })
    const data = await res.json()
    speechBubble.textContent = data.reply
    speechBubble.classList.add('pop')
    setTimeout(() => speechBubble.classList.remove('pop'), 400)
    chatInput.value = ''
  } catch (e) {
    speechBubble.textContent = 'うまいこと話せんかったわ…'
  } finally {
    btnChatSend.disabled = false
    chatInput.disabled = false
    chatInput.focus()
  }
}

btnChatSend.addEventListener('click', sendChatMessage)
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChatMessage()
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
