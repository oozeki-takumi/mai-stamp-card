const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // AI チャットエンドポイント
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const { message, hunger, coins, isGrumpy } = await request.json()

        const h = Math.min(24, Math.max(0, hunger ?? 24))
        const hungerDesc = h === 24 ? '満腹で超ご機嫌'
          : h >= 11 ? `まあまあ元気（☆${h}/24）`
          : h >= 1  ? `腹ペコでイライラ（☆${h}/24）`
          : '空腹で動けない状態（☆0）'

        const systemPrompt = `あなたはまいちゃんのペットのハムスターで、名前は「だいふく」です。
関西弁をしゃべる気さくなおじさんの性格で、まいちゃんのことをかわいがっています。
ひまわりの種が大好きで、種をもらった話題が出ると特に嬉しそうにします。
「〜やで」「〜やん」「〜けど」「〜ねん」「〜やろ」などの関西弁で話します。
返答は短く1〜2文で、日本語で答えてください。

現在の状態:
- 満腹度: ☆${h}/24（${hungerDesc}）
- コイン: ${coins}枚
${isGrumpy ? '- 今は寝てるところを起こされて不機嫌な状態です。ぶっきらぼうに短く返事してください。' : ''}

満腹度が10以下の時は特に機嫌が悪く、餌（ひまわりの種）を要求するような返事をしてください。
満腹度が24の時は陽気に話してください。`

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 120,
            system: systemPrompt,
            messages: [{ role: 'user', content: message }],
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          throw new Error(`Anthropic ${response.status}: ${errBody.slice(0, 100)}`)
        }

        const data = await response.json()
        const reply = data.content?.[0]?.text ?? 'ちゅ…'

        return new Response(JSON.stringify({ reply }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      } catch (e) {
        return new Response(JSON.stringify({ reply: `エラー: ${e.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }
    }

    // 静的アセット
    return env.ASSETS.fetch(request)
  },
}
