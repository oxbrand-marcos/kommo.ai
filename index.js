require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addToHistory } = require('./history');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/webhook', (req, res) => {
  // Responde imediatamente — evita timeout e 502
  res.sendStatus(200);

  try {
    // Log do payload completo para debug
    console.log('[webhook] Body recebido:', JSON.stringify(req.body, null, 2));

    const body = req.body;
    const messages = body?.message?.add;

    if (!messages || messages.length === 0) {
      console.log('[webhook] Sem mensagens no payload, ignorando.');
      return;
    }

    const msg = messages[0];
    const text = msg.text;
    const conversationId = msg.conversation_id;

    console.log(`[webhook] Mensagem: "${text}" | Conversa: ${conversationId}`);

    if (!text || !conversationId) {
      console.log('[webhook] Texto ou conversation_id ausente, ignorando.');
      return;
    }

    processMessage({ text, conversationId }).catch((err) =>
      console.error('[processMessage] Erro:', err.message)
    );
  } catch (err) {
    console.error('[webhook] Erro no handler:', err.message);
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function processMessage({ text, conversationId }) {
  addToHistory(conversationId, { role: 'user', content: text });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system:
      process.env.AI_SYSTEM_PROMPT ||
      'Você é um assistente de vendas prestativo. Responda de forma clara, amigável e profissional.',
    messages: getHistory(conversationId),
  });

  const aiReply = response.content[0].text;
  addToHistory(conversationId, { role: 'assistant', content: aiReply });

  console.log(`[${conversationId}] Resposta da IA: "${aiReply}"`);

  await sendKommoMessage(conversationId, aiReply);
  console.log(`[${conversationId}] ✓ Enviado ao Kommo`);
}

async function sendKommoMessage(conversationId, text) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/chats/messages`;

  const response = await axios.post(
    url,
    { conversation_id: conversationId, message: { type: 'text', text } },
    {
      headers: {
        Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('[kommo] Resposta da API:', response.status, JSON.stringify(response.data));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: POST /webhook`);
});
