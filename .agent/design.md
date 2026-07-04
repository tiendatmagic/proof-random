# Hướng dẫn Thiết kế Giao diện & Hệ thống Style (Design System Specification) - Cafe Blockchain

Tài liệu này đặc tả toàn bộ quy chuẩn thiết kế giao diện UI/UX của dự án **Cafe Blockchain**, áp dụng đồng bộ trên cả 3 phân hệ: **Web POS Admin (Hệ thống quản trị và bán hàng)**, **Blockchain Explorer (Trình khám phá khối nội bộ)**, và **Website Storefront (Cửa hàng công khai dành cho khách hàng)**.

---

## 1. Typography (Phông chữ & Kiểu chữ)

*   **Phông chữ mặc định**: Sử dụng phông chữ **`Quicksand`** (phông chữ sans-serif bo tròn hiện đại, tạo cảm giác thân thiện, trẻ trung và cao cấp).
    *   Tệp phông chữ được tích hợp local (`public/fonts/quicksand/`) để tối ưu tốc độ tải trang và hoạt động offline.
    *   **CSS Variable**: `--font-sans` và `--font-display`.
    *   **Fallback**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
*   **Kích thước & Độ đậm chữ (Font Size & Weight)**:
    *   `text-xs` (12px) / `font-bold` hoặc `font-extrabold`: Dùng cho nhãn phụ, thông tin nhỏ, trạng thái thẻ, badge, text phụ trong giỏ hàng.
    *   `text-sm` (14px) / `font-semibold` hoặc `font-bold`: Dùng cho văn bản nội dung, thông tin bảng biểu, ô nhập liệu (Input), nút bấm nhỏ.
    *   `text-base` (16px) / `font-bold` hoặc `font-black`: Dùng cho tiêu đề sản phẩm, nút thao tác chính (nút đặt hàng, thanh toán), giá tiền.
    *   `text-lg` đến `text-xl` (18px - 20px) / `font-extrabold`: Dùng cho tiêu đề mục, tiêu đề card, tổng tiền ca trực.
    *   `text-2xl` đến `text-3xl` (24px - 30px) / `font-black` hoặc `font-extrabold`: Dùng cho tiêu đề trang lớn, số liệu thống kê doanh thu lớn trên Dashboard/Báo cáo.

---

## 2. Hệ màu sắc Động (Dynamic Color Palette)

Hệ thống sử dụng cơ chế màu sắc động (Dynamic Theme) cho phép chủ cửa hàng tùy chỉnh màu sắc thương hiệu từ trang quản trị.

### 2.1. Màu sắc mặc định thương hiệu DApp (Default Brand Colors)
*   **Màu chủ đạo (Primary Accent)**: **Hồng Neon (`#ff00dd`)** - CSS Variable: `--dynamic-primary`.
*   **Màu phụ trợ (Secondary Accent)**: **Tím Neon (`#8000ff`)** - CSS Variable: `--dynamic-secondary`.
*   **Fallback tĩnh**: Định nghĩa sẵn tại `:root` trong `styles.css` để tránh lỗi mất màu (trong suốt/trắng) khi vừa xóa cache trình duyệt hoặc chưa kết nối ví.

### 2.2. Ánh xạ biến màu Tailwind v4 (Color Mapping)
Các biến dynamic này được biên dịch thành hệ màu chủ đạo của Tailwind CSS v4 thông qua `@theme`:
```css
--color-primary: var(--dynamic-primary, #ff00dd);
--color-secondary: var(--dynamic-secondary, #8000ff);

/* Ghi đè hệ màu purple để các class Tailwind mặc định tự động đổi màu */
--color-purple-50: color-mix(in srgb, var(--color-primary) 5%, white);
--color-purple-100: color-mix(in srgb, var(--color-primary) 12%, white);
--color-purple-400: var(--color-secondary);
--color-purple-500: var(--color-primary);
--color-purple-650: #b000ff; /* Tím Neon đậm nhấn mạnh */
```

### 2.3. Màu nền (Background Colors)
*   **Chế độ Sáng (Light Mode)**:
    *   Nền ứng dụng (Body bg): Slate nhạt (`#f8fafc`).
    *   Nền thẻ (Card bg): Trắng trong suốt hoặc đặc (`bg-white/60` hoặc `bg-white`).
