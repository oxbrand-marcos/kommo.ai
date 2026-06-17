// history.js
// Armazena o histórico de conversa por conversation_id em memória.
// Para múltiplas instâncias do servidor, substitua pelo Redis.

const MAX_MESSAGES = 20; // máximo de mensagens mantidas por conversa

const conversations = new Map();

/**
 * Retorna o histórico de mensagens de uma conversa.
 * @param {string} conversationId
 * @returns {Array<{role: string, content: string}>}
 */
function getHistory(conversationId) {
  return conversations.get(conversationId) || [];
}

/**
 * Adiciona uma mensagem ao histórico da conversa.
 * @param {string} conversationId
 * @param {{ role: 'user' | 'assistant', content: string }} message
 */
function addToHistory(conversationId, message) {
  const history = conversations.get(conversationId) || [];
  history.push(message);

  // Mantém apenas as últimas MAX_MESSAGES mensagens
  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }

  conversations.set(conversationId, history);
}

/**
 * Limpa o histórico de uma conversa (útil para testes).
 * @param {string} conversationId
 */
function clearHistory(conversationId) {
  conversations.delete(conversationId);
}

module.exports = { getHistory, addToHistory, clearHistory };
