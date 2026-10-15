import express from 'express';
import multer from 'multer';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const router = express.Router();

// 1. Cấu hình Redis & BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subtitleQueue = new Queue('subtitle-generation', { connection: redisConnection });

// 2. Cấu hình Multer để nhận file Audio
const upload = multer({ dest: '/tmp/uploads/audio/' });

// 3. API Endpoint nhận Audio từ Frontend
router.post('/v1/subtitles/generate', upload.single('audio'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Không tìm thấy file audio' });
    }

    // Đưa Job vào hàng đợi BullMQ thay vì xử lý ngay
    const job = await subtitleQueue.add('process-audio', {
      filePath: file.path,
      originalName: file.originalname,
      targetLanguage: 'vi', // Dịch sang Tiếng Việt
    });

    // Trả về JobID ngay lập tức để Frontend tạo hiệu ứng Loading & Polling
    res.json({ 
      success: true, 
      jobId: job.id,
      message: 'Audio đã được đưa vào hàng đợi xử lý AI.' 
    });

  } catch (error) {
    console.error('Lỗi khi tạo job:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
