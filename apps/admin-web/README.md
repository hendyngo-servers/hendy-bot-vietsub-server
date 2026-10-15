# Hendy Admin Web — Control Plane

React 19 + Vite frontend dành riêng cho quản trị hệ thống. Giao diện hiện có:

- Overview và health check trực tiếp qua `GET /health`.
- Quản lý người dùng/RBAC demo, render queue, storage, Cloudflare Edge và feature flags.
- Tìm kiếm theo trang, tải JSON report, invite modal demo và điều hướng responsive.
- Cảnh báo rõ dữ liệu demo và những lớp server-side security còn phải cấu hình.

## Chạy local

Từ thư mục gốc monorepo:

```bash
npm install
npm run dev:admin
```

Mặc định Vite chạy tại `http://localhost:5174`. Đặt `VITE_API_BASE_URL` thành origin API nếu không dùng proxy development.

> Đây là frontend control plane. Tạo người dùng, thay đổi vai trò và feature flags trong bản hiện tại chỉ thay đổi state của giao diện; cần nối với API đã xác thực/RBAC trước khi dùng production.
