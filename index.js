require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addToHistory } = require('./history');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const KOMMO_BOT_ID = process.env.KOMMO_BOT_ID || '33550';
const KOMMO_FIELD_ID = process.env.KOMMO_FIELD_ID || '1085580';

app.post('/webhook', (req, res) => {
  res.sendStatus(200);

  try {
    console.log('[webhook] Body recebido:', JSON.stringify(req.body, null, 2));

    const body = req.body;
    const messages = body?.message?.add;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    const text = msg.text;
    const chatId = msg.chat_id;
    const leadId = msg.element_id || msg.entity_id;

    console.log(`[webhook] Mensagem: "${text}" | Lead: ${leadId}`);

    if (!text || !leadId) {
      console.log('[webhook] Texto ou leadId ausente, ignorando.');
      return;
    }

    processMessage({ text, chatId, leadId }).catch((err) =>
      console.error('[processMessage] Erro:', err.message, err.response?.data)
    );
  } catch (err) {
    console.error('[webhook] Erro no handler:', err.message);
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function processMessage({ text, chatId, leadId }) {
  // 1. Histórico por chatId
  addToHistory(chatId, { role: 'user', content: text });

  // 2. Chama o Claude
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system:
      process.env.AI_SYSTEM_PROMPT ||
      'Você é um assistente de vendas prestativo. Responda de forma clara, amigável e profissional.',
    messages: getHistory(chatId),
  });

  const aiReply = response.content[0].text;
  addToHistory(chatId, { role: 'assistant', content: aiReply });

  console.log(`[claude] Resposta: "${aiReply.substring(0, 80)}..."`);

  // 3. Salva a resposta no campo customizado do lead
  await updateLeadField(leadId, aiReply);

  // 4. Dispara o Salesbot para enviar a mensagem pelo WhatsApp
  await runSalesbot(leadId);

  console.log(`[lead:${leadId}] ✓ Campo atualizado e Salesbot disparado`);
}

async function updateLeadField(leadId, value) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads/${leadId}`;

  // Campo de texto do Kommo tem limite de 256 caracteres
  const truncated = value.length > 256 ? value.substring(0, 253) + '...' : value;

  await axios.patch(
    url,
    {
      custom_fields_values: [
        {
          field_id: parseInt(KOMMO_FIELD_ID),
          values: [{ value: truncated }],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`[kommo] Campo ${KOMMO_FIELD_ID} atualizado no lead ${leadId}`);
}

async function runSalesbot(leadId) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/bots/${KOMMO_BOT_ID}/run`;

  const response = await axios.post(
    url,
    { entity_id: parseInt(leadId), entity_type: 'leads' },
    {
      headers: {
        Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`[kommo] Salesbot ${KOMMO_BOT_ID} disparado:`, response.status);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: POST /webhook`);
});
