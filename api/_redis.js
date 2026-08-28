// Helper compartilhado para falar com o Redis (Upstash), usado para controlar
// o teste grátis de 3 minutos e quem já pagou a assinatura.
// Configurado automaticamente quando você adiciona "Upstash for Redis" em
// Vercel -> seu projeto -> Storage -> Create Database.

async function redisCmd(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Redis não configurado (faltam as variáveis de ambiente do Upstash).');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  const data = await res.json();
  if (data.error) {
    throw new Error('Erro do Redis: ' + data.error);
  }
  return data.result;
}

module.exports = { redisCmd };
