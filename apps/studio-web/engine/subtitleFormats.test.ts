import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSrtTime, parseAss, parseSrt, parseVtt, safeFilename } from './subtitleFormats';

describe('subtitle format helpers', () => {
  it('parses SRT entries, preserves multiple lines, and sorts by start time', () => {
    const cues = parseSrt('2\n00:00:04,500 --> 00:00:06,000\nSecond line\n\n1\n00:00:00,000 --> 00:00:02,250\nFirst line\ncontinued');
    assert.equal(cues.length, 2);
    assert.equal(cues[0].start, 0);
    assert.equal(cues[0].text, 'First line\ncontinued');
    assert.equal(cues[1].start, 4.5);
  });

  it('ignores malformed and zero-length SRT cues', () => {
    assert.deepEqual(parseSrt('1\nnot-a-time --> 00:00:01,000\nInvalid\n\n2\n00:00:02,000 --> 00:00:02,000\nEmpty'), []);
  });

  it('parses ASS Dialogue lines and removes inline overrides', () => {
    const cues = parseAss('[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.20,0:00:02.50,Default,,0,0,0,,{\\i1}Xin chào\\NViệt Nam');
    assert.equal(cues.length, 1);
    assert.equal(cues[0].start, 1.2);
    assert.equal(cues[0].text, 'Xin chào\nViệt Nam');
  });

  it('parses WebVTT cues with optional ids and cue settings', () => {
    const cues = parseVtt('WEBVTT\n\nintro\n00:01.000 --> 00:02.250 align:start\nHello\nworld\n\n00:00:03.000 --> 00:00:04.000\nXin chào');
    assert.equal(cues.length, 2);
    assert.equal(cues[0].start, 1);
    assert.equal(cues[0].end, 2.25);
    assert.equal(cues[0].text, 'Hello\nworld');
    assert.equal(cues[1].start, 3);
  });

  it('formats timestamp milliseconds and safe output filenames', () => {
    assert.equal(formatSrtTime(65.4328), '00:01:05,433');
    assert.equal(safeFilename('Tập 03 / Vietsub!'), 'T-p-03-Vietsub');
  });
});
