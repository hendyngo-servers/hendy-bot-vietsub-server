import type { SubtitleCue } from '@hendy/shared-types';

/** Convert a time in seconds to an SRT timestamp, rounded to milliseconds. */
export function formatSrtTime(value: number): string {
  const safe = Math.max(0, Number.isFinite(value) ? value : 0);
  const totalMilliseconds = Math.round(safe * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/** Parse standard SubRip blocks and normalize cues into ascending time order. */
export function parseSrt(source: string): SubtitleCue[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trimEnd());
    const timeIndex = lines.findIndex(line => line.includes('-->'));
    if (timeIndex < 0) continue;
    const timing = lines[timeIndex].split('-->').map(value => value.trim());
    const start = parseSrtTimestamp(timing[0] ?? '');
    const end = parseSrtTimestamp(timing[1] ?? '');
    const text = lines.slice(timeIndex + 1).join('\n').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) {
      cues.push({ id: makeCueId(cues.length), start, end, text });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Parse WebVTT files, accepting both HH:MM:SS.mmm and MM:SS.mmm timestamps. */
export function parseVtt(source: string): SubtitleCue[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines[0]?.trim() === 'WEBVTT' || lines[0]?.startsWith('NOTE')) continue;
    const timeIndex = lines.findIndex(line => /-->/.test(line));
    if (timeIndex < 0) continue;
    const pair = lines[timeIndex].split('-->').map(part => part.trim().split(/\s+/)[0] ?? '');
    const start = parseVttTimestamp(pair[0] ?? '');
    const end = parseVttTimestamp(pair[1] ?? '');
    const text = lines.slice(timeIndex + 1).join('\n').replace(/<[^>]*>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) {
      cues.push({ id: makeCueId(cues.length), start, end, text });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseVttTimestamp(value: string): number {
  const normalized = value.replace(',', '.').trim();
  const match = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{1,3})$/.exec(normalized);
  if (!match) return Number.NaN;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = Number(`0.${match[4]}`);
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

/** Parse dialogue records from ASS/SSA files, stripping inline style overrides for editing. */
export function parseAss(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue;
    const parts = line.slice('Dialogue:'.length).trim().split(',');
    if (parts.length < 10) continue;
    const start = parseAssTimestamp(parts[1] ?? '');
    const end = parseAssTimestamp(parts[2] ?? '');
    const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) {
      cues.push({ id: makeCueId(cues.length), start, end, text });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'hendy-vietsub';
}

function parseSrtTimestamp(value: string): number {
  const normalized = value.replace(',', '.').trim();
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(normalized);
  if (!match) return Number.NaN;
  const fractional = match[4] ? Number(`0.${match[4]}`) : 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + fractional;
}

function parseAssTimestamp(value: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{1,2})$/.exec(value.trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`);
}

function makeCueId(index: number): string {
  const random = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${index}`;
  return `sub-import-${random}`;
}
