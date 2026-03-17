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
  hungry:   ['腹減ったわ〜！', 'めし食わせてくれへん？', 'もうアカン…腹ペコや', 'はよ食わせてや〜', 'ごはん…ごはん…'],
  normal:   ['やあやあ！', 'まあまあ元気やで〜', 'ひまやなあ', 'なんかせえへんか〜', 'おっさん暇やで！'],
  full:     ['うまかったわ〜！', '満腹や〜！', 'ありがとさん！', 'ええ気分やで〜💕'],
  fed:      ['ひまわりの種や〜！最高やで〜！！', 'これこれ！これが食べたかってん！', 'うまいうまい！やっぱ種は最高やな！', 'もっとくれてもええんやで〜？', 'やったー！種や！種！大好きやねん！'],
  stamped:  ['よっしゃ！🌸', 'ナイスやないか！', 'やるやんけ〜！'],
  sleepy:   ['zzz…', 'すやすや…', '💤'],
  woken:    ['うるさいわ！起こすなや！', 'もうちょい寝かせてや〜！', 'ねむい…ほっといてくれ…'],
  grumpy:   ['うるさいわ！', 'ほっといてくれ…', 'めんどくさいなあ', 'きっつい顔しとるで'],
  starving: ['…', 'うごけへん…', '☆０や…もうあかん'],
}

// ===== Firebase 初期化 =====
const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// ===== BGM =====
const bgm = document.getElementById('bgm')
let bgmStarted = false
function startBGM() {
  if (bgmStarted) return
  bgm.play().then(() => { bgmStarted = true }).catch(() => {})
}
document.addEventListener('click', startBGM, { once: true })
document.addEventListener('touchstart', startBGM, { once: true })

// ===== DOM 要素 =====
const adminPanel       = document.getElementById('adminPanel')
const pendingEl        = document.getElementById('pendingRequests')
const btnResetHome     = document.getElementById('btnResetHome')
const btnResetTogether = document.getElementById('btnResetTogether')
const btnAddCoins      = document.getElementById('btnAddCoins')
const btnResetCoins    = document.getElementById('btnResetCoins')
const modal            = document.getElementById('modal')
const modalText        = document.getElementById('modalText')
const modalClose       = document.getElementById('modalClose')
const particles        = document.getElementById('particles')
const submitArea       = document.getElementById('submitArea')
const btnSubmit        = document.getElementById('btnSubmit')
const coinsDisplay     = document.getElementById('coinsDisplay')
const shopCoinsDisplay = document.getElementById('shopCoinsDisplay')
const hungerStars      = document.getElementById('hungerStars')
const hungerCount      = document.getElementById('hungerCount')
const itemList         = document.getElementById('itemList')
const btnShop          = document.getElementById('btnShop')
const shopModal        = document.getElementById('shopModal')
const btnShopClose     = document.getElementById('btnShopClose')
const speechBubble     = document.getElementById('speechBubble')
const hamsterX         = document.getElementById('hamsterX')
const hamsterSprite    = document.getElementById('hamsterSprite')
const chatInput        = document.getElementById('chatInput')
const btnChatSend      = document.getElementById('btnChatSend')
const sleepOverlay     = document.getElementById('sleepOverlay')

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
const cardStates    = { home_card: [false, false, false], together_card: [false, false, false] }
let pendingRequests = {}
let hamsterData     = {
  coins: 0,
  hunger: 24,
  seedSmall: 0,
  seedMedium: 0,
  seedLarge: 0,
  lastHungerUpdate: null,
  sleeping: false,
  sleepUntil: null,
  nextSleepAt: null,
  grumpyUntil: null,
}

// ===== 睡眠タイミング乱数 =====
function randomSleepDelay()    { return (1 + Math.random() * 5) * 60 * 60 * 1000 }   // 1〜6時間後
function randomSleepDuration() { return (0.5 + Math.random() * 1.5) * 60 * 60 * 1000 } // 30〜120分

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
let periodicCheckScheduled = false

onSnapshot(hamsterRef, snap => {
  if (!snap.exists()) {
    const now = Date.now()
    setDoc(hamsterRef, {
      coins: 0,
      hunger: 10,
      seedSmall: 0,
      seedMedium: 0,
      seedLarge: 0,
      lastHungerUpdate: now,
      sleeping: false,
      sleepUntil: null,
      nextSleepAt: now + randomSleepDelay(),
      grumpyUntil: null,
    })
    return
  }

  const data = snap.data()
  // 旧データ（hunger > 24）の変換
  let hunger = data.hunger ?? 24
  if (hunger > 24) hunger = Math.min(24, Math.round(hunger / 4.17))

  hamsterData = {
    coins: 0,
    hunger: 24,
    seedSmall: 0,
    seedMedium: 0,
    seedLarge: 0,
    lastHungerUpdate: null,
    sleeping: false,
    sleepUntil: null,
    nextSleepAt: null,
    grumpyUntil: null,
    ...data,
    hunger,
  }

  renderHamsterStats()

  // スナップショット外で空腹・睡眠チェック（ループ防止）
  if (!periodicCheckScheduled) {
    periodicCheckScheduled = true
    setTimeout(() => {
      checkHungerDecrease()
      checkSleep()
      periodicCheckScheduled = false
    }, 0)
  }
}, err => showError(`ハムスターデータエラー: ${err.message}`))

