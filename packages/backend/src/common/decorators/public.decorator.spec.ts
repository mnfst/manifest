import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('exports IS_PUBLIC_KEY as isPublic', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('Public() returns a decorator function', () => {
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });
});
