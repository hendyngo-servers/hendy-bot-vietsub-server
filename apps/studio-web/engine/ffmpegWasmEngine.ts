/** Browser render adapter contract. The client bundle intentionally avoids pulling FFmpeg WASM until the large runtime is explicitly enabled. */
export interface LocalRenderOptions { input: File; onProgress?: (progress: number) => void; }
export interface LocalRenderResult { blob: Blob; fileName: string; }
export class FfmpegWasmEngine {
  async render(_options: LocalRenderOptions): Promise<LocalRenderResult> {
    throw new Error('Local FFmpeg WASM is not bundled in this starter. Use the server render queue or add @ffmpeg/ffmpeg and its core assets.');
  }
}