// ===== 空腹度減少チェック（1時間ごとに☆1減） =====
function checkHungerDecrease() {
  const now = Date.now()
  if (!hamsterData.lastHungerUpdate) {
    updateDoc(hamsterRef, { lastHungerUpdate: now }).catch(() => {})
    return
  }
  const elapsed = now - hamsterData.lastHungerUpdate
  const hoursElapsed = Math.floor(elapsed / (60 * 60 * 1000))
  if (hoursElapsed > 0 && hamsterData.hunger > 0) {
    const newHunger = Math.max(0, hamsterData.hunger - hoursElapsed)
    const newLastUpdate = hamsterData.lastHungerUpdate + hoursElapsed * 60 * 60 * 1000
    updateDoc(hamsterRef, { hunger: newHunger, lastHungerUpdate: newLastUpdate }).catch(() => {})
  }
}

// ===== 睡眠チェック =====
function checkSleep() {
  const now = Date.now()
  if (hamsterData.sleeping) {
    if (hamsterData.sleepUntil && now > hamsterData.sleepUntil) {
      updateDoc(hamsterRef, {
        sleeping: false,
        sleepUntil: null,
        nextSleepAt: now + randomSleepDelay(),
      }).catch(() => {})
    }
  } else {
    if (!hamsterData.nextSleepAt) {
      updateDoc(hamsterRef, { nextSleepAt: now + randomSleepDelay() }).catch(() => {})
    } else if (now > hamsterData.nextSleepAt) {
      updateDoc(hamsterRef, {
        sleeping: true,
        sleepUntil: now + randomSleepDuration(),
        nextSleepAt: null,
      }).catch(() => {})
    }
  }
}

// ===== 定期チェック（1分ごと） =====
setInterval(() => {
  checkHungerDecrease()
  checkSleep()
}, 60 * 1000)

// ===== ハムスター画像選択 =====
function getHamsterImage() {
  if (hamsterData.sleeping) return '/hamster_bed.png'
  const h = hamsterData.hunger
  if (h === 0)  return '/hamster_kuufuku.png'
  if (h === 24) return '/hamster.gokigen.png'
  if (h >= 11)  return '/hamster.png'
  return '/hamster.hukigen.png'
}

// ===== ハムスターステータス描画 =====
function renderHamsterStats() {
  const { coins, hunger, seedSmall, seedMedium, seedLarge, sleeping } = hamsterData
  const h = Math.min(24, Math.max(0, hunger))

  coinsDisplay.textContent     = coins
  shopCoinsDisplay.textContent = coins
  hungerCount.textContent      = `${h}/24`

  // ☆星表示
  hungerStars.innerHTML = ''
  for (let i = 0; i < 24; i++) {
    const star = document.createElement('span')
    star.className = 'star-icon' + (i < h ? ' filled' : '')
    star.textContent = i < h ? '★' : '☆'
    hungerStars.appendChild(star)
  }

  // ハムスター画像
  hamsterSprite.src = getHamsterImage()

  // 睡眠オーバーレイ・アニメーション
  sleepOverlay.style.display = sleeping ? 'flex' : 'none'
  hamsterX.style.animationPlayState = sleeping ? 'paused' : 'running'

  // チャット無効（空腹☆0のみ不可、睡眠中は起こせる）
  const chatDisabled = h === 0
  chatInput.disabled = chatDisabled
  btnChatSend.disabled = chatDisabled
  if (h === 0) {
    chatInput.placeholder = '（ハムスターが動かない…）'
  } else if (sleeping) {
    chatInput.placeholder = '（タップで起こす）'
  } else {
    chatInput.placeholder = '話しかける…'
  }

  // ショップボタンの有効/無効
  document.querySelectorAll('.btn-buy-seed').forEach(btn => {
    btn.disabled = coins < parseInt(btn.dataset.price)
  })

  // アイテム欄
  renderItemBag(seedSmall, seedMedium, seedLarge)
}

