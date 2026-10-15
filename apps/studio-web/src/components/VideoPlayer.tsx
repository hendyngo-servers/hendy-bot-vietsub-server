import type { RefObject } from 'react';
import { Clapperboard, FilePlus2 } from 'lucide-react';

export function VideoPlayer({
  src,
  videoRef,
  onChooseVideo,
  onVideoClick,
}: {
  src?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onChooseVideo: () => void;
  onVideoClick: () => void;
}) {
  if (!src) {
    return <div className="preview-placeholder">
      <div className="placeholder-logo"><Clapperboard size={32} /></div>
      <b>Hendy Video Studio <span>Pro</span></b>
      <p>Nhập video để xem trước trên canvas</p>
      <button onClick={onChooseVideo}><FilePlus2 size={15} /> Chọn video</button>
    </div>;
  }
  return <video ref={videoRef} className="video-preview" src={src} controls playsInline preload="metadata" crossOrigin="anonymous" onClick={onVideoClick} />;
}
