// Função serverless que converte texto em áudio (voz) usando a ElevenLabs.
// As chaves ficam guardadas como variáveis de ambiente na Vercel:
//   ELEVENLABS_API_KEY  -> sua chave de API da ElevenLabs
//   ELEVENLABS_VOICE_ID -> o Voice ID da voz escolhida (ex: a voz "Bia")

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID não configurada no servidor.' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Nenhum texto enviado.' });
  }

  // Limite de segurança para controlar custo por chamada
  const safeText = text.slice(0, 1500);

  try {
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: safeText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true
        }
      })
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('Erro da ElevenLabs:', errText);
      return res.status(elevenRes.status).json({ error: 'Erro ao gerar áudio.' });
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao gerar a fala.' });
  }
};
