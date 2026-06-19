import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { KommoWebhookDto } from '../auth/dto/kommo-webhook.dto';
import { KommoService } from './kommo.service';
import { ClaudeService } from '../claude/claude.service';
import { ConversationService } from '../conversation/conversation.service';
import { DocumentService } from '../document/document.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('kommo')
export class KommoController {
  private readonly logger = new Logger(KommoController.name);

  constructor(
    private readonly kommoService: KommoService,
    private readonly claudeService: ClaudeService,
    private readonly conversationService: ConversationService,
    private readonly documentService: DocumentService,
  ) {}

  @Post('webhook')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: KommoWebhookDto, @Req() req: any): Promise<{ received: true }> {
    const tenantId = req.tenantId;

    this.processWebhookAsync(body, tenantId).catch((err) => {
      this.logger.error(`Erro ao processar webhook: ${err.message}`, err.stack);
    });

    return { received: true };
  }

  private async processWebhookAsync(body: KommoWebhookDto, tenantId: string): Promise<void> {
    const messages = body.message?.add;
    if (!messages || messages.length === 0) {
      this.logger.warn('Webhook sem mensagens, ignorando.');
      return;
    }

    const msg = messages[0];
    const { text, chat_id: chatId } = msg;
    const leadId = msg.element_id ?? msg.entity_id;

    if (!text || !leadId) {
      this.logger.warn('Texto ou leadId ausente no payload, ignorando.');
      return;
    }

    this.logger.log(`Mensagem recebida | tenant=${tenantId} lead=${leadId} chat=${chatId}`);

    await this.conversationService.addMessage(chatId, leadId, { role: 'user', content: text });

    const history = await this.conversationService.getHistory(chatId);
    const context = await this.documentService.getContextForTenant(tenantId);
    const reply = await this.claudeService.generateReply(history, context ?? undefined);

    await this.conversationService.addMessage(chatId, leadId, {
      role: 'assistant',
      content: reply,
    });

    await this.kommoService.updateLeadField(leadId, reply);
    await this.kommoService.runSalesbot(leadId);

    this.logger.log(`Lead ${leadId} processado com sucesso (tenant=${tenantId}).`);
  }
}
