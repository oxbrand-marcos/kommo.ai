import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class KommoMessageDto {
  @IsString()
  text: string;

  @IsString()
  chat_id: string;

  @IsOptional()
  @IsString()
  element_id?: string;

  @IsOptional()
  @IsString()
  entity_id?: string;
}

class KommoMessageWrapperDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KommoMessageDto)
  add?: KommoMessageDto[];
}

export class KommoWebhookDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => KommoMessageWrapperDto)
  message?: KommoMessageWrapperDto;
}
