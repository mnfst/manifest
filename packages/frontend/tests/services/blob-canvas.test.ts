import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PIVOT_CANVAS_BG,
  PIVOT_CANVAS_PALETTE,
  cssColor,
  initBlobCanvas,
} from '../../src/services/blob-canvas';

type FakeCtx = ReturnType<typeof makeFakeCtx>;

function makeFakeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    fillStyle: '' as unknown,
    filter: '',
    globalCompositeOperation: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
    })),
    putImageData: vi.fn(),
    __gradient: gradient,
  };
}

describe('blob canvas', () => {
  let frames: FrameRequestCallback[];
  let cancelSpy: ReturnType<typeof vi.fn>;
  let rect = { width: 200, height: 60 };
  let ctxs: FakeCtx[];

  function stubContexts(value: 'fake' | 'null') {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      if (value === 'null') return null;
      const ctx = makeFakeCtx();
      ctxs.push(ctx);
      return ctx;
    }) as never);
  }

  function makeCanvas() {
    const parent = document.createElement('div');
    parent.getBoundingClientRect = () => rect as DOMRect;
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    document.body.appendChild(parent);
    return canvas;
  }

  beforeEach(() => {
    frames = [];
    ctxs = [];
    rect = { width: 200, height: 60 };
    let rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return ++rafId;
    });
    cancelSpy = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('exposes the color helpers', () => {
    expect(cssColor(PIVOT_CANVAS_BG)).toBe('rgba(41,94,255,1)');
    expect(cssColor(PIVOT_CANVAS_PALETTE[0], 0.5)).toBe('rgba(63,222,183,0.5)');
  });

  it('bails to a no-op cleanup when the 2d context is unavailable', () => {
    stubContexts('null');
    const stop = initBlobCanvas(makeCanvas());
    expect(() => stop()).not.toThrow();
    expect(frames).toHaveLength(0);
  });

  it('paints the ground, the blobs, and the grain overlay each frame', () => {
    stubContexts('fake');
    const canvas = makeCanvas();
    const stop = initBlobCanvas(canvas);
    const [ctx, gctx] = ctxs;

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(60);
    expect(gctx.putImageData).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 60);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(7);
    expect(ctx.__gradient.addColorStop).toHaveBeenCalledTimes(21);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);

    frames.shift()!(0);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    stop();
  });

  it('waits for a real size before painting, then stops after one frame under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
    }));
    rect = { width: 0, height: 0 };
    stubContexts('fake');
    initBlobCanvas(makeCanvas());
    const [ctx] = ctxs;
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    // The parent gains a size; the deferred frame paints once and stops.
    rect = { width: 100, height: 40 };
    window.dispatchEvent(new Event('resize'));
    frames.shift()!(0);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
  });

  it('uses ResizeObserver when available and disconnects it on cleanup', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    stubContexts('fake');
    const canvas = makeCanvas();
    const stop = initBlobCanvas(canvas);
    const [ctx] = ctxs;
    expect(observe).toHaveBeenCalledWith(canvas.parentElement);

    rect = { width: 300, height: 80 };
    callback();
    expect(canvas.width).toBe(300);

    stop();
    expect(disconnect).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    // A stopped animation paints nothing more.
    const pending = frames.shift();
    if (pending) {
      const calls = ctx.fillRect.mock.calls.length;
      pending(0);
      expect(ctx.fillRect.mock.calls.length).toBe(calls);
    }
  });

  it('ignores a resize when the canvas has no parent', () => {
    stubContexts('fake');
    const canvas = document.createElement('canvas');
    const stop = initBlobCanvas(canvas);
    expect(canvas.width).toBe(300);
    stop();
  });

  it('accepts custom colors', () => {
    stubContexts('fake');
    const stop = initBlobCanvas(makeCanvas(), { bgColor: [1, 2, 3], palette: [[4, 5, 6]] });
    const [ctx] = ctxs;
    expect(ctx.__gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(4,5,6,0.85)');
    stop();
  });
});
