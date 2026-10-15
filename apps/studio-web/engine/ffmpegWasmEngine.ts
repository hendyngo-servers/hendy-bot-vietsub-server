import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegWasmEngine {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
    // Bắt sự kiện log để debug
    this.ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));
  }

  public async load() {
    if (this.loaded) return;
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    // Tải lõi WebAssembly
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    this.loaded = true;
  }

  /**
   * Tách âm thanh từ Video và nén lại thành mp3 nhẹ
   */
  public async extractAudioForAI(videoFile: File): Promise<Blob> {
    if (!this.loaded) await this.load();

    const inputName = 'input_video' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
    const outputName = 'audio_for_ai.mp3';

    // 1. Ghi file video vào hệ thống file ảo của FFmpeg (Memory FS)
    await this.ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    // 2. Chạy lệnh tách Audio. 
    // -vn: bỏ hình ảnh
    // -ac 1: chuyển thành mono channel (nhẹ bằng 1/2)
    // -ar 16000: sample rate 16kHz (chuẩn tốt nhất cho Whisper AI)
    // -q:a 5: nén mp3 mức trung bình
    await this.ffmpeg.exec([
      '-i', inputName,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-q:a', '5',
      outputName
    ]);

    // 3. Đọc file kết quả và trả về dạng Blob
    const data = await this.ffmpeg.readFile(outputName);
    
    // Giải phóng bộ nhớ ảo
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([(data as Uint8Array).buffer], { type: 'audio/mpeg' });
  }
}

export const ffmpegEngine = new FFmpegWasmEngine();
