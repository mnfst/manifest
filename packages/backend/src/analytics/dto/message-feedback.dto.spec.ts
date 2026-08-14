import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MessageFeedbackDto } from './message-feedback.dto';

describe('MessageFeedbackDto', () => {
  it('accepts valid like rating', async () => {
    const dto = plainToInstance(MessageFeedbackDto, { rating: 'like' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid dislike rating with tags and details', async () => {
    const dto = plainToInstance(MessageFeedbackDto, {
      rating: 'dislike',
      tags: ['Too slow', 'Buggy'],
      details: 'Response was too slow',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing rating', async () => {
    const dto = plainToInstance(MessageFeedbackDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid rating value', async () => {
    const dto = plainToInstance(MessageFeedbackDto, { rating: 'neutral' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows omitting tags and details', async () => {
    const dto = plainToInstance(MessageFeedbackDto, { rating: 'dislike' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-array tags', async () => {
    const dto = plainToInstance(MessageFeedbackDto, { rating: 'dislike', tags: 'not-an-array' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-string tag values', async () => {
    const dto = plainToInstance(MessageFeedbackDto, { rating: 'dislike', tags: [123] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects details exceeding 2000 characters', async () => {
    const dto = plainToInstance(MessageFeedbackDto, {
      rating: 'dislike',
      details: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts details at exactly 2000 characters', async () => {
    const dto = plainToInstance(MessageFeedbackDto, {
      rating: 'dislike',
      details: 'x'.repeat(2000),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
