import { describe, expect, it } from 'vitest';

import { parseEventStreamChunk } from '@/api/sse';

/**
 * The desktop shell's SSE fallback parses text/event-stream by hand over a
 * credentialed fetch stream (spec §5.3). These tests pin the wire format:
 * LF and CRLF servers, multi-line data, events split across reads, and
 * comments/fields that must be ignored.
 */
describe('parseEventStreamChunk', () => {
  it('extracts a complete LF event', () => {
    const { events, rest } = parseEventStreamChunk('data: {"kind":"frame"}\n\n');
    expect(events).toEqual(['{"kind":"frame"}']);
    expect(rest).toBe('');
  });

  it('extracts a complete CRLF event', () => {
    const { events, rest } = parseEventStreamChunk('data: hello\r\n\r\n');
    expect(events).toEqual(['hello']);
    expect(rest).toBe('');
  });

  it('keeps a partial frame in the buffer for the next read', () => {
    const { events, rest } = parseEventStreamChunk('data: {"kind":"ste');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"kind":"ste');
    const next = parseEventStreamChunk(`${rest}p"}\n\n`);
    expect(next.events).toEqual(['{"kind":"step"}']);
  });

  it('splits on a boundary that arrives split across reads', () => {
    const first = parseEventStreamChunk('data: one\ndata: two\n');
    expect(first.events).toEqual([]);
    const second = parseEventStreamChunk(`${first.rest}\n`);
    // Multi-line data joins with \n per the SSE spec.
    expect(second.events).toEqual(['one\ntwo']);
  });

  it('handles several events in one chunk, keeping the tail partial', () => {
    const { events, rest } = parseEventStreamChunk(
      'data: a\n\ndata: b\n\ndata: partial',
    );
    expect(events).toEqual(['a', 'b']);
    expect(rest).toBe('data: partial');
  });

  it('ignores comments and non-data fields', () => {
    const { events } = parseEventStreamChunk(
      ': keep-alive comment\n\nevent: frame\ndata: x\nid: 7\n\n',
    );
    expect(events).toEqual(['x']);
  });

  it('strips a single optional space after the colon', () => {
    const { events } = parseEventStreamChunk('data: spaced\ndata:plain\n\n');
    expect(events).toEqual(['spaced\nplain']);
  });

  it('tolerates an empty data field', () => {
    const { events } = parseEventStreamChunk('data:\n\n');
    expect(events).toEqual(['']);
  });

  it('never returns an infinite loop on degenerate input', () => {
    const { events, rest } = parseEventStreamChunk('\n\n\n\n');
    expect(events).toEqual([]);
    expect(rest).toBe('');
  });
});
