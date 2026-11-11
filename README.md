# Confessions Trường THCS & THPT Ngã Sáu

Ứng dụng PWA dùng HTML5, Tailwind CSS CDN, JavaScript thuần và Supabase JS v2 CDN.

## 1. Cấu trúc dự án

```text
confessions-nga-sau/
├── index.html
├── auth.html
├── admin.html
├── app.js
├── styles.css
├── sw.js
├── manifest.json
├── schema.sql
└── assets/
    └── icon.svg
```

## 2. Tạo Supabase project và chạy SQL

1. Truy cập https://supabase.com/ và đăng nhập.
2. Chọn **New project**, đặt tên project, mật khẩu database và khu vực phù hợp.
3. Chờ project khởi tạo xong, mở **SQL Editor** ở thanh bên.
4. Chọn **New query**.
5. Mở file `schema.sql` trong VS Code, sao chép toàn bộ nội dung, dán vào SQL Editor.
6. Nhấn **Run**. Kiểm tra tab kết quả không có lỗi.
7. Vào **Authentication → Providers → Email** để bật Email provider. Nếu muốn thử nghiệm nhanh, có thể tắt Confirm email trong môi trường thử nghiệm; khi triển khai thật nên bật xác nhận email.
8. Vào **Table Editor** để kiểm tra các bảng `profiles`, `confessions`, `comments`, `reactions`.

### Tạo tài khoản quản trị viên đầu tiên

1. Mở ứng dụng, vào trang Đăng ký và tạo một tài khoản bằng email của bạn.
2. Nếu bật xác nhận email, xác nhận email rồi đăng nhập.
3. Trong Supabase → **SQL Editor**, chạy lệnh dưới đây và thay email bằng email tài khoản của bạn:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Không cung cấp chức năng tự nâng quyền admin ở giao diện người dùng. Chỉ người có quyền SQL trong Supabase mới nên thay đổi role.

## 3. Lấy URL và anon key

1. Trong Supabase Dashboard, mở **Project Settings → API** (một số giao diện mới hiển thị **Project Settings → API Keys**).
2. Sao chép **Project URL**.
3. Sao chép **anon / publishable key** (không phải `service_role` hoặc secret key).
4. Mở `app.js`, tìm hai dòng đầu:

```js
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
```

5. Dán thông tin vừa sao chép vào hai chuỗi này và lưu file.

**Cảnh báo:** `anon/publishable key` được thiết kế để dùng ở frontend cùng RLS. Tuyệt đối không đưa `service_role` key hoặc database password vào `app.js`, GitHub Pages hay bất kỳ mã nguồn công khai nào.

## 4. Chạy thử bằng VS Code + Live Server

1. Cài Visual Studio Code.
2. Chọn **File → Open Folder...** và mở thư mục `confessions-nga-sau`.
3. Cài extension **Live Server** (Ritwick Dey) trong Extensions.
4. Mở `index.html`, nhấn **Go Live** ở góc dưới VS Code.
5. Trình duyệt sẽ mở địa chỉ dạng `http://127.0.0.1:5500`.
6. Thử đăng ký tài khoản, đăng nhập, gửi confession.
7. Cấp quyền admin cho một tài khoản bằng SQL như bước 2, đăng nhập tài khoản đó rồi mở `admin.html`.
8. Chọn một hoặc nhiều bài và bấm **Duyệt (X) bài đã chọn**. Số thứ tự được cấp liên tiếp trong ngày theo giờ Việt Nam.

## 5. Cách hoạt động

- Đăng ký: Supabase Auth tạo user; trigger `on_auth_user_created` tự tạo `profiles`.
- Gửi confession: frontend gọi RPC `submit_confession`. Server tự lấy tên/email từ profile, không tin dữ liệu danh tính do trình duyệt gửi lên.
- Công khai: client chỉ được đọc các cột công khai của confession đã duyệt.
- Admin: `admin_pending_confessions()` kiểm tra role và trả thông tin người gửi cho admin.
- Duyệt hàng loạt: `admin_approve_confessions(uuid[])` dùng transaction + advisory lock để tránh trùng số khi có nhiều admin thao tác gần nhau. Ngày đăng tính theo `Asia/Ho_Chi_Minh`; số thứ tự tiếp tục từ số lớn nhất trong ngày, qua ngày mới tự về 1.
- Bình luận: bảng `comments_with_author` cung cấp họ tên/email người bình luận cho người dùng đã đăng nhập. Reply hỗ trợ một cấp trả lời dưới bình luận gốc.
- Reactions: mỗi tài khoản có tối đa một reaction cho mỗi confession; chọn reaction khác sẽ đổi loại cảm xúc.

## 6. PWA và triển khai

- Service worker chỉ đăng ký trên HTTPS hoặc localhost. Live Server dùng localhost nên có thể thử được.
- Khi đưa lên hosting thật, dùng HTTPS (ví dụ GitHub Pages, Netlify hoặc Vercel).
- `manifest.json` dùng icon SVG. Một số thiết bị/iOS cũ có thể yêu cầu icon PNG 192x192 và 512x512; nếu biểu tượng không hiện đúng, bổ sung hai file PNG và cập nhật `manifest.json` (nên dùng PNG vuông, nền đặc).
- Offline cache chỉ lưu app shell và tài nguyên cùng origin. Supabase Auth/API cần Internet; gửi bài, bình luận, reaction và tải feed không hoạt động offline.
- Sau khi thay đổi file, tăng `CACHE_NAME` trong `sw.js` (ví dụ `confessions-nga-sau-v2`) để người dùng nhận cache mới.

## 7. Lưu ý bảo mật và vận hành

- RLS phải được bật; không tắt RLS để “sửa lỗi” truy cập.
- Không cho user tự cập nhật `profiles.role`. Muốn thêm admin, thao tác bằng Dashboard/SQL có kiểm soát.
- Không công khai bảng `profiles`. View `comments_with_author` chỉ hiển thị thông tin người đã bình luận trên bài đã duyệt.
- Email của người bình luận được hiển thị theo yêu cầu sản phẩm. Đây là dữ liệu cá nhân: hãy thông báo rõ cho người dùng trước khi họ bình luận và chỉ vận hành trong phạm vi được nhà trường cho phép.
- Nên có quy định nội dung, cơ chế báo cáo/xử lý nội dung vi phạm và người phụ trách kiểm duyệt. Đặc biệt cần sự đồng ý, hướng dẫn và giám sát phù hợp nếu có học sinh chưa đủ 18 tuổi.
- Các CDN (Tailwind và Supabase JS) cần Internet khi tải lần đầu; để offline hoàn toàn cần đóng gói các thư viện vào project và điều chỉnh cache.
- Bản mẫu chưa có chống spam nâng cao, CAPTCHA, giới hạn tốc độ, quên mật khẩu, chỉnh sửa hồ sơ hay công cụ báo cáo bài viết. Nên bổ sung trước khi triển khai công khai quy mô lớn.
