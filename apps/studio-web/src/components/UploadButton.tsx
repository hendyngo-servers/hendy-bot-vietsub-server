import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/studioReduxStore';
import { togglePlayPause, setCurrentTime } from '../state/studioSlice';

// Import các Component
import { VideoPreviewZone } from './VideoPreviewZone';
import { TimelineWorkspace } from './TimelineWorkspace';
import { UploadButton } from './UploadButton'; // <-- 1. Import Nút Upload

export const StudioWorkspace: React.FC = () => {
  const dispatch = useDispatch();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { isPlaying, currentTime, totalDuration, cues, activeCueId, videoSrc } = useSelector(
    (state: RootState) => state.studio
  );

  const activeCue = cues.find(c => c.id === activeCueId) || null;

  // ... (giữ nguyên các hàm handleSeek, handleTimeUpdate, useEffect như cũ) ...

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      
      {/* THANH TOP BAR / MENU */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
         <div className="text-white font-bold tracking-wider">HENDY STUDIO PRO</div>
         
         {/* 2. Đặt Component Nút Upload ở đây */}
         <UploadButton />
      </div>

      {videoSrc && (
        <video 
          ref={videoRef} 
          src={videoSrc} 
          onTimeUpdate={handleTimeUpdate} 
          onEnded={() => dispatch(togglePlayPause())}
          className="hidden" 
        />
      )}

      {/* KHU VỰC PREVIEW VIDEO (Giữa màn hình) */}
      <div className="flex-1 p-4 flex justify-center items-center">
        <div className="w-full max-w-5xl">
          <VideoPreviewZone 
            currentTime={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            activeCue={activeCue}
            onPlayPause={() => dispatch(togglePlayPause())}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* KHU VỰC TIMELINE (Dưới cùng) */}
      <TimelineWorkspace 
        currentTime={currentTime}
        totalDuration={totalDuration}
        cues={cues}
        activeCueId={activeCueId}
        onSeek={handleSeek}
        onSelectCue={(id, start) => handleSeek(start)}
      />
    </div>
  );
};
