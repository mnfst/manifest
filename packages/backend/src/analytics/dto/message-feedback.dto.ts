import { IsIn, IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

export const FEEDBACK_RATINGS = ['like', 'dislike'] as const;

export const FEEDBACK_TAGS = [
  'Not expected tier',
  'Poor answer quality',
  'Too slow',
  'Buggy',
  'Other',
] as const;

export class MessageFeedbackDto {
  @IsIn(FEEDBACK_RATINGS)
  rating!: 'like' | 'dislike';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
