/** Tiny dependency-free observable store. Replace with Redux Toolkit when cross-editor undo/history middleware is added. */
export type StudioState = { activeProjectId: string | null; playheadSeconds: number; selectedClipId: string | null; isPlaying: boolean };
type Listener = () => void;
let state: StudioState = { activeProjectId: null, playheadSeconds: 0, selectedClipId: null, isPlaying: false };
const listeners = new Set<Listener>();
export const studioStore = {
  getState: () => state,
  subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); },
  dispatch(patch: Partial<StudioState>) { state = { ...state, ...patch }; for (const listener of listeners) listener(); }
};
