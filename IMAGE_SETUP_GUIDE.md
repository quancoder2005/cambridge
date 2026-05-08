# Hướng dẫn sử dụng ảnh thay cho PDF

## 📁 Cấu trúc thư mục

Đặt ảnh vào thư mục con của `assets/png_jpg/` theo test:
```
assets/png_jpg/
├── test1/
├── test2/
├── test3/
├── ...
└── test10/
```

## 📝 Cách đặt tên ảnh

Sử dụng pattern: `{section}-test{test}-{n}.png` trong mỗi thư mục test

### Ví dụ:
- Reading Test 1 (trong `assets/png_jpg/test1/`):
  - `reading-test1-1.png` (ảnh 1)
  - `reading-test1-2.png` (ảnh 2)
  - `reading-test1-3.png` (ảnh 3)
  - ...

- Listening Test 2 (trong `assets/png_jpg/test2/`):
  - `listening-test2-1.png`
  - `listening-test2-2.png`
  - ...

- Writing Test 3 (trong `assets/png_jpg/test3/`):
  - `writing-test3-1.png`
  - `writing-test3-2.png`
  - ...

- Speaking Test 1 (trong `assets/png_jpg/test1/`):
  - `speaking-test1-1.png`
  - `speaking-test1-2.png`
  - ...

## 🎯 Các section được hỗ trợ

- `reading` - Reading tests
- `listening` - Listening tests
- `writing` - Writing tests
- `speaking` - Speaking tests

## 🔧 Tính năng image viewer

Ứng dụng sẽ tự động:
1. Tìm kiếm tất cả ảnh theo pattern
2. Hiển thị ảnh chính giữa màn hình
3. Cung cấp các nút điều khiển:
   - **‹ Prev** - Quay lại ảnh trước
   - **Next ›** - Sang ảnh tiếp theo
   - **Fit** - Fit ảnh vào màn hình
4. Hiển thị thumbnails ở dưới để dễ chọn ảnh

## 📌 Ghi chú quan trọng

1. **Format ảnh**: Hỗ trợ `.png` (có thể mở rộng thành `.jpg`, `.webp`)
2. **Cấu trúc**: Mỗi test (test1 đến test10) có thư mục riêng
3. **Đặt tên chính xác**: Phải khớp pattern `{section}-test{test}-{n}.png`
4. **Thứ tự số**: Bắt đầu từ `-1`, `-2`, `-3`... (không bắt đầu từ `-0`)
5. **Live Server**: Chạy trên Live Server để tránh lỗi CORS
6. **Gaps**: Có thể bỏ qua số thứ tự (ví dụ: 1, 2, 4 - không có 3)

## 🚀 Bắt đầu

1. Tạo folder `assets/png_jpg/` nếu chưa có
2. Tạo các thư mục con: `test1/`, `test2/`, ..., `test10/`
3. Đặt ảnh vào thư mục test tương ứng với tên theo pattern đúng
4. Mở ứng dụng bằng Live Server
5. Chọn test từ dropdown - ảnh sẽ tự động tải từ thư mục test tương ứng

## ❓ Troubleshooting

- **Ảnh không tải?**
  - Kiểm tra tên file có khớp pattern không
  - Đảm bảo file trong thư mục `assets/png_jpg/test{n}/`
  - Mở DevTools (F12) để xem lỗi

- **Một số ảnh bị lỗi?**
  - Kiểm tra định dạng file (phải là PNG)
  - Đảm bảo file không bị corrupt
  - Thử chuyển sang JPG (cần cập nhật pattern nếu cần)
