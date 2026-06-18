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
const KOMMO_FIELD_ID = process.env.KOMMO_FIELD_ID || '1002842';

//Trunca uma string de forma segura, garantindo que emojis não sejam cortados pela metade.
function safeTruncate(str, maxLength) {
  if (!str) return '';
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  return chars.slice(0, maxLength - 3).join('') + '...';
}

//Remove caracteres de controle invisíveis que costumam quebrar JSON em APIs estritas.
function sanitizeForJSON(str) {
  return str.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

app.post('/webhook', (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    const messages = body?.message?.add;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    const text = msg.text;
    const chatId = msg.chat_id;
    const leadId = msg.element_id || msg.entity_id;

    console.log(`[webhook] Recebido - Lead: ${leadId} | Texto: "${safeTruncate(text, 50)}"`);

    if (!text || !leadId) return;

    processMessage({ text, chatId, leadId }).catch((err) =>
      console.error('[processMessage] Erro crítico:', err.message, err.response?.data || '')
    );
  } catch (err) {
    console.error('[webhook] Erro no handler principal:', err.message);
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function processMessage({ text, chatId, leadId }) {
  addToHistory(chatId, { role: 'user', content: text });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: process.env.AI_SYSTEM_PROMPT || 'Você é um assistente de vendas prestativo. Responda de forma clara, amigável e profissional.',
    messages: getHistory(chatId),
  });

  let aiReply = response.content[0].text;
  
  // Aplica limpeza e filtro nos dados de entrada para garantir que o JSON não quebre.
  aiReply = sanitizeForJSON(aiReply);
  
  addToHistory(chatId, { role: 'assistant', content: aiReply });

  console.log(`[claude] Resposta gerada com ${Array.from(aiReply).length} caracteres.`);

  // Atualiza o campo no Kommo
  await updateLeadField(leadId, aiReply);

  // Dispara o bot
  await runSalesbot(leadId);
}

async function updateLeadField(leadId, value) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads/${leadId}`;

  // Você pode aumentar este limite de 256 para até 65000 em texto longo.
  // Varivável abaixo permite configurar o limite máximo de caracteres.
  const MAX_KOMMO_CHARS = process.env.MAX_KOMMO_CHARS ? parseInt(process.env.MAX_KOMMO_CHARS) : 1000;
  
  const finalValue = safeTruncate(value, MAX_KOMMO_CHARS);

  await axios.patch(
    url,
    {
      custom_fields_values: [
        {
          field_id: parseInt(KOMMO_FIELD_ID),
          values: [{ value: finalValue }],
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

  console.log(`[kommo] Campo ${KOMMO_FIELD_ID} atualizado no lead ${leadId} com sucesso.`);
}

async function runSalesbot(leadId) {
  const url = `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4/bots/${KOMMO_BOT_ID}/run`;

  await axios.post(
    url,
    { entity_id: parseInt(leadId), entity_type: 'leads' },
    {
      headers: {
        Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`[kommo] Salesbot ${KOMMO_BOT_ID} disparado.`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});