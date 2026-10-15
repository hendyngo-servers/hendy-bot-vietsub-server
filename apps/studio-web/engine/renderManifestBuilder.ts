import type { RenderManifest, SubtitleCue, TimelineTrack } from '@hendy/shared-types';
export function buildRenderManifest(input: { projectId: string; title: string; duration: number; tracks: TimelineTrack[]; subtitles: SubtitleCue[] }): RenderManifest {
  if (!input.tracks.some(track => track.kind === 'video' && track.clips.some(clip => clip.assetId))) throw new Error('Add an uploaded video clip before exporting.');
  return { projectId: input.projectId, title: input.title, width: 1920, height: 1080, fps: 30, tracks: input.tracks, subtitles: input.subtitles, export: { format: 'mp4', burnSubtitles: true, quality: 'standard' } };
}
