import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Boxes, Check, ChevronDown,
  CircleHelp, Cloud, Database, Download, ExternalLink, FileVideo, Filter, Gauge,
  HardDrive, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus,
  RefreshCw, Search, Server, Settings, ShieldCheck, SlidersHorizontal, Users,
  Video, Wifi, X, Zap,
} from 'lucide-react';

type Section = 'overview' | 'users' | 'queue' | 'storage' | 'edge' | 'settings';
type Health = { status?: string; uptime?: number; services?: Record<string, boolean> };
type UserRow = { id: string; name: string; email: string; role: 'Owner' | 'Admin' | 'Editor' | 'Viewer'; status: 'Active' | 'Invited' | 'Suspended'; initials: string };
type JobRow = { id: string; title: string; owner: string; status: 'Rendering' | 'Queued' | 'Completed' | 'Failed'; progress: number; time: string };

const ENV = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string; VITE_REQUIRE_AUTH?: string } }).env ?? {};
const API_BASE = (ENV.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const REQUIRE_AUTH = ENV.VITE_REQUIRE_AUTH === 'true';
const SESSION_KEY = 'hendy-admin-session';
function storedToken() { try { return sessionStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; } }
function adminFetch(path: string, init: RequestInit = {}, token = storedToken()) { const headers = new Headers(init.headers); headers.set('accept', 'application/json'); if (token) headers.set('authorization', `Bearer ${token}`); return fetch(`${API_BASE}${path}`, { ...init, headers }); }
function formatRelativeTime(value: string | number | Date | undefined) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); return mins < 1 ? 'Vừa xong' : mins < 60 ? `${mins} phút trước` : mins < 1440 ? `${Math.floor(mins / 60)} giờ trước` : date.toLocaleDateString(); }
function displayRole(roles: unknown): UserRow['role'] { const role = Array.isArray(roles) ? String(roles[0] ?? 'viewer') : String(roles ?? 'viewer'); return ({ owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' } as Record<string, UserRow['role']>)[role.toLowerCase()] ?? 'Viewer'; }
function displayStatus(status: unknown): UserRow['status'] { const value = String(status ?? '').toLowerCase(); return value === 'active' ? 'Active' : value === 'invited' ? 'Invited' : 'Suspended'; }
function mapJob(raw: Record<string, unknown>): JobRow { const status = String(raw.status ?? 'queued').toLowerCase(); const display: JobRow['status'] = status === 'completed' ? 'Completed' : status === 'failed' || status === 'cancelled' ? 'Failed' : status === 'active' || status === 'rendering' ? 'Rendering' : 'Queued'; return { id: String(raw.id ?? '—'), title: String(raw.title ?? raw.projectId ?? 'Render job'), owner: String(raw.owner ?? '—'), status: display, progress: Math.max(0, Math.min(100, Number(raw.progress ?? 0))), time: formatRelativeTime(raw.createdAt as string | number | Date | undefined) }; }

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng & RBAC', icon: Users },
  { id: 'queue', label: 'Hàng đợi Vietsub', icon: Video },
  { id: 'storage', label: 'Dữ liệu & Storage', icon: Database },
  { id: 'edge', label: 'Cloudflare Edge', icon: Cloud },
  { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings },
];
const seedUsers: UserRow[] = [
  { id: 'usr-001', name: 'Nguyễn Minh Anh', email: 'minhanh@example.com', role: 'Admin', status: 'Active', initials: 'MA' },
  { id: 'usr-002', name: 'Trần Gia Huy', email: 'giahuy@example.com', role: 'Editor', status: 'Active', initials: 'GH' },
  { id: 'usr-003', name: 'Lê Phương Linh', email: 'linh@example.com', role: 'Editor', status: 'Invited', initials: 'PL' },
  { id: 'usr-004', name: 'Demo Viewer', email: 'viewer@example.com', role: 'Viewer', status: 'Suspended', initials: 'DV' },
];
const seedJobs: JobRow[] = [
  { id: 'JOB-2074', title: 'Tập 03 · Vietsub bản nháp', owner: 'Gia Huy', status: 'Rendering', progress: 68, time: 'Vừa xong' },
  { id: 'JOB-2073', title: 'Trailer mùa hè 2026', owner: 'Minh Anh', status: 'Queued', progress: 0, time: '2 phút trước' },
  { id: 'JOB-2072', title: 'Phỏng vấn khách mời', owner: 'Phương Linh', status: 'Completed', progress: 100, time: '8 phút trước' },
  { id: 'JOB-2071', title: 'Video giới thiệu sản phẩm', owner: 'Minh Anh', status: 'Failed', progress: 42, time: '16 phút trước' },
];
const pageCopy: Record<Section, { title: string; subtitle: string }> = {
  overview: { title: 'Tổng quan hệ thống', subtitle: 'Theo dõi trạng thái dịch vụ, tài nguyên và hoạt động xử lý video.' },
  users: { title: 'Người dùng & RBAC', subtitle: 'Quản lý thành viên, vai trò và trạng thái tài khoản trong control plane.' },
  queue: { title: 'Hàng đợi Vietsub', subtitle: 'Quan sát các công việc render và xử lý phụ đề.' },
  storage: { title: 'Dữ liệu & Storage', subtitle: 'Tình trạng các lớp lưu trữ và database adapters.' },
  edge: { title: 'Cloudflare Edge', subtitle: 'Theo dõi edge gateway, worker và cấu hình triển khai.' },
  settings: { title: 'Cấu hình hệ thống', subtitle: 'Feature flags và thiết lập vận hành của Hendy Studio.' },
};

export default function AdminApp() {
  const [section, setSection] = useState<Section>('overview');
  const [health, setHealth] = useState<Health>({ status: 'checking' });
  const [healthError, setHealthError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState(seedUsers);
  const [jobs, setJobs] = useState(seedJobs);
  const [authToken, setAuthToken] = useState(storedToken);
  const [showLogin, setShowLogin] = useState(() => REQUIRE_AUTH && !storedToken());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [liveSummary, setLiveSummary] = useState<Record<string, unknown> | null>(null);
  const [toast, setToast] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRow['role']>('Editor');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({ aiTranslation: true, renderQueue: true, cloudflareEdge: false, maintenanceMode: false });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await adminFetch('/health', { headers: { accept: 'application/json' } });
      const value = (await response.json()) as Health;
      if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
      setHealth(value); setHealthError('');
    } catch (error) {
      setHealth({ status: 'offline' }); setHealthError(error instanceof Error ? error.message : 'Không thể kết nối API');
      setRefreshing(false); return;
    }
    if (authToken) {
      try {
        const endpoints = ['/api/v1/admin/summary', '/api/v1/admin/users', '/api/v1/admin/jobs', '/api/v1/admin/feature-flags'];
        const responses = await Promise.all(endpoints.map(path => adminFetch(path, {}, authToken)));
        if (responses.some(response => response.status === 401 || response.status === 403)) {
          sessionStorage.removeItem(SESSION_KEY); setAuthToken(''); setShowLogin(true); setToast('Phiên hết hạn hoặc tài khoản không có quyền quản trị.');
          setRefreshing(false); return;
        }
        if (responses.every(response => response.ok)) {
          const [summary, userBody, jobBody, flagBody] = await Promise.all(responses.map(response => response.json()));
          setLiveSummary(summary);
          setUsers(((userBody.users ?? []) as Record<string, unknown>[]).map(user => { const name=String(user.name ?? user.displayName ?? user.email ?? 'User'); return {id:String(user.id),name,email:String(user.email ?? ''),role:displayRole(user.roles ?? user.role),status:displayStatus(user.status),initials:name.split(/\s+/).slice(-2).map(part=>part[0]??'').join('').toUpperCase()}; }));
          setJobs(((jobBody.jobs ?? []) as Record<string, unknown>[]).map(mapJob));
          const rawFlags = flagBody.flags ?? {};
          const nextFlags: Record<string, boolean> = Array.isArray(rawFlags) ? Object.fromEntries(rawFlags.map((flag: {key:string;enabled:boolean})=>[flag.key,Boolean(flag.enabled)])) : Object.fromEntries(Object.entries(rawFlags as Record<string, unknown>).map(([key,value])=>[key,typeof value==='object'&&value!==null&&'enabled' in value?Boolean((value as {enabled:boolean}).enabled):Boolean(value)]));
          setFlags(current => ({...current,...nextFlags}));
        } else {
          const failed = responses.find(response => !response.ok);
          if (failed) setToast(`Không tải được dữ liệu quản trị: HTTP ${failed.status}`);
        }
      } catch (error) { setToast(error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị'); }
    }
    setRefreshing(false);
  }, [authToken]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredUsers = useMemo(() => users.filter(user => `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const filteredJobs = useMemo(() => jobs.filter(job => `${job.id} ${job.title} ${job.owner} ${job.status}`.toLowerCase().includes(search.toLowerCase())), [jobs, search]);
  const isHealthy = health.status === 'ok' || health.status === 'healthy';

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = inviteName.trim(); const email = inviteEmail.trim();
    if (!name || !email) return;
    if (!authToken) { setToast('Cần đăng nhập quản trị để mời thành viên.'); setShowLogin(true); return; }
    try {
      const response = await adminFetch('/api/v1/admin/users', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({displayName:name,email,role:inviteRole.toLowerCase()==='owner'?'admin':inviteRole.toLowerCase()}) }, authToken);
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setSection('users'); setSearch(''); setShowInvite(false); setInviteName(''); setInviteEmail('');
      setToast(`Đã tạo lời mời cho ${email}. ${body.emailStatus==='sent' ? 'Email mời đã được gửi.' : body.emailStatus==='failed' ? `Gửi email thất bại; hãy sao chép liên kết dự phòng: ${body.invitationUrl ?? ''}` : `SMTP chưa cấu hình; hãy sao chép liên kết: ${body.invitationUrl ?? ''}`}`); await refresh();
    } catch (error) { setToast(error instanceof Error ? error.message : 'Không tạo được lời mời'); }
  }

  async function changeUserRole(id: string, role: UserRow['role']) {
    if (!authToken) { setToast('Cần đăng nhập quản trị để đổi vai trò.'); setShowLogin(true); return; }
    try { const response = await adminFetch(`/api/v1/admin/users/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({role:role.toLowerCase()==='owner'?'admin':role.toLowerCase()})},authToken); const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`); setToast('Đã cập nhật vai trò.'); await refresh(); }
    catch(error){setToast(error instanceof Error?error.message:'Không cập nhật được vai trò');}
  }

  async function changeUserStatus(id: string, current: UserRow['status']) {
    if (!authToken) { setToast('Cần đăng nhập quản trị để thay đổi trạng thái.'); setShowLogin(true); return; }
    const status = current === 'Suspended' ? 'active' : 'suspended';
    try { const response=await adminFetch(`/api/v1/admin/users/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status})},authToken); const body=await response.json(); if(!response.ok) throw new Error(body.error??`HTTP ${response.status}`); setToast('Đã cập nhật trạng thái tài khoản.'); await refresh(); }
    catch(error){setToast(error instanceof Error?error.message:'Không cập nhật được trạng thái');}
  }

  async function changeFlag(key: string, value: boolean) {
    const previous=flags[key]; setFlags(current=>({...current,[key]:value}));
    if(!authToken){setFlags(current=>({...current,[key]:previous}));setToast('Cần đăng nhập quản trị để thay đổi feature flag.');setShowLogin(true);return;}
    try { const response=await adminFetch(`/api/v1/admin/feature-flags/${encodeURIComponent(key)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:value})},authToken); const body=await response.json(); if(!response.ok)throw new Error(body.error??`HTTP ${response.status}`); setToast(`Feature flag ${key}: ${value?'bật':'tắt'}`); }
    catch(error){setFlags(current=>({...current,[key]:previous}));setToast(error instanceof Error?error.message:'Không cập nhật được feature flag');}
  }

  async function loginAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginBusy(true);
    try { const response=await adminFetch('/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:loginEmail,password:loginPassword})},''); const body=await response.json(); if(!response.ok)throw new Error(body.error??`HTTP ${response.status}`); if(!body.user?.roles?.includes('admin'))throw new Error('Tài khoản không có quyền admin.'); sessionStorage.setItem(SESSION_KEY,body.token); setAuthToken(body.token); setShowLogin(false);setLoginPassword('');setToast(`Đã đăng nhập ${body.user.email}`); }
    catch(error){setToast(error instanceof Error?error.message:'Đăng nhập thất bại');}
    finally{setLoginBusy(false);}
  }
  function logoutAdmin(){sessionStorage.removeItem(SESSION_KEY);setAuthToken('');setLiveSummary(null);setShowLogin(true);setUsers(seedUsers);setJobs(seedJobs);setToast('Đã đăng xuất.');}


  function downloadReport() {
    const report = { generatedAt: new Date().toISOString(), apiHealth: health, users, jobs, featureFlags: flags, summary: liveSummary, source: authToken ? 'admin-api' : 'demo', note: authToken ? 'Exported from current admin session.' : 'Unauthenticated UI demo data; not a production audit export.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'hendy-admin-report.json'; link.click(); URL.revokeObjectURL(url);
    setToast('Đã xuất báo cáo JSON từ dữ liệu giao diện hiện tại.');
  }

  return <div className="admin-app">
    <aside className={`admin-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
      <div className="admin-brand"><div className="brand-symbol">H<span>.</span></div><div className="brand-wordmark">HENDY <b>CONTROL</b><small>ADMIN CONSOLE · V1</small></div><button className="sidebar-close" aria-label="Đóng menu" onClick={() => setMobileNavOpen(false)}><X size={17}/></button></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="admin-nav" aria-label="Điều hướng quản trị">{navItems.map(item => {
        const Icon = item.icon;
        return <button key={item.id} className={section === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(item.id); setMobileNavOpen(false); setSearch(''); }}><Icon size={17}/><span>{item.label}</span>{item.id === 'queue' && <i className="nav-count">4</i>}</button>;
      })}</nav>
      <div className="sidebar-spacer"/>
      <div className="side-health"><div className="side-health-head"><span className={`online-dot ${isHealthy ? 'ok' : ''}`}/><b>{isHealthy ? 'API đang hoạt động' : health.status === 'checking' ? 'Đang kiểm tra API' : 'API chưa kết nối'}</b><span className="side-health-light"/></div><p>{healthError || 'Gateway · Health check'}</p><button onClick={() => void refresh()}><RefreshCw size={13}/> Kiểm tra lại</button></div>
      <div className="side-profile"><div className="profile-avatar">HD</div><div><b>Hendy Operator</b><small>System administrator</small></div><button aria-label="Tùy chọn tài khoản" onClick={() => setToast('Thông tin tài khoản sẽ được nối với hệ thống xác thực.')}><MoreHorizontal size={18}/></button></div>
    </aside>
    {mobileNavOpen && <button className="nav-backdrop" aria-label="Đóng điều hướng" onClick={() => setMobileNavOpen(false)}/>}

    <main className="admin-content">
      <header className="admin-topbar">
        <div className="topbar-left"><button className="mobile-menu" aria-label="Mở menu" onClick={() => setMobileNavOpen(true)}><Menu size={19}/></button><span className="breadcrumb">HENDY STUDIO <span>/</span> <b>{navItems.find(item => item.id === section)?.label.toUpperCase()}</b></span></div>
        <div className="topbar-actions"><label className="admin-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kiếm…" aria-label="Tìm kiếm trong trang"/><kbd>⌘ K</kbd></label><button className="top-icon" aria-label="Thông báo" onClick={() => setToast('Bạn đã xem tất cả thông báo mới.')}><Bell size={17}/><i/></button><span className="top-divider"/><button className="top-user" onClick={logoutAdmin} title="Đăng xuất"><div className="profile-avatar small">{authToken?'OP':'HD'}</div><span>{authToken?'Đăng xuất':'Đăng nhập'}</span><ChevronDown size={14}/></button></div>
      </header>

      <div className="page-container">
        <section className="page-heading"><div><div className="eyebrow">CONTROL PLANE <span>•</span> {section.toUpperCase()}</div><h1>{pageCopy[section].title}</h1><p>{pageCopy[section].subtitle}</p></div><div className="heading-actions"><span className="last-updated"><span className="online-dot"/> Live health check</span><button className="button-secondary" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={14} className={refreshing ? 'spin' : ''}/> Làm mới</button><button className="button-primary" onClick={section === 'users' ? () => setShowInvite(true) : downloadReport}>{section === 'users' ? <><Plus size={15}/> Mời người dùng</> : <><Download size={14}/> Xuất báo cáo</>}</button></div></section>
        {!authToken && <div className="demo-notice"><div className="notice-icon"><ShieldCheck size={17}/></div><div><b>Chế độ xem hạn chế</b><p>Dữ liệu mẫu chỉ để xem giao diện. Đăng nhập tài khoản có role admin để đọc và quản lý dữ liệu thật từ backend.</p></div><button onClick={() => setShowLogin(true)}><LogOut size={16}/></button></div>}

        {section === 'overview' && <Overview health={health} isHealthy={isHealthy} users={users} jobs={jobs} summary={liveSummary} live={Boolean(authToken)} onSection={setSection} onExport={downloadReport}/>}
        {section === 'users' && <UsersPage users={filteredUsers} onInvite={() => setShowInvite(true)} onRoleChange={(id, role) => { void changeUserRole(id, role); }} onStatusChange={(id) => { void changeUserStatus(id, users.find(user => user.id === id)?.status ?? 'Active'); }}/ >}
        {section === 'queue' && <QueuePage jobs={filteredJobs} onRefresh={() => { void refresh(); setToast(authToken ? 'Đã làm mới dữ liệu từ API.' : 'Đã kiểm tra API. Đăng nhập admin để xem hàng đợi thật.'); }}/ >}
        {section === 'storage' && <StoragePage health={health} summary={liveSummary} />}
        {section === 'edge' && <EdgePage />}
        {section === 'settings' && <SettingsPage flags={flags} onChange={(key, value) => void changeFlag(String(key), value)}/ >}
      </div>
      <footer className="admin-footer"><span>© 2026 Hendy Video Studio Pro</span><span><span className="online-dot"/> Admin plane <b>v0.1.0</b></span><a href="https://github.com/ngogiaidy56-eng" target="_blank" rel="noreferrer">GitHub <ExternalLink size={12}/></a></footer>
    </main>

    {showInvite && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowInvite(false); }}><form className="invite-modal" onSubmit={inviteUser}><div className="modal-heading"><div><span className="eyebrow">USER MANAGEMENT</span><h2>Mời thành viên</h2><p>Tạo lời mời có thời hạn 72 giờ. Liên kết sẽ được trả về sau khi lưu vào database.</p></div><button type="button" className="top-icon" aria-label="Đóng" onClick={() => setShowInvite(false)}><X size={18}/></button></div><label>Họ và tên<input autoFocus required value={inviteName} onChange={event => setInviteName(event.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh"/></label><label>Email<input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@company.com"/></label><label>Vai trò<select value={inviteRole} onChange={event => setInviteRole(event.target.value as UserRow['role'])}><option>Admin</option><option>Editor</option><option>Viewer</option><option>Owner</option></select></label><div className="modal-note"><LockKeyhole size={14}/> Khi cấu hình SMTP, hệ thống tự gửi email. Nếu chưa cấu hình, liên kết mời sẽ được hiển thị để sao chép.</div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowInvite(false)}>Hủy</button><button className="button-primary" type="submit"><Plus size={14}/> Tạo lời mời</button></div></form></div>}
    {showLogin && <div className="admin-auth-backdrop"><form className="admin-auth-card" onSubmit={event=>void loginAdmin(event)}><div className="admin-auth-logo"><ShieldCheck size={22}/></div><span className="eyebrow">HENDY CONTROL PLANE</span><h2>Đăng nhập quản trị</h2><p>Yêu cầu tài khoản đang hoạt động có vai trò admin.</p><label>Email<input autoFocus type="email" required autoComplete="username" value={loginEmail} onChange={event=>setLoginEmail(event.target.value)} placeholder="admin@example.com"/></label><label>Mật khẩu<input type="password" required autoComplete="current-password" value={loginPassword} onChange={event=>setLoginPassword(event.target.value)} placeholder="Mật khẩu quản trị"/></label><button className="button-primary" type="submit" disabled={loginBusy}><LogOut size={15}/>{loginBusy?'Đang xác thực…':'Đăng nhập an toàn'}</button><small>Phiên được giữ trong sessionStorage của tab; API vẫn kiểm tra quyền cho từng request.</small></form></div>}
    {toast && <div className="toast-message" role="status"><Check size={16}/>{toast}<button aria-label="Đóng thông báo" onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>;
}

function Overview({ health, isHealthy, users, jobs, summary, live, onSection, onExport }: { health: Health; isHealthy: boolean; users: UserRow[]; jobs: JobRow[]; summary: Record<string, unknown> | null; live: boolean; onSection: (section: Section) => void; onExport: () => void }) {
  const activeUsers = users.filter(user => user.status === 'Active').length;
  const runningJobs = jobs.filter(job => job.status === 'Rendering' || job.status === 'Queued').length;
  return <>
    <section className="metric-grid">
      <Metric icon={<Activity/>} label="API Gateway" value={isHealthy ? 'Online' : health.status === 'checking' ? 'Checking' : 'Offline'} trend={isHealthy ? 'Đang phản hồi' : 'Cần kiểm tra kết nối'} tone={isHealthy ? 'green' : 'amber'} foot="GET /health · dữ liệu live"/>
      <Metric icon={<Users/>} label="Người dùng đang hoạt động" value={String(activeUsers).padStart(2, '0')} trend={live?'Dữ liệu PostgreSQL':'Chưa đăng nhập'} tone="violet" foot={`${users.length} tài khoản ${live?'từ API':'mẫu'}`}/>
      <Metric icon={<Zap/>} label="Render queue" value={String(runningJobs).padStart(2, '0')} trend={live?'Dữ liệu render jobs':'Dữ liệu mẫu'} tone="blue" foot={`${jobs.length} jobs ${live?'từ API':'demo'}`}/>
      <Metric icon={<Gauge/>} label="API uptime" value={health.uptime ? `${Math.floor(health.uptime / 60)}m` : '—'} trend="Thời gian tiến trình" tone="green" foot="Kể từ lần khởi động hiện tại"/>
    </section>
    <section className="overview-grid">
      <article className="panel usage-panel"><PanelHeading title="Hoạt động xử lý" detail={live?'Job list từ backend · biểu đồ cần metrics time-series':'Biểu đồ minh họa · đăng nhập để xem job thật'} action={<button className="link-button" onClick={() => onSection('queue')}>Xem hàng đợi <ArrowRight size={14}/></button>}/><div className="chart-summary"><div><b>Render activity</b><span><i className="chart-legend"/> Số job minh họa</span></div><select aria-label="Khoảng thời gian" defaultValue="7 ngày"><option>7 ngày</option><option>30 ngày</option></select></div><div className="chart-wrap"><svg viewBox="0 0 620 220" role="img" aria-label="Biểu đồ hoạt động minh họa" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9681ff" stopOpacity=".28"/><stop offset="100%" stopColor="#9681ff" stopOpacity="0"/></linearGradient></defs>{[25,70,115,160,205].map(y => <line key={y} x1="22" y1={y} x2="610" y2={y} stroke="#2d303b" strokeDasharray="4 5"/>)}<path d="M22 162 C55 145 57 155 92 130 S140 148 176 100 S222 121 260 105 S306 135 344 79 S394 104 430 63 S480 95 516 43 S574 72 610 34 L610 205 L22 205Z" fill="url(#chartFill)"/><path d="M22 162 C55 145 57 155 92 130 S140 148 176 100 S222 121 260 105 S306 135 344 79 S394 104 430 63 S480 95 516 43 S574 72 610 34" fill="none" stroke="#9c89ff" strokeWidth="3" strokeLinecap="round"/>{[22,108,194,280,366,452,538,610].map((x,i) => <circle key={x} cx={x} cy={[162,124,114,106,88,70,53,34][i]} r="3.5" fill="#b4a8ff" stroke="#171920" strokeWidth="2"/>)}</svg><div className="chart-days"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div></div><div className="chart-foot"><span><span className="online-dot"/> {live?'Phiên quản trị đang xác thực':'Dữ liệu minh họa'}</span><span>{live?'Time-series metrics chưa có endpoint':'Metrics API chưa được nối'}</span></div></article>
      <article className="panel health-panel"><PanelHeading title="Tình trạng dịch vụ" detail="Kiểm tra kết nối và trạng thái tích hợp"/><ServiceLine icon={<Server/>} title="Express API Gateway" description={health.status ? `/health · ${health.status}` : '/health · chưa rõ'} status={isHealthy ? 'Online' : health.status === 'checking' ? 'Checking' : 'Offline'} tone={isHealthy ? 'green' : 'amber'}/><ServiceLine icon={<Database/>} title="PostgreSQL" description="RBAC / audit adapter" status={health.services?.postgres?'Online':'Unknown'} tone={health.services?.postgres?'green':'gray'}/><ServiceLine icon={<Boxes/>} title="Redis + BullMQ" description="Job queue worker" status={health.services?.redis?'Online':'Unknown'} tone={health.services?.redis?'green':'gray'}/><ServiceLine icon={<Cloud/>} title="Cloudflare R2" description="Object storage configuration" status={health.services?.objectStorage?'Configured':'Local disk fallback'} tone={health.services?.objectStorage?'green':'gray'}/><ServiceLine icon={<Cloud/>} title="Cloudflare Edge" description="Worker deployment" status="Not verified" tone="amber"/><button className="button-secondary wide-button" onClick={onExport}><Download size={14}/> Xuất báo cáo trạng thái</button></article>
    </section>
    <section className="panel jobs-panel"><PanelHeading title="Hoạt động gần đây" detail={live?'Công việc đọc từ API render jobs':'Công việc mẫu · đăng nhập để xem API'} action={<button className="link-button" onClick={() => onSection('queue')}>Mở hàng đợi <ArrowRight size={14}/></button>}/><JobsTable jobs={jobs.slice(0, 4)}/></section>
    <section className="quick-links"><button onClick={() => onSection('users')}><div className="quick-icon violet"><Users size={18}/></div><span><b>Quản lý tài khoản</b><small>Vai trò và trạng thái</small></span><ArrowUpRight size={16}/></button><button onClick={() => onSection('storage')}><div className="quick-icon blue"><HardDrive size={18}/></div><span><b>Kiểm tra lưu trữ</b><small>Database và media bucket</small></span><ArrowUpRight size={16}/></button><button onClick={() => onSection('settings')}><div className="quick-icon amber"><SlidersHorizontal size={18}/></div><span><b>Feature flags</b><small>Bật / tắt module</small></span><ArrowUpRight size={16}/></button></section>
  </>;
}

function Metric({ icon, label, value, trend, tone, foot }: { icon: ReactNode; label: string; value: string; trend: string; tone: string; foot: string }) {
  return <article className="metric-card"><div className="metric-head"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><MoreHorizontal size={17} className="metric-more"/></div><div className="metric-value">{value}</div><div className={`metric-trend ${tone}`}>{tone === 'green' ? <ArrowUpRight size={13}/> : tone === 'amber' ? <ArrowDownRight size={13}/> : <Activity size={13}/>} {trend}</div><div className="metric-foot">{foot}</div></article>;
}
function PanelHeading({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="panel-heading"><div><h2>{title}</h2><p>{detail}</p></div>{action}</div>; }
function ServiceLine({ icon, title, description, status, tone }: { icon: ReactNode; title: string; description: string; status: string; tone: string }) { return <div className="service-line"><span className="service-symbol">{icon}</span><div className="service-copy"><b>{title}</b><small>{description}</small></div><span className={`status-label ${tone}`}>{status}</span></div>; }

function JobsTable({ jobs }: { jobs: JobRow[] }) {
  return <div className="table-scroll"><table className="admin-table"><thead><tr><th>JOB</th><th>TÊN CÔNG VIỆC</th><th>NGƯỜI TẠO</th><th>TRẠNG THÁI</th><th>TIẾN ĐỘ</th><th>THỜI GIAN</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td className="id-cell">{job.id}</td><td><div className="job-title"><span className="job-file"><FileVideo size={15}/></span><b>{job.title}</b></div></td><td>{job.owner}</td><td><span className={`job-status ${job.status.toLowerCase()}`}><i/>{job.status === 'Rendering' ? 'Đang render' : job.status === 'Queued' ? 'Đang chờ' : job.status === 'Completed' ? 'Hoàn tất' : 'Thất bại'}</span></td><td><div className="progress-cell"><span><i style={{ width: `${job.progress}%` }}/></span><small>{job.progress}%</small></div></td><td className="muted-cell">{job.time}</td></tr>)}</tbody></table></div>;
}
function UsersPage({ users, onInvite, onRoleChange, onStatusChange }: { users: UserRow[]; onInvite: () => void; onRoleChange: (id: string, role: UserRow['role']) => void; onStatusChange: (id: string) => void }) {
  return <section className="panel page-panel"><PanelHeading title="Danh sách thành viên" detail={`${users.length} kết quả · ${users.some(user=>user.id.startsWith('usr-'))?'chưa đăng nhập — dữ liệu demo':'API / PostgreSQL'}`} action={<button className="button-secondary" onClick={onInvite}><Plus size={14}/> Thêm thành viên</button>}/><div className="table-scroll"><table className="admin-table users-table"><thead><tr><th>THÀNH VIÊN</th><th>ID</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>HÀNH ĐỘNG</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><div className="user-cell"><span className="user-avatar">{user.initials}</span><span><b>{user.name}</b><small>{user.email}</small></span></div></td><td className="id-cell">{user.id}</td><td><select className="table-select" value={user.role} onChange={event => onRoleChange(user.id, event.target.value as UserRow['role'])} aria-label={`Vai trò của ${user.name}`}><option>Owner</option><option>Admin</option><option>Editor</option><option>Viewer</option></select></td><td><span className={`user-status ${user.status.toLowerCase()}`}><i/>{user.status === 'Active' ? 'Đang hoạt động' : user.status === 'Invited' ? 'Đang chờ mời' : 'Tạm khóa'}</span></td><td><button className="text-action" onClick={() => onStatusChange(user.id)}>{user.status === 'Suspended' ? 'Mở khóa' : 'Tạm khóa'}</button></td></tr>)}</tbody></table>{users.length === 0 && <div className="empty-state">Không tìm thấy người dùng phù hợp.</div>}</div></section>;
}
function QueuePage({ jobs, onRefresh }: { jobs: JobRow[]; onRefresh: () => void }) {
  return <section className="panel page-panel"><PanelHeading title="Render jobs" detail={`${jobs.some(job=>job.id.startsWith('JOB-'))?'Snapshot minh họa':'Job list API / PostgreSQL'}`} action={<button className="button-secondary" onClick={onRefresh}><RefreshCw size={14}/> Kiểm tra API</button>}/><div className="queue-summary"><div><span>Đang xử lý</span><b>{jobs.filter(job => job.status === 'Rendering').length}</b></div><div><span>Đang chờ</span><b>{jobs.filter(job => job.status === 'Queued').length}</b></div><div><span>Hoàn tất</span><b>{jobs.filter(job => job.status === 'Completed').length}</b></div><div><span>Thất bại</span><b>{jobs.filter(job => job.status === 'Failed').length}</b></div></div><JobsTable jobs={jobs}/>{jobs.length === 0 && <div className="empty-state">Không có công việc phù hợp với từ khóa tìm kiếm.</div>}</section>;
}
function StoragePage({ health, summary }: { health: Health; summary: Record<string, unknown> | null }) {
  const systems = [
    { title: 'PostgreSQL', tag: 'RBAC · Projects · Jobs · Audit', icon: <Database/>, state: health.services?.postgres ? 'Kết nối' : 'Chưa xác nhận', tone: health.services?.postgres ? 'green' : 'amber', note: health.services?.postgres ? `Persistence: ${String(summary?.persistence ?? 'postgresql')}` : 'Kiểm tra DATABASE_URL và migration' },
    { title: 'MongoDB', tag: 'Project document schema', icon: <Boxes/>, state: 'Schema only', tone: 'amber', note: 'Backend dự án hiện dùng PostgreSQL JSONB; Mongo repository chưa bật' },
    { title: 'Cloudflare R2', tag: 'Media objects · S3 compatible', icon: <Cloud/>, state: health.services?.objectStorage ? 'Đã cấu hình' : 'Local disk fallback', tone: health.services?.objectStorage ? 'green' : 'gray', note: health.services?.objectStorage ? 'Cấu hình endpoint và credentials đã nhận; cần kiểm tra quyền bucket thực tế' : 'Thêm R2_BUCKET, R2_ENDPOINT/account ID, access key và secret' },
  ];
  return <div className="storage-grid">{systems.map(system => <article className="panel storage-card" key={system.title}><div className="storage-card-top"><span className="storage-icon">{system.icon}</span><span className={`status-label ${system.tone}`}>{system.state}</span></div><h2>{system.title}</h2><p>{system.tag}</p><div className="storage-meta"><span>{system.note}</span></div><button className="button-secondary wide-button" onClick={() => window.alert(`${system.title}: ${system.note}`)}><Settings size={14}/> Chi tiết cấu hình</button></article>)}</div>;
}
function EdgePage() {
  const routes = [{ method: 'GET', path: '/health', desc: 'Health check', status: 'API route' }, { method: 'POST', path: '/api/v1/assets', desc: 'Upload media', status: 'API route' }, { method: 'POST', path: '/api/v1/render/manifest', desc: 'Create render job', status: 'API route' }, { method: 'WS', path: '/ws', desc: 'Realtime progress', status: 'Cần xác minh' }];
  return <div className="edge-layout"><article className="panel edge-summary"><div className="edge-hero-icon"><Cloud size={24}/></div><div className="eyebrow">EDGE DEPLOYMENT</div><h2>Cloudflare Workers</h2><p>Khung cấu hình edge đã có trong repository. Chưa xác nhận tài khoản Cloudflare hoặc trạng thái triển khai từ dashboard.</p><div className="edge-status-row"><span className="status-label amber"><i/> Chưa xác minh deploy</span><span className="status-label gray">WAF / cache cần cấu hình</span></div><a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="button-secondary">Mở Cloudflare Dashboard <ExternalLink size={14}/></a></article><article className="panel edge-routes"><PanelHeading title="API route map" detail="Các điểm cuối dự kiến của nền tảng"/><div className="route-list">{routes.map(route => <div className="route-row" key={route.path}><span className={`method ${route.method.toLowerCase()}`}>{route.method}</span><code>{route.path}</code><span>{route.desc}</span><em>{route.status}</em></div>)}</div></article></div>;
}
function SettingsPage({ flags, onChange }: { flags: Record<string, boolean>; onChange: (key: keyof typeof flags, value: boolean) => void }) {
  const options: { key: keyof typeof flags; title: string; description: string; required?: boolean }[] = [
    { key: 'aiTranslation', title: 'AI Vietsub / Translation', description: 'Cho phép giao diện hiển thị luồng dịch phụ đề AI.' },
    { key: 'renderQueue', title: 'Render queue', description: 'Cho phép gửi manifest qua API Gateway và worker.', required: true },
    { key: 'cloudflareEdge', title: 'Cloudflare Edge routing', description: 'Cờ tính năng giao diện; không tự deploy Cloudflare Worker.' },
    { key: 'maintenanceMode', title: 'Maintenance mode', description: 'Hiển thị trạng thái bảo trì trong giao diện quản trị.' },
  ];
  return <section className="panel settings-panel"><PanelHeading title="Feature flags" detail="Toggle được lưu qua API admin khi đã đăng nhập; server tiếp tục kiểm tra quyền mỗi request."/><div className="settings-callout"><LockKeyhole size={16}/><p>Feature flags lưu trong PostgreSQL khi đã đăng nhập. Chúng không thay thế RBAC; mọi route nhạy cảm vẫn được xác thực ở server.</p></div>{options.map(option => <div className="setting-row" key={option.key}><div className="setting-symbol"><SlidersHorizontal size={17}/></div><div className="setting-copy"><b>{option.title}{option.required && <span>CORE</span>}</b><p>{option.description}</p></div><button type="button" role="switch" aria-checked={flags[option.key]} className={`toggle ${flags[option.key] ? 'on' : ''}`} onClick={() => onChange(option.key, !flags[option.key])}><span/></button></div>)}</section>;
}
