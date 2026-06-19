import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly basePrompt: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('ANTHROPIC_MODEL')!;
    this.basePrompt = this.config.get<string>('AI_SYSTEM_PROMPT')!;
  }

  async generateReply(history: ChatMessage[], contextDocument?: string): Promise<string> {
    const systemPrompt = contextDocument
      ? `${this.basePrompt}\n\nDADOS DE PRODUTOS E PREÇOS (use para responder perguntas):\n\`\`\`\n${contextDocument}\n\`\`\``
      : this.basePrompt;

    const start = Date.now();

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    });

    const latency = Date.now() - start;
    const block = response.content[0];
    const reply = block.type === 'text' ? block.text : '';

    this.logger.log(
      `Resposta gerada em ${latency}ms | in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
    );

    return reply;
  }
}
