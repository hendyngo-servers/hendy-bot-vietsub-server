export interface SubtitleCue {
  id: string;
  start: number;       // Thời gian bắt đầu (giây)
  end: number;         // Thời gian kết thúc (giây)
  sourceText: string;  // Phụ đề gốc (VD: Tiếng Anh)
  translatedText: string; // Phụ đề Vietsub
  speaker?: string;    // Người nói
}

export interface VideoProject {
  id: string;
  userId: string;
  title: string;
  videoUrl: string;
  status: 'processing' | 'ready' | 'failed';
  cues: SubtitleCue[];
  createdAt: string;
  updatedAt: string;
}

export interface JobPayload {
  jobId: string;
  filePath: string;
  originalName: string;
  targetLanguage: string;
}
