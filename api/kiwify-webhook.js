// Recebe as notificações da Kiwify quando alguém compra, renova, cancela
// ou tem reembolso/chargeback, e atualiza quem tem acesso liberado ao chat.
//
// Configure este webhook no painel da Kiwify (Apps -> Webhooks -> Criar webhook):
//   URL do Webhook: https://SEU-SITE.vercel.app/api/kiwify-webhook?token=SEU_SEGREDO
//   Eventos a marcar: compra_aprovada, subscription_renewed, compra_reembolsada,
//                      chargeback, subscription_canceled, subscription_late
//
// A variável de ambiente KIWIFY_WEBHOOK_SECRET na Vercel precisa ter o MESMO
// valor que você colocar em "SEU_SEGREDO" na URL acima.

const { redisCmd } = require('./_redis');

const APPROVE_EVENTS = new Set(['compra_aprovada', 'subscription_renewed']);
const REVOKE_EVENTS = new Set(['compra_reembolsada', 'chargeback', 'subscription_canceled', 'subscription_late']);

function extractEmail(body) {
  const candidates = [
    body?.Customer?.email,
    body?.customer?.email,
    body?.data?.Customer?.email,
    body?.data?.customer?.email,
    body?.data?.customer_email,
    body?.customer_email,
    body?.buyer?.email,
    body?.data?.buyer?.email
  ];
  const found = candidates.find((e) => typeof e === 'string' && e.includes('@'));
  return found ? found.toLowerCase().trim() : null;
}

function extractEventType(body) {
  return (
    body?.webhook_event_type ||
    body?.event ||
    body?.trigger ||
    body?.type ||
    body?.order_status ||
    ''
  ).toString().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const expectedSecret = process.env.KIWIFY_WEBHOOK_SECRET;
  const providedSecret = req.query?.token;

  if (!expectedSecret) {
    console.error('KIWIFY_WEBHOOK_SECRET não configurado no servidor.');
    return res.status(500).json({ error: 'Servidor não configurado.' });
  }
  if (providedSecret !== expectedSecret) {
    console.error('Webhook recebido com token inválido.');
    return res.status(401).json({ error: 'Token inválido.' });
  }

  const body = req.body || {};
  console.log('Webhook Kiwify recebido:', JSON.stringify(body).slice(0, 2000));

  const eventType = extractEventType(body);
  const email = extractEmail(body);

  if (!email) {
    console.error('Não encontrei e-mail no payload do webhook. Evento:', eventType);
    // Responde 200 mesmo assim para a Kiwify não ficar reenviando.
    return res.status(200).json({ received: true, warning: 'email não encontrado' });
  }

  try {
    if (APPROVE_EVENTS.has(eventType)) {
      await redisCmd(['SET', `paid:${email}`, '1']);
      console.log(`Acesso LIBERADO para ${email} (evento: ${eventType})`);
    } else if (REVOKE_EVENTS.has(eventType)) {
      await redisCmd(['DEL', `paid:${email}`]);
      console.log(`Acesso REVOGADO para ${email} (evento: ${eventType})`);
    } else {
      console.log(`Evento "${eventType}" recebido mas não mapeado, ignorando.`);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};
