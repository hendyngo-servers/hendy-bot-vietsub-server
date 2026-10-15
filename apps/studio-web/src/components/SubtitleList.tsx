import type { SubtitleCue } from '@hendy/shared-types';

export function SubtitleList({
  cues,
  activeCueId,
  onSelect,
  formatTime,
}: {
  cues: SubtitleCue[];
  activeCueId: string;
  onSelect: (cue: SubtitleCue) => void;
  formatTime: (seconds: number) => string;
}) {
  if (!cues.length) return <div className="empty-assets">Chưa có phụ đề. Hãy thêm một cue mới.</div>;
  return <div className="cue-list">{cues.map(cue => (
    <button key={cue.id} className={`cue-row ${activeCueId === cue.id ? 'cue-active' : ''}`} onClick={() => onSelect(cue)}>
      <span className="cue-time">{formatTime(cue.start)}</span><span>{cue.text}</span>
    </button>
  ))}</div>;
}
