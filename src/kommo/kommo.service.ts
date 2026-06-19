import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class KommoService {
  private readonly logger = new Logger(KommoService.name);
  private readonly subdomain: string;
  private readonly accessToken: string;
  private readonly botId: string;
  private readonly fieldId: string;

  constructor(private readonly config: ConfigService) {
    this.subdomain = this.config.get<string>('KOMMO_SUBDOMAIN')!;
    this.accessToken = this.config.get<string>('KOMMO_ACCESS_TOKEN')!;
    this.botId = this.config.get<string>('KOMMO_BOT_ID')!;
    this.fieldId = this.config.get<string>('KOMMO_FIELD_ID')!;
  }

  private get baseUrl() {
    return `https://${this.subdomain}.kommo.com/api/v4`;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async updateLeadField(leadId: string, value: string): Promise<void> {
    const MAX_FIELD_LENGTH = 5000;
    const truncated =
      value.length > MAX_FIELD_LENGTH
        ? `${value.substring(0, MAX_FIELD_LENGTH - 3)}...`
        : value;

    await axios.patch(
      `${this.baseUrl}/leads/${leadId}`,
      {
        custom_fields_values: [
          {
            field_id: parseInt(this.fieldId, 10),
            values: [{ value: truncated }],
          },
        ],
      },
      { headers: this.headers },
    );

    this.logger.log(`Campo ${this.fieldId} atualizado no lead ${leadId}`);
  }

  async runSalesbot(leadId: string): Promise<void> {
    const response = await axios.post(
      `${this.baseUrl}/bots/${this.botId}/run`,
      { entity_id: parseInt(leadId, 10), entity_type: 'leads' },
      { headers: this.headers },
    );

    this.logger.log(
      `Salesbot ${this.botId} disparado para lead ${leadId} (status ${response.status})`,
    );
  }
}
