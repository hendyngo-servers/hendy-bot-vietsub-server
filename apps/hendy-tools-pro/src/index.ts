export const hendyToolsVersion = '0.1.0';
export function inspectMediaName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const kind = ['mp4','mov','mkv','webm'].includes(extension) ? 'video' : ['mp3','wav','aac','m4a'].includes(extension) ? 'audio' : ['srt','ass','vtt'].includes(extension) ? 'subtitle' : 'unknown';
  return { fileName, extension, kind };
}
if (process.argv[1]?.endsWith('index.ts')) console.log(`Hendy Tools Pro ${hendyToolsVersion} · use as a library or wire CLI commands here.`);
