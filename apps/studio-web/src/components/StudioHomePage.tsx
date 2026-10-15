import { ArrowRight, Clapperboard, CloudUpload, Film, Subtitles } from 'lucide-react';

/** Optional landing page for a future route; editor entry stays in StudioWorkspace. */
export function StudioHomePage({ onCreateProject, projectCount = 0 }: { onCreateProject: () => void; projectCount?: number }) {
  return <section className="studio-home-page">
    <div className="studio-home-mark"><Clapperboard size={26} /></div>
    <p className="eyebrow">HENDY VIDEO STUDIO PRO</p>
    <h1>Không gian dựng video Vietsub</h1>
    <p className="studio-home-copy">Nhập media, chỉnh timeline và chuẩn bị render manifest từ một workspace thống nhất.</p>
    <button className="primary-button" onClick={onCreateProject}>Mở workspace <ArrowRight size={15} /></button>
    <div className="studio-home-features">
      <div><CloudUpload size={18} /><b>Media</b><span>Video, audio, ảnh, SRT và ASS</span></div>
      <div><Film size={18} /><b>Timeline</b><span>Track video, overlay và âm thanh</span></div>
      <div><Subtitles size={18} /><b>Vietsub</b><span>Chỉnh nội dung và kiểu phụ đề</span></div>
    </div>
    <small>{projectCount} dự án gần đây · Lưu trữ và đăng nhập cần được cấu hình cho production.</small>
  </section>;
}
