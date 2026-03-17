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
        const { message, hunger, level, coins } = await request.json()

        const hungerDesc = hunger < 30 ? '腹ペコでしんどい' : hunger > 70 ? '腹いっぱいで絶好調' : 'まあまあ元気'

        const systemPrompt = `あなたはまいちゃんのペットのハムスターです。
関西弁をしゃべる気さくなおじさんの性格で、まいちゃんのことをかわいがっています。
「〜やで」「〜やん」「〜けど」「〜ねん」「〜やろ」などの関西弁で話します。
返答は短く1〜2文で、日本語で答えてください。

現在の状態:
- 空腹度: ${hunger}%（${hungerDesc}）
- レベル: ${level}
- コイン: ${coins}枚

空腹度が低い時はぼやきながら、高い時は陽気に話してください。`

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
          throw new Error(`Anthropic API error: ${response.status}`)
        }

        const data = await response.json()
        const reply = data.content?.[0]?.text ?? 'ちゅ…'

        return new Response(JSON.stringify({ reply }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      } catch (e) {
        return new Response(JSON.stringify({ reply: 'ちゅ…（うまく話せなかった）' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }
    }

    // 静的アセット
    return env.ASSETS.fetch(request)
  },
}
