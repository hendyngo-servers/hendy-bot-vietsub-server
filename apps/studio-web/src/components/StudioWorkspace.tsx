import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../state/studioReduxStore'; // Import từ store của bạn
import { togglePlayPause, setCurrentTime, setVideoSrc } from '../state/studioSlice';
import { VideoPreviewZone } from './VideoPreviewZone';
import { TimelineWorkspace } from './TimelineWorkspace';

export const StudioWorkspace: React.FC = () => {
  const dispatch = useDispatch();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Lấy dữ liệu từ Redux
  const { isPlaying, currentTime, totalDuration, cues, activeCueId, videoSrc } = useSelector(
    (state: RootState) => state.studio
  );

  // Lấy phụ đề đang active để truyền vào VideoPlayer hiển thị
  const activeCue = cues.find(c => c.id === activeCueId) || null;

  // Đồng bộ nút Play/Pause với thẻ <video> ẩn/hiện thực tế
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Hàm xử lý khi người dùng tua (Seek) trên UI
  const handleSeek = (time: number) => {
    dispatch(setCurrentTime(time));
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Lắng nghe sự kiện thẻ <video> đang chạy để update Timeline Redux
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      dispatch(setCurrentTime(videoRef.current.currentTime));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Thẻ video thực tế (có thể ẩn đi `hidden` nếu bạn dùng Canvas để render chữ) */}
      {videoSrc && (
        <video 
          ref={videoRef} 
          src={videoSrc} 
          onTimeUpdate={handleTimeUpdate} 
          onEnded={() => dispatch(togglePlayPause())}
          className="hidden" 
        />
      )}

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
