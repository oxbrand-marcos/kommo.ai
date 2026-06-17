// index.js
// Servidor Express que recebe webhooks do Kommo, chama o Claude e responde automaticamente.

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addToHistory } = require('./history');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Kommo envia form-encoded

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Webhook: recebe mensagens do Kommo
// ─────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Kommo envia: message[add][0][text], message[add][0][conversation_id], etc.
  const messages = body?.message?.add;

  if (!messages || messages.length === 0) {
    return res.sendStatus(200); // Não é um evento de mensagem, ignora
  }

  const msg = messages[0];
  const text = msg.text;
  const conversationId = msg.conversation_id;

  // Ignora mensagens sem texto ou sem conversa identificada
  if (!text || !conversationId) {
    return res.sendStatus(200);
  }

  // Responde ao Kommo imediatamente (evita timeout de webhook)
  res.sendStatus(200);

  // Processa de forma assíncrona
  processMessage({ text, conversationId }).catch((err) =>
    console.error('[processMessage] Erro:', err.message)
  );
});

// ─────────────────────────────────────────────
// Saúde do servidor
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─────────────────────────────────────────────
// Processa a mensagem: chama Claude e responde no Kommo
// ─────────────────────────────────────────────
async function processMessage({ text, conversationId }) {
  // 1. Adiciona a mensagem do cliente ao histórico
  addToHistory(conversationId, { role: 'user', content: text });

  // 2. Chama o Claude com o histórico completo
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system:
      process.env.AI_SYSTEM_PROMPT ||
      'Você é um assistente de vendas prestativo da empresa. Responda de forma clara, amigável e profissional. Seja conciso.',
    messages: getHistory(conversationId),
  });

  const aiReply = response.content[0].text;

  // 3. Adiciona a resposta da IA ao histórico
  addToHistory(conversationId, { role: 'assistant', content: aiReply });

  // 4. Envia a resposta de volta ao Kommo
  await sendKommoMessage(conversationId, aiReply);

  console.log(`[${conversationId}] ✓ Resposta enviada`);
}

// ─────────────────────────────────────────────
// Envia mensagem via API do Kommo
// Docs: https://developers.kommo.com/docs/chats
// ─────────────────────────────────────────────
async function sendKommoMessage(conversationId, text) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/chats/messages`;

  await axios.post(
    url,
    {
      conversation_id: conversationId,
      // ⚠️ Verifique na documentação do Kommo se o payload precisa de ajustes
      // dependendo do canal (WhatsApp, chat do site, etc.)
      message: {
        type: 'text',
        text,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─────────────────────────────────────────────
// Inicia o servidor
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: POST /webhook`);
});