*   **Chế độ Tối (Dark Mode)**:
    *   Nền ứng dụng (Body bg): Gray-950/Slate-950 siêu tối (`#030712`).
    *   Nền thẻ (Card bg): Slate-900 trong suốt hoặc Slate-950 (`bg-slate-900/60` hoặc `bg-slate-950`).

---

## 3. Bố cục & Khung chứa (Layout & Container)

Để giao diện cân đối, nhất quán và tránh bị kéo giãn quá mức trên màn hình lớn (UltraWide):
*   **Chiều rộng tối đa (Max Width Constraint)**: Toàn bộ trang Admin (Dashboard, POS, Menu, Orders, v.v.), trang Blockchain Explorer và trang Storefront đều được bọc trong container giới hạn:
    *   **Class**: `max-w-[1530px] mx-auto w-full px-4 sm:px-6`
    *   Thiết kế này đảm bảo giao diện luôn được căn giữa màn hình và tối ưu hóa diện tích hiển thị.
*   **Cột & Lưới (Grid & Flex System)**:
    *   Sử dụng CSS Grid linh hoạt: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` để hiển thị danh sách thẻ sản phẩm hoặc các thẻ thống kê.
    *   Layout hai cột chính (Sidebar + Nội dung chính): Sidebar rộng `w-64` cố định ở Desktop, chuyển thành Drawer ẩn trên Mobile.
*   **Bố cục biểu mẫu (Form Layout)**:
    *   Tái cấu trúc các trường nhập liệu thành lưới 2 cột trên Desktop (`grid grid-cols-1 md:grid-cols-2 gap-6`) để tối ưu hóa không gian.
    *   Các trường nội dung dài như **Mô tả cửa hàng** phải hiển thị full-width bằng class `md:col-span-2` để đảm bảo độ rộng rãi và dễ nhập liệu.

---

## 4. Bo góc & Đường viền (Border Radius & Borders)

*   **Giới hạn Bo góc tối đa (Border Radius Constraint)**: Để tạo cảm giác hiện đại nhưng gọn gàng, cap tối đa độ bo góc là **`15px`**.
    *   **CSS Variable**: Thiết lập ghi đè các token bo góc của Tailwind v4 trong `styles.css`:
        ```css
        --radius-xl: 15px;
        --radius-2xl: 15px;
        --radius-3xl: 15px;
        --radius-4xl: 15px;
        ```
    *   Các card lớn, popup modal sử dụng `rounded-2xl` hoặc `rounded-3xl` (tương đương `15px`).
    *   Các nút bấm, ô nhập liệu sử dụng `rounded-xl` hoặc `rounded-2xl` (tùy ngữ cảnh).
    *   Ảnh sản phẩm nhỏ sử dụng `rounded-lg` (8px).
*   **Đường viền (Borders)**:
    *   Sử dụng đường viền siêu mảnh, mờ để tạo cảm giác sang trọng (Glassmorphism).
    *   **Chế độ Sáng**: `border border-slate-200/50` hoặc `border-slate-200/40`.
    *   **Chế độ Tối**: `dark:border-slate-800/50` hoặc `dark:border-slate-800/40`.
    *   **Quy tắc loại bỏ Border thừa (Flat design)**: Tránh lạm dụng các đường kẻ phân chia nằm ngang (`border-t`) giữa các tiểu mục hoặc khối cài đặt. Sử dụng khoảng cách trống đồng bộ (`space-y-6`) để tạo sự mạch lạc tự nhiên cho giao diện.

---

## 5. Bóng đổ & Hoạt ảnh (Shadows & Micro-animations)

*   **Bóng đổ (Shadows)**:
    *   Hạn chế sử dụng bóng đen thuần. Thay vào đó, sử dụng bóng có tông màu chủ đạo mờ để tăng tính thẩm mỹ:
        *   `shadow-lg shadow-[var(--dynamic-primary)]/20`
        *   `shadow-md shadow-[var(--dynamic-primary)]/10`
*   **Hoạt ảnh tương tác (Hover & Active States)**:
    *   **Hiệu ứng Hover trên Card/Nút**: Khi rê chuột vào, phóng to nhẹ và tăng độ bóng đổ:
        *   `hover:scale-[1.01]` hoặc `hover:scale-[1.02]`
        *   `hover:shadow-xl hover:shadow-[var(--dynamic-primary)]/30`
        *   `transition-all duration-300`
    *   **Hiệu ứng Click (Active)**: Thu nhỏ nhẹ để phản hồi thao tác bấm:
        *   `active:scale-[0.98]` hoặc `active:scale-95`
    *   **Hiệu ứng Menu**: Mục menu đang kích hoạt (active) dùng nền `bg-purple-50 dark:bg-purple-950/30` kèm chữ đậm màu thương hiệu chính xác (`!text-purple-600 !dark:text-purple-400`).

---

## 6. Các thành phần giao diện đặc trưng (UI Components)

### 6.1. Thiết kế Kính mờ (Glassmorphism Banner/Card)
Áp dụng cho các banner nhắc nhở kết nối ví, thông tin trạng thái:
*   **CSS Class**: `bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-lg`

### 6.2. Lớp nền (Backdrop Overlay) cho Modal và Drawer
Để tạo sự tập trung trực quan và tính nhất quán, tất cả các lớp nền (backdrop/overlay) khi hiển thị modal hoặc drawer trên toàn bộ hệ thống phải tuân theo quy tắc:
*   **Màu sắc**: Sử dụng tông màu tối nhẹ thống nhất `bg-black/40`.
*   **Hiệu ứng mờ (Blur)**: Tuyệt đối không sử dụng các hiệu ứng làm mờ nền (loại bỏ hoàn toàn các class `backdrop-blur-*`). Điều này giúp giao diện trở nên đơn giản, nhất quán và không bị phân tán tài nguyên xử lý đồ họa trên các thiết bị cấu hình yếu.

### 6.3. Kiến trúc Modal Động & Quy tắc Lược bỏ Animation
Để tối ưu hóa tốc độ tải trang, đơn giản hóa DOM và cải thiện trải nghiệm người dùng:
*   **Kiến trúc Dynamic Modal**: Tất cả modal phải được thiết kế và gọi động thông qua `ModalService` và component wrapper (`modal-wrapper.component`), loại bỏ hoàn toàn các thẻ HTML modal tĩnh nhúng cứng trong các module.
*   **Kích thước Modal Chi tiết**: Sử dụng tham số `size="5xl"` hoặc `size="4xl"` (`max-w-4xl` hoặc `max-w-5xl`) cho các modal nhiều thông tin (như Chi tiết đơn hàng) để giữ bố cục 2 cột song song không bị nén dọc trên Desktop.
*   **Chính sách không animation (No-Animation Policy)**: Loại bỏ hoàn toàn các class hiệu ứng chuyển động (`animate-in`, `fade-in`, `zoom-in-95`, `duration-150`, `duration-200`...) trên phần content modal. Modal phải hiển thị tức thì ngay khi được gọi để tạo phản hồi nhanh nhất.

### 6.4. Nút bấm (Buttons)
*   **Nút chính (Primary Button)**: Sử dụng gradient chuyển màu từ màu chủ đạo sang màu phụ trợ:
    *   `bg-gradient-to-r from-[var(--dynamic-primary)] to-[var(--dynamic-secondary)] text-white font-extrabold`
    *   Có bóng đổ màu tương ứng: `shadow-md shadow-[var(--dynamic-primary)]/20`
*   **Nút phụ (Secondary/Outline Button)**: Nền trong suốt hoặc mờ, viền màu chủ đạo mảnh:
    *   `bg-[var(--dynamic-primary)]/10 text-[var(--dynamic-primary)] border border-[var(--dynamic-primary)]/15`

### 6.5. Bộ chọn nhóm / Tab Group cao cấp (`<app-tab-group>`)
*   Sử dụng component `<app-tab-group>` dùng chung của hệ thống cho tất cả các giao diện nút lựa chọn/toggle (như chọn Loại khách hàng, chọn Giới tính, chọn Trạng thái...).
*   Loại bỏ các nút bấm toggle thủ công tự chế bằng div để đảm bảo tính đồng nhất về kích thước, padding, font-weight và màu sắc kích hoạt (active).

### 6.6. Bộ chọn ngày cao cấp (Premium Date Pickers)
*   Không sử dụng giao diện lịch mặc định thô của trình duyệt.
*   Thiết kế khung bọc có icon Lịch (`SVG`), bo góc `rounded-xl`, viền mảnh. Khi click vào sẽ hiển thị lịch động đồng bộ màu sắc thương hiệu.

### 6.7. Bộ tải khung giả lập (Skeleton Loaders)
*   Sử dụng component dùng chung `<app-skeleton-loader>` hỗ trợ 5 kiểu bố cục:
    *   `dashboard`: Giả lập các thẻ thống kê số liệu và khung biểu đồ.
    *   `reports`: Giả lập cấu trúc báo cáo chi tiết bao gồm biểu đồ tròn conic-gradient và biểu đồ cột.
    *   `table`: Giả lập các hàng dữ liệu bảng biểu.
    *   `card-grid`: Giả lập mạng lưới các thẻ sản phẩm.
    *   `form`: Giả lập các ô nhập liệu cấu hình.
*   Hiệu ứng chuyển động quét mượt mà: `animate-pulse-slow` (chu kỳ xung mạch 3 giây).

### 6.8. Biểu tượng (Icons)
*   **Quy định nghiêm ngặt**: Không sử dụng emoji thô (như ☕, 🛒, 💵, 🏦, v.v.).
*   **Thay thế**: Sử dụng 100% các biểu tượng vector **inline SVG** có màu sắc đồng bộ (`text-[var(--dynamic-primary)]` hoặc `text-slate-400`).

### 6.9. Chuyển đổi giao diện (Theme Toggler)
*   Bộ chuyển đổi 3 vị trí (Pill theme toggler 3-position) hỗ trợ: **Sáng (Light) / Tối (Dark) / Tự động (Auto)**.
*   Được đặt cố định ở góc dưới cùng của Sidebar điều hướng.

### 6.10. Trục Timeline Lịch sử Công nợ (Sổ nợ)
*   **Bố cục**: Sử dụng container cha có padding-left `pl-7` (28px) và đường viền trái `border-l-2` làm trục vẽ.
*   **Chấm tròn hiển thị**: Chấm tròn có đường kính `w-6.5` (26px, bán kính 13px). Để tâm của chấm tròn nằm chính xác trên trục vẽ, chấm tròn được định vị `absolute` với class `-left-[41px]` (được tính bằng `pl-7` + bán kính `13px` = 41px dịch về phía trái).

### 6.11. Cấu hình Toast Alert Progress Bar (Global Scope Rule)
*   Tất cả mã CSS liên quan đến hoạt ảnh Toast (`toastProgress`, `toastSlideIn`, `.toast-progress-success`, `.toast-animate`) phải được cấu hình hoàn toàn trong tệp phong cách toàn cục `styles.css`.
*   Tránh đưa các class này vào tệp styles nội bộ (`app.css` hoặc các component-scoped stylesheet) nhằm phá vỡ cơ chế View Encapsulation của Angular, giúp hoạt ảnh tiến trình thanh Toast hoạt động chính xác trên mọi component.

### 6.12. Angular Custom Component Host Display (CRITICAL)
*   Tất cả các Angular custom component độc lập (như `app-custom-switch`, `app-custom-select`, `app-custom-date-picker`...) phải cấu hình rõ ràng `:host { display: block; }` trong tệp CSS tương ứng.
*   Thiết lập này giúp trình duyệt không hiểu nhầm component là `display: inline` mặc định, từ đó đảm bảo các class margin/padding dọc của Tailwind hoạt động chính xác, ngăn chặn hiện tượng dính chữ hoặc dính nhãn biểu mẫu kề cận.

---

## 7. Quy tắc thiết kế đặc thù cho từng trang

### 7.1. Trang quản trị POS Admin
*   **Sidebar**: Cố định bên trái. Các biểu tượng SVG hiển thị sắc nét. Nút chọn ví hiển thị địa chỉ ví rút gọn (ví dụ: `0x12a3...4b5c`) kèm logo mạng lưới (Ethereum/Polygon/Sepolia).
*   **Đồng bộ hóa giao diện các trang mục menu (Khách hàng, Sổ nợ, Báo cáo, Đơn hàng, v.v.)**:
    *   **Tiêu đề & Container**: Bọc trong container `max-w-[1530px] mx-auto w-full p-4 sm:p-6 space-y-6`. Tiêu đề chính sử dụng thẻ `h3` cỡ `text-2xl font-extrabold text-slate-800 dark:text-white`, phụ đề cỡ `text-sm text-slate-500`. Không sử dụng tiêu đề cỡ nhỏ `text-xl` hoặc gạch dưới header làm mất cân đối.
    *   **Thanh tìm kiếm (Search Input)**: Đồng bộ kích thước nhập liệu `py-2.5 px-4 rounded-xl text-sm bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 focus:border-[var(--dynamic-primary)] transition-all font-semibold`. Không sử dụng padding dọc nhỏ hơn `py-2.5` hay font size quá nhỏ. Định vị icon tìm kiếm SVG absolute ở `top-3 left-3`.
    *   **Bảng dữ liệu (Tables)**:
        *   Đầu bảng (thead): Cỡ chữ `text-xs font-bold text-slate-400 uppercase tracking-wider pl-6`.
        *   Mã khách hàng/đối tượng: Định dạng `text-xs font-mono font-bold text-[var(--dynamic-primary)]`.
        *   Tên khách hàng: Tích hợp hiển thị avatar tròn chứa chữ cái đầu tiên (ví dụ: `(item.name || '').substring(0, 1) | uppercase`) kết hợp chữ đậm `text-sm font-extrabold text-slate-800 dark:text-white` để tăng tính thẩm mỹ đồng bộ.
        *   Các nút bấm thao tác trong bảng: Cỡ chữ `text-xs font-bold px-3 py-1.5 rounded-lg border` để đảm bảo vừa mắt và dễ click.
    *   **Drawer chi tiết (Sider)**:
        *   *Hiệu ứng chuyển động*: Không sử dụng `@if` bao bọc trực tiếp ở thẻ ngoài cùng vì sẽ hủy DOM ngay lập tức khi đóng, làm đứt hoạt ảnh transition. Thay vào đó, giữ Drawer luôn tồn tại trong DOM và ẩn/hiện bằng Tailwind transition kết hợp các class `translate-x-full` / `opacity-0` / `pointer-events-none` và `duration-300 ease-out`.
        *   *Kích thước chữ & Nút*: Tiêu đề Drawer đạt `text-lg font-extrabold text-slate-900 dark:text-white`, phụ đề `text-sm`, nút bấm chính trong Drawer đạt `text-xs py-2.5 px-4 font-bold rounded-xl`.
*   **Màn hình POS (Bán hàng)**:
    *   Cột trái: Phân trang danh sách sản phẩm (20 sản phẩm/trang), có bộ lọc danh mục ngang và thanh tìm kiếm real-time.
    *   Cột phải: Giỏ hàng dạng Drawer kèm input ghi chú riêng cho từng món. Nút "Xác nhận đặt đơn" cao `h-12` màu gradient tím nổi bật.

### 7.2. Trình khám phá khối (Blockchain Explorer)
*   Thiết kế đậm chất Web3 công nghệ cao.
*   Các thẻ hiển thị thông số khối (Block Height, Gas Used, Transactions Count) bo góc tròn `15px`, sử dụng nền Glassmorphism.
*   Bảng lịch sử giao dịch hiển thị mã băm giao dịch (Tx Hash) rút gọn, click vào sẽ mở link trực tiếp trên Etherscan/Polygonscan tương ứng.

### 7.3. Website Storefront (Trang đặt món công khai)
*   **Ảnh bìa (Cover Image)**: Chiều cao động `h-48 sm:h-64` hiển thị banner quán hoặc gradient màu tím mặc định nếu chưa cài đặt ảnh bìa.
*   **Bộ lọc danh mục**: Cố định bên trái (Desktop) hoặc thanh trượt ngang mượt mà (Mobile).
*   **Grid/List Toggle**: Nút chuyển đổi giao diện hiển thị danh sách sản phẩm dạng lưới (2-3 cột) hoặc dạng hàng dọc (List) tiện lợi trên di động.
*   **Giỏ hàng & Yêu thích**: Lưu trữ trực tiếp tại `localStorage` phía client-side để khách hàng không cần kết nối ví/đăng nhập vẫn có thể thêm món và đặt hàng nhanh.
