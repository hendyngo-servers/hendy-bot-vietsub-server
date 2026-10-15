import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { Activity, AudioLines, Check, ChevronDown, Clapperboard, CloudUpload, Download, FileText, Film, FilePlus2, KeyRound, Languages, Layers3, ListMusic, LogIn, Menu, MonitorPlay, Music2, Pause, Play, Plus, Save, Scissors, Settings2, ShieldCheck, Sparkles, Subtitles, Upload, WandSparkles, Volume2, X } from 'lucide-react';
import type { RenderManifest, SubtitleCue, TimelineTrack } from '@hendy/shared-types';
import { StudioWorkspace } from './components/StudioWorkspace';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitleList } from './components/SubtitleList';
import { formatSrtTime, parseAss, parseSrt, parseVtt, safeFilename } from '../engine/subtitleFormats';

const VITE_ENV = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string; VITE_REQUIRE_AUTH?: string } }).env ?? {};
const API_BASE = (VITE_ENV.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const REQUIRE_AUTH = VITE_ENV.VITE_REQUIRE_AUTH === 'true';
const SESSION_KEY = 'hendy-studio-session';
function readSessionToken() { try { return sessionStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; } }
function apiUrl(path: string) { return `${API_BASE}${path}`; }
function apiFetch(path: string, init: RequestInit = {}) { const headers = new Headers(init.headers); const token=readSessionToken(); if(token) headers.set('authorization', `Bearer ${token}`); return fetch(apiUrl(path), { ...init, headers }); }
type StudioLoginMode = 'login' | 'accept-invite';
type Asset = { id: string; name: string; type: 'video' | 'audio' | 'image' | 'subtitle'; url?: string; duration?: number; file?: File };
const initialCues: SubtitleCue[] = [
  { id: 'sub-1', start: 0.8, end: 3.4, text: 'Chào mừng đến với Hendy Video Studio Pro' },
  { id: 'sub-2', start: 3.8, end: 6.2, text: 'Biên tập video, chỉnh sửa phụ đề và xuất bản trong một nơi.' }
];
const initialTracks: TimelineTrack[] = [
  { id: 'track-video', name: 'Video chính', kind: 'video', clips: [] },
  { id: 'track-overlay', name: 'Lớp phủ / PiP', kind: 'overlay', clips: [] },
  { id: 'track-audio', name: 'Nhạc nền / BGM', kind: 'audio', volume: 0.2, clips: [] },
  { id: 'track-voice', name: 'Voice / thoại', kind: 'audio', volume: 1, clips: [] },
  { id: 'track-tts', name: 'TTS / lồng tiếng', kind: 'audio', volume: 1, clips: [] },
  { id: 'track-subtitle', name: 'Phụ đề Vietsub', kind: 'subtitle', clips: [] }
];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState(readSessionToken);
  const [showLogin, setShowLogin] = useState(() => (REQUIRE_AUTH && !readSessionToken()) || new URLSearchParams(window.location.search).has('invite'));
  const [loginMode, setLoginMode] = useState<StudioLoginMode>(() => new URLSearchParams(window.location.search).has('invite') ? 'accept-invite' : 'login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [pipX, setPipX] = useState(0.66);
  const [pipY, setPipY] = useState(0.06);
  const [pipWidth, setPipWidth] = useState(0.30);
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [tracks, setTracks] = useState<TimelineTrack[]>(initialTracks);
  const [cues, setCues] = useState<SubtitleCue[]>(initialCues);
  const [activeCue, setActiveCue] = useState('sub-1');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [duration, setDuration] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [audioGain, setAudioGain] = useState(35);
  const [fontSize, setFontSize] = useState(26);
  const [subtitleColor, setSubtitleColor] = useState('#ffffff');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Sẵn sàng — nhập video để bắt đầu dựng.');
  const [jobId, setJobId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [projectTitle, setProjectTitle] = useState('Dự án chưa đặt tên');
  const [activeTool, setActiveTool] = useState<'edit' | 'subtitles' | 'audio' | 'ai'>('edit');
  const [inspectorTab, setInspectorTab] = useState<'subtitle' | 'video' | 'audio'>('subtitle');
  const [bgmDucking, setBgmDucking] = useState(true);
  const [audioTargetTrack, setAudioTargetTrack] = useState<'track-audio'|'track-voice'|'track-tts'>('track-audio');
  const [ttsVoice, setTtsVoice] = useState('alloy');

  const activeSubtitle = cues.find(c => currentTime >= c.start && currentTime <= c.end) ?? cues.find(c => c.id === activeCue);
  const videoAsset = assets.find(a => a.id === previewVideoId && a.type === 'video' && a.url) ?? assets.find(a => a.type === 'video' && a.url);
  const timelineScale = useMemo(() => Math.max(1, 100 / Math.max(duration, 1)), [duration]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, audioGain / 100));
  }, [audioGain, videoAsset?.url]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = () => setCurrentTime(el.currentTime || 0);
    const meta = () => { const mediaDuration=Math.max(1,Math.ceil(el.duration||30)); setDuration(mediaDuration); if(previewVideoId) setTracks(old=>old.map(track=>({...track,clips:track.clips.map(clip=>clip.assetId===previewVideoId?{...clip,duration:mediaDuration}:clip)}))); };
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    el.addEventListener('timeupdate', time); el.addEventListener('loadedmetadata', meta);
    el.addEventListener('play', play); el.addEventListener('pause', pause);
    return () => { el.removeEventListener('timeupdate', time); el.removeEventListener('loadedmetadata', meta); el.removeEventListener('play', play); el.removeEventListener('pause', pause); };
  }, [videoAsset?.url, previewVideoId]);

  useEffect(() => {
    let hasLocalDraft=false;
    try {
      const raw=localStorage.getItem('hendy-studio-project-v1');
      hasLocalDraft=Boolean(raw);
      if(raw) { const saved=JSON.parse(raw) as {id?:string;title?:string;tracks?:TimelineTrack[];subtitles?:SubtitleCue[];settings?:Record<string,unknown>};
        if(saved.id) setProjectId(saved.id); if(saved.title) setProjectTitle(saved.title); if(saved.tracks?.length) setTracks(saved.tracks); if(saved.subtitles?.length) {setCues(saved.subtitles);setActiveCue(saved.subtitles[0].id);}
        if(typeof saved.settings?.fontSize==='number') setFontSize(saved.settings.fontSize); if(typeof saved.settings?.subtitleColor==='string') setSubtitleColor(saved.settings.subtitleColor); if(typeof saved.settings?.audioGain==='number') setAudioGain(saved.settings.audioGain); if(typeof saved.settings?.bgmDucking==='boolean') setBgmDucking(saved.settings.bgmDucking);
        if(typeof saved.settings?.cropZoom==='number') setCropZoom(saved.settings.cropZoom); if(typeof saved.settings?.pipX==='number') setPipX(saved.settings.pipX); if(typeof saved.settings?.pipY==='number') setPipY(saved.settings.pipY); if(typeof saved.settings?.pipWidth==='number') setPipWidth(saved.settings.pipWidth); if(typeof saved.settings?.transitionDuration==='number') setTransitionDuration(saved.settings.transitionDuration); if(saved.settings?.audioTargetTrack==='track-audio'||saved.settings?.audioTargetTrack==='track-voice'||saved.settings?.audioTargetTrack==='track-tts') setAudioTargetTrack(saved.settings.audioTargetTrack);
      }
    } catch { /* ignore a malformed local draft */ }

  }, []);

  useEffect(() => {
    if (!authToken) return;
    let cancelled=false;
    void apiFetch('/api/v1/assets').then(async response=>{if(!response.ok)return;const body=await response.json();if(cancelled)return;const remote:Asset[]=(body.assets??[]).map((a:{assetId:string;name:string;mimeType:string;url:string;size?:number})=>({id:a.assetId,name:a.name,type:a.mimeType.startsWith('video/')?'video':a.mimeType.startsWith('audio/')?'audio':a.mimeType.startsWith('image/')?'image':'subtitle',url:apiUrl(a.url)}));setAssets(current=>{const ids=new Set(current.map(a=>a.id));return [...current,...remote.filter(a=>!ids.has(a.id))];});}).catch(()=>undefined);
    const hasLocalDraft=Boolean(localStorage.getItem('hendy-studio-project-v1'));
    if(!projectId&&!hasLocalDraft) void apiFetch('/api/v1/projects').then(async response=>{if(!response.ok)return;const body=await response.json();const project=(body.projects??[])[0];if(!project||cancelled)return;setProjectId(String(project.id));setProjectTitle(String(project.title??'Dự án'));if(Array.isArray(project.tracks))setTracks(project.tracks);if(Array.isArray(project.subtitles)){setCues(project.subtitles);if(project.subtitles[0])setActiveCue(project.subtitles[0].id);}if(project.settings&&typeof project.settings==='object'){const settings=project.settings as Record<string,unknown>;if(typeof settings.fontSize==='number')setFontSize(settings.fontSize);if(typeof settings.subtitleColor==='string')setSubtitleColor(settings.subtitleColor);if(typeof settings.audioGain==='number')setAudioGain(settings.audioGain);if(typeof settings.bgmDucking==='boolean')setBgmDucking(settings.bgmDucking);}}).catch(()=>undefined);
    return ()=>{cancelled=true;};
  }, [authToken]);

  useEffect(() => {
    if (!jobId) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await apiFetch(`/api/v1/jobs/${jobId}`);
        if (!response.ok) return;
        const job = await response.json();
        setNotice(`Render: ${job.status} · ${Math.round(job.progress ?? 0)}%${job.message ? ` — ${job.message}` : ''}`);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'queued-local-only') {
          window.clearInterval(interval);
          if (job.outputUrl) setNotice(`Render hoàn tất: ${job.outputUrl.startsWith('http') ? job.outputUrl : apiUrl(job.outputUrl)}`);
          if (job.status === 'queued-local-only') setNotice('Manifest đã tạo. Bật Redis + ai-worker để xử lý render.');
        }
      } catch { /* keep polling while connection is temporarily unavailable */ }
    }, 1800);
    return () => window.clearInterval(interval);
  }, [jobId]);

  async function processFile(file: File) {
    const lowerName = file.name.toLowerCase();
    const type: Asset['type'] = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : lowerName.endsWith('.srt') || lowerName.endsWith('.ass') || lowerName.endsWith('.ssa') || lowerName.endsWith('.vtt') ? 'subtitle' : 'video';
    const localUrl = URL.createObjectURL(file);
    const temp: Asset = { id: `local-${crypto.randomUUID()}`, name: file.name, type, url: localUrl, file };
    setAssets(old => [temp, ...old]); setSelectedAsset(temp); if(type==='video') setPreviewVideoId(temp.id);

    if (type === 'subtitle') {
      try {
        const source = await file.text();
        const parsed = lowerName.endsWith('.srt') ? parseSrt(source) : lowerName.endsWith('.vtt') ? parseVtt(source) : parseAss(source);
        if (parsed.length) {
          setCues(parsed);
          setActiveCue(parsed[0].id);
          setNotice(`Đã nhập ${parsed.length} dòng phụ đề từ ${file.name}.`);
        } else setNotice(`Đã thêm ${file.name} vào thư viện, nhưng không tìm thấy cue hợp lệ.`);
      } catch {
        setNotice(`Không đọc được tệp phụ đề ${file.name}.`);
      }
      return;
    }

    if (type === 'video') {
      setTracks(old => old.map(t => { if(t.id!=='track-video') return t; const start=t.clips.reduce((end,c)=>Math.max(end,c.start+c.duration),0); return {...t,clips:[...t.clips,{id:`clip-${crypto.randomUUID()}`,assetId:temp.id,name:file.name,start,duration:30,sourceStart:0,volume:1}]}; }));
    } else if(type==='audio') {
      setTracks(old=>old.map(t=>{if(t.id!==audioTargetTrack)return t;const start=t.clips.reduce((end,c)=>Math.max(end,c.start+c.duration),0);return {...t,clips:[...t.clips,{id:`clip-${crypto.randomUUID()}`,assetId:temp.id,name:file.name,start,duration:30,sourceStart:0,volume:1}]};}));
    }
    setNotice(`Đã nạp ${file.name}. Đang thử tải asset lên API…`);
    try {
      const form = new FormData(); form.append('file', file);
      const response = await apiFetch('/api/v1/assets', { method: 'POST', body: form });
      if (response.ok) {
        const saved = await response.json();
        const uploaded: Asset = { ...temp, id: saved.assetId, url: saved.url ? apiUrl(saved.url) : localUrl };
        setAssets(old => old.map(a => a.id === temp.id ? uploaded : a));
        setTracks(old => old.map(t => ({ ...t, clips: t.clips.map(c => c.assetId === temp.id ? { ...c, assetId: saved.assetId } : c) })));
        setPreviewVideoId(old => old===temp.id ? saved.assetId : old);
        setSelectedAsset(uploaded);
        setNotice('Asset đã lưu trên API. Có thể tiếp tục dựng.');
      } else setNotice('Asset vẫn dùng cục bộ; API chưa nhận tệp (kiểm tra /api/v1/assets).');
    } catch {
      setNotice('Asset đang dùng cục bộ; chưa kết nối được API upload.');
    }
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length) files.forEach(file => { void processFile(file); });
  }

  async function saveProjectLocally() {
    const project = {
      schemaVersion: 2, id: projectId, title: projectTitle, savedAt: new Date().toISOString(),
      assets: assets.map(({ id, name, type, duration }) => ({ id, name, type, duration })),
      tracks, subtitles: cues, settings: { fontSize, subtitleColor, audioGain, bgmDucking, cropZoom, pipX, pipY, pipWidth, transitionDuration, audioTargetTrack },
    };
    try { localStorage.setItem('hendy-studio-project-v1', JSON.stringify(project)); }
    catch { setNotice('Không thể lưu metadata dự án cục bộ — dung lượng trình duyệt có thể đã đầy.'); return; }
    try {
      const body={title:projectTitle,tracks,subtitles:cues,settings:project.settings};
      const response=projectId ? await apiFetch(`/api/v1/projects/${projectId}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}) : await apiFetch('/api/v1/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(!response.ok) throw new Error(`API ${response.status}`);
      const saved=await response.json(); if(saved.id) setProjectId(saved.id);
      localStorage.setItem('hendy-studio-project-v1',JSON.stringify({...project,id:saved.id??projectId}));
      setNotice('Đã lưu dự án cục bộ và đồng bộ metadata lên máy chủ.');
    } catch { setNotice('Đã lưu metadata cục bộ; máy chủ chưa nhận dự án (kiểm tra đăng nhập/API).'); }
  }

  async function signInOrAcceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginBusy(true);
    try {
      if(loginMode==='accept-invite') {
        const token=new URLSearchParams(window.location.search).get('invite')??'';
        const response=await fetch(apiUrl('/api/v1/auth/accept-invite'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password:loginPassword})});
        const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`);
        window.history.replaceState({},'',window.location.pathname); setLoginMode('login'); if(body.email) setLoginEmail(body.email); setLoginPassword(''); setNotice('Lời mời đã được chấp nhận. Đăng nhập để tiếp tục.'); return;
      }
      const response=await fetch(apiUrl('/api/v1/auth/login'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:loginEmail,password:loginPassword})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`);
      sessionStorage.setItem(SESSION_KEY,body.token); setAuthToken(body.token); setShowLogin(false); setLoginPassword(''); setNotice(`Đã đăng nhập: ${body.user?.email??loginEmail}`);
    } catch(error) { setNotice(error instanceof Error?error.message:'Không thể xác thực tài khoản.'); }
    finally { setLoginBusy(false); }
  }

  async function translateSubtitles() {
    if(!cues.length) { setNotice('Chưa có phụ đề để dịch.'); return; }
    setBusy(true); setNotice('Đang dịch phụ đề bằng Gemini…');
    try {
      const response=await apiFetch('/api/v1/ai/translate-subtitles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({targetLanguage:'Vietnamese',cues:cues.map(c=>({id:c.id,start:c.start,end:c.end,text:c.text}))})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`);
      const translated=new Map((body.translations??[]).map((item:{id:string;text:string})=>[item.id,item.text]));
      setCues(old=>old.map(c=>translated.has(c.id)?{...c,text:String(translated.get(c.id))}:c)); setNotice(`Đã dịch ${translated.size} dòng bằng ${body.model??'AI'}.`);
    } catch(error) { setNotice(`Không dịch được phụ đề: ${error instanceof Error?error.message:'lỗi không xác định'}`); }
    finally { setBusy(false); }
  }

  async function generateTts() {
    const cue=cues.find(item=>item.id===activeCue);
    if(!cue?.text.trim()) { setNotice('Chọn một cue có nội dung để tạo giọng đọc.'); return; }
    setBusy(true); setNotice('Đang tạo giọng đọc TTS cho cue đã chọn…');
    try {
      const response=await apiFetch('/api/v1/ai/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:cue.text,voice:ttsVoice,format:'mp3'})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`);
      const asset:Asset={id:String(body.assetId),name:String(body.name??`tts-${cue.id}.mp3`),type:'audio',url:apiUrl(String(body.url))};
      const clipId=`tts-clip-${crypto.randomUUID()}`; const estimatedDuration=Math.max(1,Math.min(30,cue.text.length/12));
      setAssets(old=>[asset,...old.filter(item=>item.id!==asset.id)]); setSelectedAsset(asset); setAudioTargetTrack('track-tts');
      setTracks(old=>old.map(track=>track.id!=='track-tts'?track:{...track,clips:[...track.clips.filter(clip=>clip.id!==clipId),{id:clipId,assetId:asset.id,name:asset.name,start:cue.start,duration:estimatedDuration,sourceStart:0,volume:1}]}));
      const probe=new Audio(asset.url); probe.preload='metadata';
      probe.addEventListener('loadedmetadata',()=>{if(Number.isFinite(probe.duration)&&probe.duration>0)setTracks(old=>old.map(track=>track.id!=='track-tts'?track:{...track,clips:track.clips.map(clip=>clip.id===clipId?{...clip,duration:probe.duration}:clip)}));},{once:true});
      probe.load(); setNotice(`Đã tạo audio TTS và thêm vào track lồng tiếng tại ${formatTime(cue.start)}.`);
    } catch(error) { setNotice(`Không tạo được TTS: ${error instanceof Error?error.message:'lỗi không xác định'}`); }
    finally { setBusy(false); }
  }

  async function transcribeSelected() {
    if(!selectedAsset?.file) { setNotice('Chọn lại tệp audio/video từ máy tính để bóc băng.'); return; }
    setBusy(true); setNotice('Đang gửi media đến dịch vụ nhận dạng giọng nói…');
    try {
      const form=new FormData(); form.append('file',selectedAsset.file);
      const response=await apiFetch('/api/v1/ai/transcribe',{method:'POST',body:form}); const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`);
      const segments=Array.isArray(body.segments)?body.segments:[];
      const generated:SubtitleCue[]=segments.filter((s:{start?:number;end?:number;text?:string})=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end!>s.start!&&typeof s.text==='string').map((s:{start:number;end:number;text:string},i:number)=>({id:`stt-${Date.now()}-${i}`,start:s.start,end:s.end,text:s.text.trim()}));
      if(!generated.length) throw new Error('Dịch vụ STT không trả về segments phù hợp.');
      setCues(generated); setActiveCue(generated[0].id); setNotice(`Đã tạo ${generated.length} cue từ bản chép lời.`);
    } catch(error) { setNotice(`Không bóc băng được: ${error instanceof Error?error.message:'lỗi không xác định'}`); }
    finally { setBusy(false); }
  }

  function addSelectedAsPip() {
    if(!selectedAsset || !['video','image'].includes(selectedAsset.type)) { setNotice('Hãy chọn một asset video hoặc hình ảnh để thêm PiP.'); return; }
    if(selectedAsset.id.startsWith('local-')) { setNotice('Asset chưa tải lên máy chủ. Hãy nhập lại khi API khả dụng trước khi render.'); return; }
    const clip={id:`pip-${crypto.randomUUID()}`,assetId:selectedAsset.id,name:selectedAsset.name,start:Math.max(0,currentTime),duration:Math.max(1,Math.min(duration-currentTime,selectedAsset.duration??10)),sourceStart:0,volume:1,transform:{x:pipX,y:pipY,width:pipWidth,height:pipWidth*9/16,opacity:1},transitionIn:{type:'fade' as const,duration:transitionDuration},transitionOut:{type:'fade' as const,duration:transitionDuration}};
    setTracks(old=>old.map(track=>track.id==='track-overlay'?{...track,clips:[...track.clips,clip]}:track)); setNotice(`Đã thêm lớp PiP: ${selectedAsset.name}`);
  }

  function addPipKeyframes() {
    setTracks(old=>old.map(track=>track.id==='track-overlay'?{...track,clips:track.clips.map(clip=>clip.id===track.clips.at(-1)?.id?{...clip,keyframes:[{time:0,x:pipX,y:pipY,scale:1,opacity:1},{time:Math.max(1,clip.duration-transitionDuration),x:0.05,y:0.05,scale:0.85,opacity:1}]}:clip)}:track));
    setNotice('Đã thêm keyframe chuyển vị trí/zoom cho PiP cuối timeline overlay.');
  }

  function downloadSubtitles() {
    const content = cues.slice().sort((a, b) => a.start - b.start).map((cue, index) => `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`).join('\n\n');
    const blob = new Blob([`\uFEFF${content}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${safeFilename(projectTitle)}.srt`; anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${cues.length} dòng phụ đề thành tệp SRT.`);
  }

  function updateCue(id: string, patch: Partial<SubtitleCue>) { setCues(old => old.map(c => c.id === id ? { ...c, ...patch } : c)); }
  function addCue() {
    const id = `sub-${crypto.randomUUID()}`; const start = Math.max(0, Math.min(duration - 0.2, currentTime));
    setCues(old => [...old, { id, start, end: Math.min(duration, start + 2.5), text: 'Nhập nội dung Vietsub mới' }]); setActiveCue(id);
  }
  async function exportManifest() {
    setBusy(true); setNotice('Đang gửi render manifest…');
    const normalizedTracks = tracks.map(t => ({ ...t, volume:t.kind==='audio'?Math.min(t.volume??1,audioGain/100):(t.volume??1), clips: t.clips.map(c => {
      const base={...c,duration:Math.max(0.1,c.duration||duration),volume:c.volume??1};
      if(t.kind==='video') { const cropZoomSafe=Math.max(1,Math.min(3,cropZoom)); const cropWidth=1/cropZoomSafe; const crop={x:(1-cropWidth)/2,y:(1-cropWidth)/2,width:cropWidth,height:cropWidth}; return {...base,transform:{x:0,y:0,width:1,height:1,...(cropZoomSafe>1.001?{crop}:{})},transitionIn:{type:'fade' as const,duration:transitionDuration},transitionOut:{type:'fade' as const,duration:transitionDuration}}; }
      if(t.kind==='overlay') return {...base,transform:c.transform??{x:pipX,y:pipY,width:pipWidth,height:pipWidth*9/16,opacity:1}};
      return base;
    }) }));
    const manifest: RenderManifest = { projectId: projectId??`project-${crypto.randomUUID()}`, title: projectTitle, width: 1920, height: 1080, fps: 30, tracks: normalizedTracks, subtitles: cues.map(c => ({ ...c, style: { fontFamily: 'Arial', fontSize, color: subtitleColor, outlineColor: '#000000', outlineWidth: 2, bold: true } })), export: { format: 'mp4', burnSubtitles: true, quality: 'standard', audioDucking:{enabled:bgmDucking,thresholdDb:-24,ratio:6,attackMs:20,releaseMs:250} } };
    try {
      const response = await apiFetch('/api/v1/render/manifest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(manifest) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setJobId(body.id); setNotice(`Đã tạo render job ${body.id.slice(0, 8)} — ${body.status}.`);
    } catch (error) { setNotice(`Chưa gửi được manifest: ${error instanceof Error ? error.message : 'lỗi không xác định'}`); }
    finally { setBusy(false); }
  }
  function seekTo(seconds: number) { if (videoRef.current && Number.isFinite(seconds)) { videoRef.current.currentTime = Math.max(0, Math.min(duration, seconds)); setCurrentTime(videoRef.current.currentTime); } }

  return <div className="studio-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Clapperboard size={20}/></div><div><b>HENDY <span>STUDIO</span></b><small>VIDEO EDITOR PRO</small></div></div>
      <button className="project-title" title="Đổi tên dự án" onClick={() => { const next = window.prompt('Tên dự án', projectTitle); if (next?.trim()) setProjectTitle(next.trim()); }}><span className="live-dot"/> {projectTitle} <ChevronDown size={14}/><span className="saved-label"><Check size={12}/> Workspace cục bộ</span></button>
      <div className="top-actions"><button className="icon-button" title={authToken?'Phiên đã đăng nhập':'Đăng nhập tài khoản'} onClick={() => { if(authToken){sessionStorage.removeItem(SESSION_KEY);setAuthToken('');setNotice('Đã đăng xuất khỏi Hendy Studio.');setShowLogin(REQUIRE_AUTH);} else setShowLogin(true); }}><KeyRound size={16}/></button><button className="icon-button" title="Xuất phụ đề SRT" onClick={downloadSubtitles}><FileText size={16}/></button><button className="icon-button" title="Lưu dự án cục bộ" onClick={saveProjectLocally}><Save size={16}/></button><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={15}/> Nhập media</button><button className="primary-button" disabled={busy} onClick={exportManifest}><Download size={15}/>{busy ? 'Đang gửi…' : 'Xuất video'}</button><input ref={fileRef} type="file" accept="video/*,audio/*,image/*,.srt,.ass,.ssa,.vtt" hidden onChange={importFile}/></div>
    </header>
    <nav className="toolstrip"><button className={`tool ${activeTool === 'edit' ? 'active' : ''}`} onClick={() => setActiveTool('edit')}><Scissors size={16}/> Dựng phim</button><button className={`tool ${activeTool === 'subtitles' ? 'active' : ''}`} onClick={() => { setActiveTool('subtitles'); setInspectorTab('subtitle'); }}><Subtitles size={16}/> Phụ đề AI</button><button className={`tool ${activeTool === 'audio' ? 'active' : ''}`} onClick={() => { setActiveTool('audio'); setInspectorTab('audio'); }}><AudioLines size={16}/> Âm thanh</button><button className={`tool ${activeTool === 'ai' ? 'active' : ''}`} onClick={() => { setActiveTool('ai'); setInspectorTab('subtitle'); void translateSubtitles(); }}><WandSparkles size={16}/> Công cụ AI <span className="new-pill">BETA</span></button><div className="toolstrip-spacer"/><span className="workspace-label"><Activity size={14}/> Workspace · 1080p</span></nav>
    <StudioWorkspace>
      <aside className="asset-panel">
        <div className="section-title"><span>THƯ VIỆN MEDIA</span><button className="small-icon" onClick={() => fileRef.current?.click()}><Plus size={15}/></button></div>
        <button className="import-card" onClick={() => fileRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={handleDrop}><div className="import-icon"><CloudUpload size={20}/></div><b>Kéo thả hoặc chọn tệp</b><small>MP4 · MOV · MP3 · SRT · ASS</small></button>
        <div className="asset-filter"><button className="selected">Tất cả <span>{assets.length}</span></button><button>Video</button><button>Audio</button></div>
        <div className="asset-list">{assets.length === 0 ? <div className="empty-assets"><Film size={23}/><b>Chưa có media</b><span>Nhập video để bắt đầu dự án.</span></div> : assets.map(a => <button className={`asset-row ${selectedAsset?.id === a.id ? 'asset-selected' : ''}`} key={a.id} onClick={() => { setSelectedAsset(a); if (a.type === 'video') setPreviewVideoId(a.id); if(a.url&&a.type==='video'&&videoRef.current) videoRef.current.src=a.url; }}><div className="asset-thumb">{a.type === 'audio' ? <Music2 size={17}/> : a.type === 'subtitle' ? <Languages size={17}/> : <Film size={17}/>}</div><div className="asset-meta"><b>{a.name}</b><small>{a.type.toUpperCase()} · {a.duration ? `${a.duration.toFixed(1)}s` : 'Thư viện'}</small></div></button>)}</div>
        <div className="storage-foot"><span>Local workspace</span><span>{assets.length} assets</span></div>
      </aside>
      <section className="preview-column">
        <div className="preview-heading"><div><MonitorPlay size={15}/><b>Trình xem trước</b><span className="resolution">1920 × 1080</span></div><div className="preview-tools"><button className="small-icon" title="Thu phóng" onClick={() => setZoom(z => z >= 1.25 ? 0.75 : +(z + 0.1).toFixed(2))}><Plus size={14}/></button><span>{Math.round(zoom * 100)}%</span><button className="small-icon"><Menu size={14}/></button></div></div>
        <div className="preview-stage"><div className="video-frame" style={{ transform: `scale(${zoom})` }}>
          <VideoPlayer src={videoAsset?.url} videoRef={videoRef} onChooseVideo={() => fileRef.current?.click()} onVideoClick={() => setPlaying(p => !p)} />
          {videoAsset?.url && activeSubtitle && <div className="subtitle-overlay" style={{ color: subtitleColor, fontSize: `${fontSize}px` }}>{activeSubtitle.text}</div>}
        </div></div>
        <div className="transport"><div className="time-readout"><span>{formatTime(currentTime)}</span><i>/</i><span>{formatTime(duration)}</span></div><div className="transport-controls"><button className="transport-btn" onClick={() => seekTo(currentTime - 5)}>−5s</button><button className="play-btn" onClick={() => { if (!videoRef.current) return; if (videoRef.current.paused) void videoRef.current.play(); else videoRef.current.pause(); }}>{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button><button className="transport-btn" onClick={() => seekTo(currentTime + 5)}>+5s</button></div><div className="transport-right"><Volume2 size={15}/><input type="range" min="0" max="100" value={audioGain} onChange={e => setAudioGain(Number(e.target.value))}/></div></div>
        <div className="timeline-panel">
          <div className="timeline-toolbar"><div><Layers3 size={15}/><b>Timeline</b><span className="track-badge">{tracks.length} tracks</span></div><div className="timeline-actions"><button className="small-icon" title="Thêm phụ đề" onClick={addCue}><Plus size={15}/></button><button className="small-icon" title="Danh sách" onClick={() => setNotice('Timeline đồng bộ với manifest khi bấm Xuất video.')}><ListMusic size={15}/></button></div></div>
          <div className="timeline-ruler"><div className="ruler-label"/><div className="ruler-track">{Array.from({length: 7}, (_, i) => <span key={i} style={{ left: `${(i / 6) * 100}%` }}>{formatTime(duration * i / 6)}</span>)}</div></div>
          <div className="tracks-area">{tracks.map((track, idx) => <div className="track-row" key={track.id}><div className="track-label"><span className={`track-icon track-${track.kind}`}>{track.kind === 'video' ? <Film size={13}/> : track.kind === 'audio' ? <AudioLines size={13}/> : track.kind === 'subtitle' ? <Subtitles size={13}/> : <Layers3 size={13}/>}</span><span>{track.name}</span><button className="track-menu"><Menu size={12}/></button></div><div className="track-lane" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - rect.left) / rect.width) * duration); }}>
            {track.kind === 'video' && track.clips.map(clip => <button key={clip.id} className="clip video-clip" style={{left:`${(clip.start/Math.max(duration,1))*100}%`,width:`${Math.max(5,(clip.duration/Math.max(duration,1))*100)}%`}} title={clip.name} onClick={event=>{event.stopPropagation();const asset=assets.find(a=>a.id===clip.assetId);if(asset){setSelectedAsset(asset);setPreviewVideoId(asset.id);seekTo(clip.start);}}}><span><Film size={12}/>{clip.name}</span><div className="mini-wave">{Array.from({length:18},(_,i)=><i key={i} style={{height:`${12+(i*17%28)}%`}}/>)}</div></button>)}
            {track.kind === 'subtitle' && cues.map(c => <button key={c.id} className={`clip subtitle-clip ${activeCue === c.id ? 'clip-active' : ''}`} style={{ left: `${(c.start / duration) * 100}%`, width: `${Math.max(3, ((c.end - c.start) / duration) * 100)}%` }} onClick={e => { e.stopPropagation(); setActiveCue(c.id); seekTo(c.start); }} title={c.text}>{c.text}</button>)}
            {track.kind === 'audio' && <div className="audio-lane-note"><AudioLines size={13}/> Âm lượng {audioGain}% · ducking nền dự kiến</div>}
            {track.kind === 'overlay' && (track.clips.length ? track.clips.map(clip=><button key={clip.id} className="clip pip-clip" style={{left:`${(clip.start/Math.max(duration,1))*100}%`,width:`${Math.max(7,(clip.duration/Math.max(duration,1))*100)}%`}} onClick={event=>{event.stopPropagation();setNotice(`Đã chọn PiP: ${clip.name}`);}} title={clip.name}><Layers3 size={11}/>{clip.name}</button>) : <div className="empty-lane">Chọn media rồi thêm PiP / lớp phủ</div>)}
          </div></div>)}<div className="playhead" style={{ left: `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%` }}/></div>
          <div className="timeline-footer"><span>00:00:00:00 · 30 FPS</span><div className="zoom-controls"><button onClick={() => setDuration(d => Math.min(300, d + 10))}>+</button><span>Fit</span><button onClick={() => setDuration(d => Math.max(10, d - 10))}>−</button></div></div>
        </div>
      </section>
      <aside className="inspector-panel"><div className="inspector-head"><b>Inspector</b><span>CHỈNH SỬA</span></div><div className="inspector-tabs"><button className={inspectorTab === 'subtitle' ? 'selected' : ''} onClick={() => setInspectorTab('subtitle')}>Phụ đề</button><button className={inspectorTab === 'video' ? 'selected' : ''} onClick={() => setInspectorTab('video')}>Video</button><button className={inspectorTab === 'audio' ? 'selected' : ''} onClick={() => setInspectorTab('audio')}>Âm thanh</button></div>
        <div className="inspector-content">
          {inspectorTab === 'subtitle' && <><div className="inspector-section"><div className="subsection-title"><Subtitles size={15}/><b>Vietsub</b><button className="small-icon" onClick={addCue}><Plus size={14}/></button></div><SubtitleList cues={cues} activeCueId={activeCue} formatTime={formatTime} onSelect={cue => { setActiveCue(cue.id); seekTo(cue.start); }} /><label className="field-label">Nội dung phụ đề</label><textarea value={cues.find(c => c.id === activeCue)?.text ?? ''} onChange={e => updateCue(activeCue, { text: e.target.value })} rows={3}/><div className="field-row"><label>Vào (s)<input type="number" min="0" step="0.1" value={cues.find(c => c.id === activeCue)?.start ?? 0} onChange={e => updateCue(activeCue, { start: Math.max(0, Number(e.target.value)) })}/></label><label>Ra (s)<input type="number" min="0.1" step="0.1" value={cues.find(c => c.id === activeCue)?.end ?? 2} onChange={e => updateCue(activeCue, { end: Math.max((cues.find(c => c.id === activeCue)?.start ?? 0) + 0.1, Number(e.target.value)) })}/></label></div></div><div className="inspector-section"><div className="subsection-title"><Settings2 size={15}/><b>Kiểu chữ ASS</b></div><div className="field-row"><label>Cỡ chữ<input type="number" min="12" max="80" value={fontSize} onChange={e => setFontSize(Math.max(12, Math.min(80, Number(e.target.value))))}/></label><label>Màu chữ<div className="color-input"><input type="color" value={subtitleColor} onChange={e => setSubtitleColor(e.target.value)}/><span>{subtitleColor.toUpperCase()}</span></div></label></div><div className="style-preview" style={{ color: subtitleColor, fontSize: `${Math.max(12, Math.min(fontSize, 24))}px` }}>Vietsub mẫu</div><p className="helper">Style sẽ được chuyển thành ASS và burn-in ở bước render máy chủ.</p></div></>}
          {inspectorTab === 'video' && <div className="inspector-section"><div className="subsection-title"><Film size={15}/><b>Thuộc tính video</b></div><div className="video-property-card"><div className="property-icon"><MonitorPlay size={20}/></div><b>{videoAsset?.name ?? 'Chưa chọn video'}</b><small>{videoAsset ? 'Video đang được chọn trong timeline' : 'Nhập tệp video để bắt đầu chỉnh sửa.'}</small></div><label className="field-label">Thu phóng canvas <b className="field-value">{Math.round(zoom * 100)}%</b></label><input className="wide-range" type="range" min="0.75" max="1.5" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><div className="field-row"><label>Khung hình<input readOnly value="1920 × 1080"/></label><label>Tốc độ khung<input readOnly value="30 FPS"/></label></div><label className="field-label">Crop / Zoom ({cropZoom.toFixed(2)}×)</label><input className="wide-range" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={event=>setCropZoom(Number(event.target.value))}/><div className="field-row"><label>Fade / transition (s)<input type="number" min="0" max="3" step="0.1" value={transitionDuration} onChange={event=>setTransitionDuration(Math.max(0,Math.min(3,Number(event.target.value))))}/></label><label>PiP width<input type="number" min="0.1" max="0.7" step="0.05" value={pipWidth} onChange={event=>setPipWidth(Math.max(0.1,Math.min(0.7,Number(event.target.value))))}/></label></div><div className="field-row"><label>PiP X (0–1)<input type="number" min="0" max="1" step="0.05" value={pipX} onChange={event=>setPipX(Math.max(0,Math.min(1,Number(event.target.value))))}/></label><label>PiP Y (0–1)<input type="number" min="0" max="1" step="0.05" value={pipY} onChange={event=>setPipY(Math.max(0,Math.min(1,Number(event.target.value))))}/></label></div><button className="secondary-button full" onClick={addSelectedAsPip}><Layers3 size={14}/> Thêm media chọn làm PiP</button><button className="secondary-button full" onClick={addPipKeyframes}><Sparkles size={14}/> Tạo keyframe chuyển động PiP</button></div>}
          {inspectorTab === 'audio' && <div className="inspector-section"><div className="subsection-title"><AudioLines size={15}/><b>Mixer âm thanh</b></div><label className="field-label">Đưa audio nhập mới vào track<select value={audioTargetTrack} onChange={event=>setAudioTargetTrack(event.target.value as 'track-audio'|'track-voice'|'track-tts')}><option value="track-audio">Nhạc nền / BGM</option><option value="track-voice">Voice / thoại</option><option value="track-tts">TTS / lồng tiếng</option></select></label><div className="mixer-line"><div><span>Master / Video</span><b>{audioGain}%</b></div><input type="range" min="0" max="100" value={audioGain} onChange={e => setAudioGain(Number(e.target.value))}/><div className="mixer-meter"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="audio-option"><div><b>Ducking nhạc nền</b><small>Giảm BGM khi có giọng nói / TTS.</small></div><button type="button" role="switch" aria-checked={bgmDucking} className={`toggle-switch ${bgmDucking ? 'on' : ''}`} onClick={() => setBgmDucking(value => !value)}><span/></button></div><p className="helper">Ducking được gửi trong render manifest; worker sẽ giảm BGM khi nhận dạng được track giọng nói/TTS.</p><button className="secondary-button full" disabled={busy} onClick={()=>void transcribeSelected()}><Languages size={14}/> Bóc băng media thành phụ đề</button><p className="helper">Cần WHISPER_API_URL được cấu hình ở server.</p><label className="field-label">Giọng TTS<select value={ttsVoice} onChange={event=>setTtsVoice(event.target.value)}><option value="alloy">Alloy</option><option value="nova">Nova</option><option value="echo">Echo</option><option value="fable">Fable</option><option value="onyx">Onyx</option><option value="shimmer">Shimmer</option></select></label><button className="secondary-button full" disabled={busy||!authToken||!cues.some(cue=>cue.id===activeCue&&cue.text.trim())} onClick={()=>void generateTts()}><Volume2 size={14}/> Tạo TTS cho cue đang chọn</button><p className="helper">Cần TTS_API_URL tương thích OpenAI Audio Speech; audio sẽ được thêm vào track TTS.</p></div>}
        </div><div className="inspector-bottom">{inspectorTab === 'subtitle' && <button className="secondary-button full" disabled={busy} onClick={()=>void translateSubtitles()}><Sparkles size={15}/> Dịch / tinh chỉnh bằng Gemini</button>}{inspectorTab === 'subtitle' && <button className="secondary-button full srt-button" onClick={downloadSubtitles}><FileText size={14}/> Tải phụ đề SRT</button>}</div>
      </aside>
    </StudioWorkspace>
    <footer className="statusbar"><div className="status-left"><span className="status-good"><Check size={12}/></span><span>{notice}</span></div><div className="status-right"><span><Activity size={12}/> {authToken?'Authenticated session':'Local workspace'}</span><span>Hendy Pro · v1.0.0</span></div></footer>
    {showLogin && <div className="studio-auth-backdrop"><form className="studio-auth-card" onSubmit={event=>void signInOrAcceptInvite(event)}><div className="studio-auth-brand"><div className="brand-mark"><ShieldCheck size={20}/></div><div><b>{loginMode==='accept-invite'?'Kích hoạt tài khoản':'Hendy Studio Pro'}</b><small>{loginMode==='accept-invite'?'INVITATION ACCEPTANCE':'SECURE SIGN-IN'}</small></div><button type="button" className="icon-button" aria-label="Đóng" onClick={()=>setShowLogin(false)}><X size={17}/></button></div><p>{loginMode==='accept-invite'?'Thiết lập mật khẩu dài ít nhất 14 ký tự để kích hoạt lời mời.':'Đăng nhập để lưu dự án lên máy chủ, tải media và gửi công việc render.'}</p>{loginMode==='login'&&<label>Email<input type="email" required autoComplete="username" value={loginEmail} onChange={event=>setLoginEmail(event.target.value)} placeholder="admin@example.com"/></label>}<label>{loginMode==='accept-invite'?'Mật khẩu mới':'Mật khẩu'}<input type="password" required minLength={loginMode==='accept-invite'?14:1} autoComplete={loginMode==='accept-invite'?'new-password':'current-password'} value={loginPassword} onChange={event=>setLoginPassword(event.target.value)} placeholder={loginMode==='accept-invite'?'Ít nhất 14 ký tự':'Nhập mật khẩu'}/></label><button className="primary-button full" disabled={loginBusy} type="submit"><LogIn size={15}/>{loginBusy?'Đang xử lý…':loginMode==='accept-invite'?'Kích hoạt tài khoản':'Đăng nhập'}</button>{loginMode==='login'&&<small className="auth-hint">Tài khoản được khởi tạo bằng endpoint admin/bootstrap script. Token phiên được lưu trong sessionStorage của tab hiện tại.</small>}</form></div>}
  </div>;
}
function formatTime(value: number) { const s = Math.max(0, Math.floor(value || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
