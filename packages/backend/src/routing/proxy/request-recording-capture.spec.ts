import { createRequestRecordingCapture } from './request-recording-capture';

describe('request recording capture', () => {
  it('captures the client-facing SSE stream', () => {
    const requestBody = { messages: [{ role: 'user', content: 'hello' }] };
    const capture = createRequestRecordingCapture(requestBody);
    capture.appendRaw('data: {"delta":"hi"}\n\n');
    capture.appendRaw('data: [DONE]\n\n');

    expect(capture.buildResponseBody()).toEqual({
      type: 'stream',
      raw_sse: 'data: {"delta":"hi"}\n\ndata: [DONE]\n\n',
    });
    expect(capture.buildRecording()).toEqual({
      version: 1,
      request_body: requestBody,
      response_body: {
        type: 'stream',
        raw_sse: 'data: {"delta":"hi"}\n\ndata: [DONE]\n\n',
      },
    });
  });

  it('captures a JSON response as one value', () => {
    const capture = createRequestRecordingCapture();
    capture.setJson({ choices: [{ message: { role: 'assistant', content: 'hello' } }] });

    expect(capture.buildResponseBody()).toEqual({
      type: 'json',
      body: { choices: [{ message: { role: 'assistant', content: 'hello' } }] },
    });
  });

  it('returns no response before anything is captured', () => {
    expect(createRequestRecordingCapture().buildResponseBody()).toBeNull();
    expect(createRequestRecordingCapture().buildRecording()).toBeNull();
  });
});
