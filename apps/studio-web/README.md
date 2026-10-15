# Hendy Studio Web — Video Editor

React 19 + Vite workspace dành cho người dùng biên tập video/Vietsub. Bao gồm thư viện media, preview player, timeline 4 track (video, overlay/PiP, audio, phụ đề), subtitle inspector, style preview, mixer cơ bản và render-manifest submission.

## Chạy local

Từ thư mục gốc monorepo:

```bash
npm install
npm run dev:studio
```

Mặc định Vite chạy tại `http://localhost:5173`. API dev proxy mặc định trỏ về `http://localhost:8787`; có thể cấu hình `VITE_API_BASE_URL` để dùng API ở host khác.

## Các thao tác có sẵn

- Import media bằng file picker hoặc kéo-thả.
- Nhập SRT/ASS/SSA để nạp cue phụ đề.
- Chỉnh văn bản, thời gian, cỡ chữ, màu chữ và xem trước overlay.
- Thay đổi gain video, cờ ducking BGM và zoom preview.
- Lưu metadata dự án vào localStorage, tải phụ đề SRT và gửi render manifest lên API.

> Lưu local chỉ lưu metadata, không nhúng nội dung video vào localStorage. Crop/keyframe nâng cao, tự động ducking, burn-in ASS hoàn chỉnh và render đa track cần được triển khai tại render worker.

## Kiểm tra parser phụ đề

```bash
npm test --workspace @hendy/studio-web
```

Các test bao phủ thứ tự cue SRT, nội dung nhiều dòng, bỏ cue sai định dạng, đọc ASS Dialogue, định dạng timestamp và tên file đầu ra.
