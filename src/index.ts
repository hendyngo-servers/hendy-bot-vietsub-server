import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';

// Khởi tạo SDK của Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Khởi tạo Worker lắng nghe Queue 'subtitle-generation'
const worker = new Worker('subtitle-generation', async (job: Job) => {
  console.log(`[Job ${job.id}] Bắt đầu xử lý file: ${job.data.filePath}`);
  
  try {
    // BƯỚC 1: Upload file MP3 lên Google AI Storage để Gemini phân tích
    const uploadResult = await fileManager.uploadFile(job.data.filePath, {
      mimeType: 'audio/mp3',
      displayName: `Audio_Job_${job.id}`,
    });
    console.log(`[Job ${job.id}] Upload audio lên Gemini thành công: ${uploadResult.file.uri}`);

    // BƯỚC 2: Cấu hình Model Gemini 1.5 Flash (Nhanh, rẻ, hỗ trợ Multimodal)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      // Ép Gemini phải trả về đúng định dạng JSON
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    // BƯỚC 3: Kỹ thuật Prompt Engineering để lấy cấu trúc SubtitleCue[]
    const prompt = `
      You are a professional video subtitle generator and translator.
      Listen to the attached audio carefully.
      
      Tasks:
      1. Transcribe the original speech into text (sourceText).
      2. Translate it into Vietnamese (translatedText) maintaining the context and emotion.
      3. Identify the speaker if possible (e.g., "Speaker 1", "Speaker 2").
      4. Estimate the precise start and end time (in seconds) for each sentence.
      
      OUTPUT STRICTLY AS A JSON ARRAY of objects matching this exact schema:
      [
        {
          "id": "1", // incremental string or uuid
          "start": 0.0, // float in seconds
          "end": 2.5, // float in seconds
          "sourceText": "Original language text",
          "translatedText": "Translated Vietnamese text",
          "speaker": "Speaker 1"
        }
      ]
    `;

    // BƯỚC 4: Thực thi Gemini
    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
    ]);

    // Lấy chuỗi JSON từ Gemini và parse
    const responseText = result.response.text();
    const cues = JSON.parse(responseText);

    console.log(`[Job ${job.id}] Gemini tạo thành công ${cues.length} dòng phụ đề.`);

    // (Tùy chọn) Xóa file audio trên ổ cứng local để giải phóng dung lượng
    if (fs.existsSync(job.data.filePath)) {
      fs.unlinkSync(job.data.filePath);
    }
    // Xóa file trên Google AI Storage sau khi dùng xong
    await fileManager.deleteFile(uploadResult.file.name);

    // BƯỚC 5: Trả về kết quả cho BullMQ
    return {
      cues: cues
    };

  } catch (error) {
    console.error(`[Job ${job.id}] Thất bại:`, error);
    throw error; // Ném lỗi để BullMQ biết và thử lại (Retry)
  }
}, { connection: redisConnection });

worker.on('completed', (job, returnvalue) => {
  console.log(`[Worker] Job ${job.id} đã hoàn thành xuất sắc!`);
  // Ở đây bạn có thể cập nhật trạng thái vào MongoDB hoặc bắn WebSocket báo cho Frontend
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} bị lỗi: ${err.message}`);
});s
