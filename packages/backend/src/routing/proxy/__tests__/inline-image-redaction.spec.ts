import { redactInlineImageDataUrls } from '../inline-image-redaction';

function imageUrlAt(
  body: { messages: Array<{ content: Array<{ image_url?: { url: string } }> }> },
  index: number,
): string {
  const part = body.messages[0]?.content[index];
  if (!part?.image_url) throw new Error(`Missing image_url at index ${index}`);
  return part.image_url.url;
}

describe('redactInlineImageDataUrls', () => {
  it('redacts base64 image data URLs while preserving non-inline image URLs', () => {
    const body = {
      model: 'auto',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see?' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,aGVsbG8=' },
            },
            {
              type: 'image_url',
              image_url: { url: 'https://example.test/image.png' },
            },
          ],
        },
      ],
    };

    const result = redactInlineImageDataUrls(body);

    expect(result).toEqual({
      model: 'auto',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see?' },
            {
              type: 'image_url',
              image_url: {
                url: '[inline image: image/png, 5 bytes, 8 base64 chars]',
              },
            },
            {
              type: 'image_url',
              image_url: { url: 'https://example.test/image.png' },
            },
          ],
        },
      ],
    });
    expect(imageUrlAt(body, 1)).toBe('data:image/png;base64,aGVsbG8=');
  });

  it('handles nested image data URLs outside chat-completions content', () => {
    const result = redactInlineImageDataUrls({
      input: [
        {
          content: [
            {
              type: 'input_image',
              image_url: 'data:image/jpeg;base64,AA==',
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      input: [
        {
          content: [
            {
              type: 'input_image',
              image_url: '[inline image: image/jpeg, 1 bytes, 4 base64 chars]',
            },
          ],
        },
      ],
    });
  });

  it('redacts image data URLs with media-type parameters', () => {
    const result = redactInlineImageDataUrls({
      image_url: 'data:image/png;name=example.png;charset=utf-8;base64,aGVsbG8=',
    });

    expect(result).toEqual({
      image_url: '[inline image: image/png, 5 bytes, 8 base64 chars]',
    });
  });

  it('redacts image data URLs without base64 padding', () => {
    const result = redactInlineImageDataUrls({
      image_url: 'data:image/webp;base64,QUJD',
    });

    expect(result).toEqual({
      image_url: '[inline image: image/webp, 3 bytes, 4 base64 chars]',
    });
  });

  it('returns primitive values unchanged', () => {
    expect(redactInlineImageDataUrls(null)).toBeNull();
    expect(redactInlineImageDataUrls(42)).toBe(42);
  });

  it('reuses the original object when no inline image data is present', () => {
    const body = {
      messages: [{ role: 'user', content: 'plain text only' }],
    };

    expect(redactInlineImageDataUrls(body)).toBe(body);
  });
});