// ===== アイテム欄 =====
function renderItemBag(seedSmall, seedMedium, seedLarge) {
  itemList.innerHTML = ''
  const items = [
    { key: 'seedSmall',  name: 'ひまわりの種（小）', recover: 8,  count: seedSmall,  emoji: '🌱' },
    { key: 'seedMedium', name: 'ひまわりの種（中）', recover: 15, count: seedMedium, emoji: '🌿' },
    { key: 'seedLarge',  name: 'ひまわりの種（大）', recover: 24, count: seedLarge,  emoji: '🌻' },
  ]
  let hasAny = false
  items.forEach(item => {
    if (item.count <= 0) return
    hasAny = true
    const div = document.createElement('div')
    div.className = 'item-row'
    const nameEl   = document.createElement('span')
    nameEl.className = 'item-name'
    nameEl.textContent = `${item.emoji} ${item.name}`
    const countEl  = document.createElement('span')
    countEl.className = 'item-count'
    countEl.textContent = `×${item.count}`
    const useBtn   = document.createElement('button')
    useBtn.className = 'btn-use-item'
    useBtn.textContent = 'あげる'
    useBtn.addEventListener('click', () => useItem(item.key, item.recover))
    div.appendChild(nameEl)
    div.appendChild(countEl)
    div.appendChild(useBtn)
    itemList.appendChild(div)
  })
  if (!hasAny) {
    itemList.innerHTML = '<p class="item-empty">アイテムなし</p>'
  }
}

// ===== アイテム使用 =====
async function useItem(key, recoverAmount) {
  if (hamsterData[key] <= 0) return
  if (hamsterData.hunger === 0) {
    showSpeech('starving')
    return
  }
  const newHunger = Math.min(24, hamsterData.hunger + recoverAmount)
  try {
    const update = { hunger: newHunger, lastHungerUpdate: Date.now() }
    update[key] = increment(-1)
    await updateDoc(hamsterRef, update)
    showSpeech('fed')
    spawnParticles()
  } catch (e) {
    showError(`エサ失敗: ${e.message}`)
  }
}

// ===== ショップ =====
btnShop.addEventListener('click', () => {
  shopModal.style.display = 'flex'
})
btnShopClose.addEventListener('click', () => {
  shopModal.style.display = 'none'
})
shopModal.addEventListener('click', e => {
  if (e.target === shopModal) shopModal.style.display = 'none'
})

document.querySelectorAll('.btn-buy-seed').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key   = btn.dataset.key
    const price = parseInt(btn.dataset.price)
    if (hamsterData.coins < price) return
    btn.disabled = true
    try {
      const update = { coins: increment(-price) }
      update[key] = increment(1)
      await updateDoc(hamsterRef, update)
    } catch (e) {
      showError(`購入失敗: ${e.message}`)
    } finally {
      btn.disabled = false
    }
  })
})

// ===== お試し用 1000コイン追加（管理者） =====
btnAddCoins.addEventListener('click', async () => {
  try {
    await updateDoc(hamsterRef, { coins: increment(1000) })
  } catch (e) {
    showError(`コイン追加失敗: ${e.message}`)
  }
})

// ===== コインを0にリセット（管理者） =====
btnResetCoins.addEventListener('click', async () => {
  if (!confirm('コインを0にリセットしますか？')) return
  try {
    await updateDoc(hamsterRef, { coins: 0 })
  } catch (e) {
    showError(`コインリセット失敗: ${e.message}`)
  }
})

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

// ===== 管理者: リクエスト一覧 =====
function renderPendingList() {
  const list = Object.values(pendingRequests)
  if (list.length === 0) {
    pendingEl.innerHTML = '<p class="no-requests">リクエストなし</p>'
    return
  }
  pendingEl.innerHTML = '<h3 class="pending-title">📬 スタンプのお願い</h3>'
  list.forEach(req => {
    const cardDef   = CARDS[req.cardId]
    const label     = cardDef?.stamps[req.stampIndex] ?? '?'
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
  const h   = hamsterData.hunger
  const now = Date.now()

  if (hamsterData.sleeping) { showSpeech('sleepy'); return }
  if (h === 0)              { showSpeech('starving'); return }
  if (hamsterData.grumpyUntil && now < hamsterData.grumpyUntil) { showSpeech('grumpy'); return }

  if (h === 24)     showSpeech('full')
  else if (h <= 10) showSpeech('hungry')
  else              showSpeech('normal')
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

  // 空腹☆0は会話不可
  if (hamsterData.hunger === 0) return

  // 寝てる時は起こす
  if (hamsterData.sleeping) {
    const grumpyDuration = 5 * 60 * 1000 // 5分間不機嫌
    await updateDoc(hamsterRef, {
      sleeping: false,
      sleepUntil: null,
      grumpyUntil: Date.now() + grumpyDuration,
      nextSleepAt: Date.now() + randomSleepDelay(),
    }).catch(() => {})
    chatInput.value = ''
    showSpeech('woken')
    return
  }

  btnChatSend.disabled = true
  chatInput.disabled   = true
  speechBubble.textContent = 'ちょっと待ちいや〜'
  speechBubble.classList.add('pop')
  setTimeout(() => speechBubble.classList.remove('pop'), 400)

  try {
    const { hunger, coins } = hamsterData
    const isGrumpy = !!(hamsterData.grumpyUntil && Date.now() < hamsterData.grumpyUntil)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, hunger, coins, isGrumpy }),
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
    chatInput.disabled   = false
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
