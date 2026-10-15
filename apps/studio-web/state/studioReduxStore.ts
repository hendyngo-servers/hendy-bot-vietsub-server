import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SubtitleCue } from '../../types/system';

interface StudioState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  cues: SubtitleCue[];
  activeCueId: string | number | null;
  videoSrc: string | null; // URL dạng blob của video đang tải
}

const initialState: StudioState = {
  isPlaying: false,
  currentTime: 0,
  totalDuration: 0,
  cues: [],
  activeCueId: null,
  videoSrc: null,
};

export const studioSlice = createSlice({
  name: 'studio',
  initialState,
  reducers: {
    setVideoSrc: (state, action: PayloadAction<{ url: string; duration: number }>) => {
      state.videoSrc = action.payload.url;
      state.totalDuration = action.payload.duration;
      state.currentTime = 0;
    },
    togglePlayPause: (state) => {
      state.isPlaying = !state.isPlaying;
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
      // Tự động dò tìm câu phụ đề (Cue) đang active dựa trên currentTime
      const active = state.cues.find(
        (c) => action.payload >= c.start && action.payload <= c.end
      );
      state.activeCueId = active ? active.id : null;
    },
    setCues: (state, action: PayloadAction<SubtitleCue[]>) => {
      state.cues = action.payload;
    },
    updateCue: (state, action: PayloadAction<SubtitleCue>) => {
      const index = state.cues.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) state.cues[index] = action.payload;
    },
  },
});

export const { setVideoSrc, togglePlayPause, setIsPlaying, setCurrentTime, setCues, updateCue } = studioSlice.actions;
export default studioSlice.reducer;
