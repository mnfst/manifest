import { describe, it, expect } from 'vitest';
import { toggleScrollFade } from '../../src/services/scroll-fade';

function makeBody(opts: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
  const parent = document.createElement('div');
  const body = document.createElement('div');
  parent.appendChild(body);
  Object.defineProperty(body, 'scrollHeight', { value: opts.scrollHeight });
  Object.defineProperty(body, 'clientHeight', { value: opts.clientHeight });
  body.scrollTop = opts.scrollTop;
  return { parent, body };
}

describe('toggleScrollFade', () => {
  it('adds the at-bottom class when scrolled to the end', () => {
    const { parent, body } = makeBody({ scrollHeight: 500, scrollTop: 300, clientHeight: 200 });
    toggleScrollFade({ currentTarget: body });
    expect(parent.classList.contains('scroll-panel--at-bottom')).toBe(true);
  });

  it('removes the at-bottom class when scrolled away from the end', () => {
    const { parent, body } = makeBody({ scrollHeight: 500, scrollTop: 0, clientHeight: 200 });
    parent.classList.add('scroll-panel--at-bottom');
    toggleScrollFade({ currentTarget: body });
    expect(parent.classList.contains('scroll-panel--at-bottom')).toBe(false);
  });

  it('tolerates a detached element with no parent', () => {
    const body = document.createElement('div');
    expect(() => toggleScrollFade({ currentTarget: body })).not.toThrow();
  });
});
