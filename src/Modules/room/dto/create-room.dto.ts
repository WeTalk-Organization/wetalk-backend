import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { LanguageCode } from '../enums/language-code.enum';
import { RoomLevel } from '../enums/room-level.enum';

export class CreateRoomDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  topics: string[];

  @IsEnum(LanguageCode, {
    message: `language must be one of: ${Object.values(LanguageCode).join(', ')}`,
  })
  language: LanguageCode;

  @IsNotEmpty()
  @IsEnum(RoomLevel, {
    message: `level must be one of: ${Object.values(RoomLevel).join(', ')}`,
  })
  level: RoomLevel;

  @IsInt()
  @Min(2)
  @Max(10)
  maxParticipants: number;
}
