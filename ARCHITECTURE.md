# Cafe Blockchain - Tài Liệu Đặc Tả Kiến Trúc Hệ Thống (ARCHITECTURE.md)

Tài liệu này đặc tả chi tiết kiến trúc hiện tại của dự án **Cafe Blockchain** (cả Backend và Frontend) nhằm phục vụ các AI Agent và lập trình viên phát triển hệ thống một cách nhất quán, tuân thủ đúng các mô hình thiết kế đã thiết lập.

---

## 🏗️ 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG
Hệ thống là một ứng dụng quản lý bán hàng (POS) tích hợp ví Web3 và tặng voucher dạng NFT trên blockchain, gồm 3 khối chính:
1.  **Backend (Laravel API):** Áp dụng Domain-Driven Design (DDD) lai, CQRS (Command Bus), Event-Driven Architecture (bất đồng bộ) và cơ chế xác thực HttpOnly Cookie bảo mật.
2.  **Frontend (Angular Workspace Monorepo):** Gồm ứng dụng Admin POS (SPA) gốc và ứng dụng Storefront (SSR) nằm dưới thư mục `projects/storefront/`, tổ chức theo các tính năng phẳng (Flat Features) và quản lý State bằng Slice Stores (Signals).
3.  **Solidity Smart Contracts:** Quản lý giao dịch on-chain, đúc voucher NFT, sổ nợ và sổ thu chi tài chính trên EVM chain.

---

## 🖥️ 2. KIẾN TRÚC BACKEND (Laravel API)
Backend nằm tại thư mục `cafe-blockchain-api/`, được chia thành các lớp cách ly theo nguyên lý DDD để tách biệt nghiệp vụ khỏi cơ sở dữ liệu.

### A. Cấu trúc thư mục lõi (`app/`)
```text
app/
├── Domain/                         # LỚP NGHIỆP VỤ (Chứa Business Rules thuần túy)
│   ├── Entities/                   # Plain Old PHP Objects (POPOs) - KHÔNG kế thừa Eloquent Model
│   ├── Events/                     # Các sự kiện Domain (ví dụ: OrderCompletedEvent)
│   ├── Listeners/                  # Bộ xử lý sự kiện (kế thừa ShouldQueue để xử lý nền)
│   └── Repositories/               # Khai báo các Interface của kho lưu trữ (Domain Contracts)
│
├── Infrastructure/                 # LỚP HẠ TẦNG (Tương tác với DB, Queue, Blockchain)
│   ├── Persistence/
│   │   ├── Eloquent/               # Eloquent Models thực tế (kết nối DB)
│   │   ├── Mappers/                # Ánh xạ qua lại giữa Domain Entity POPO và Eloquent Model
│   │   └── Repositories/           # Cài đặt thực tế các Interface Repositories của Domain
│
├── Application/                    # LỚP ỨNG DỤNG (Điều phối và thực thi nghiệp vụ)
│   ├── Common/Bus/                 # Command Bus (CQRS Dispatcher)
│   ├── Services/                   # Các Business Services nghiệp vụ độc lập (ví dụ: ShiftReconciliationService)
│   └── [Feature]/                  # Chứa Commands, Queries và các Handlers tương ứng
│
└── Http/                           # LỚP GIAO TIẾP (API Controllers, Requests, Middleware)
    ├── Controllers/                # Controllers (Chỉ nhận Request, gọi Service hoặc Command Bus và trả Response)
    ├── Requests/                   # LỚP XÁC THỰC (Form Requests validation độc lập)
    └── Middleware/                 # Các Middleware lọc yêu cầu (ví dụ: cookie-based auth, check feature)
```

### B. Quy tắc lập trình Backend
1.  **Data Mapper Pattern (Bắt buộc với thực thể nghiệp vụ):**
    *   **Domain Entity:** Phải là POPO độc lập (ví dụ: [Order.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Domain/Entities/Order.php)). Không được import hay sử dụng Eloquent/DB behaviors bên trong Domain.
    *   **Eloquent Model:** Nằm dưới lớp `Infrastructure` (ví dụ: [OrderModel.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Infrastructure/Persistence/Eloquent/OrderModel.php)) chịu trách nhiệm định nghĩa schema DB, casts, và relations.
    *   **Mapper:** Sử dụng Mapper (ví dụ: [OrderMapper.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Infrastructure/Persistence/Mappers/OrderMapper.php)) để ánh xạ kiểu dữ liệu khi lưu/truy vấn qua Repository.
2.  **Form Request Validation độc lập (Bắt buộc):**
    *   Tuyệt đối không sử dụng `$request->validate(...)` thủ công trực tiếp bên trong Controller.
    *   Mọi yêu cầu thêm/sửa dữ liệu phải tạo một lớp `FormRequest` kế thừa từ `Illuminate\Foundation\Http\FormRequest` (ví dụ: [OpenShiftRequest.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Http/Requests/OpenShiftRequest.php)) để quản lý luật validation tách biệt.
3.  **Tách biệt Service nghiệp vụ (SRP - Single Responsibility Principle):**
    *   Các logic tính toán số liệu tài chính phức tạp, đối soát tiền mặt hoặc kết két ca trực không được viết trong Controller.
    *   Phải chuyển các logic tính toán nghiệp vụ này ra lớp Service độc lập (ví dụ: [ShiftReconciliationService.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Application/Services/ShiftReconciliationService.php)). Controller chỉ đóng vai trò nhận request, inject Service qua Constructor, gọi Service xử lý và trả Response JSON.
4.  **Command Bus & CQRS:**
    *   Mọi logic thay đổi trạng thái nghiệp vụ cốt lõi (như Ghi nhận đơn hàng, cập nhật kho) phải đóng gói vào một **Command**. Mọi logic đọc dữ liệu đóng gói vào một **Query**.
    *   Controller dùng `$this->commandBus->dispatch($command)`.
5.  **Xử lý bất đồng bộ (Domain Events & Queue):**
    *   Các tác vụ nặng liên quan đến blockchain (đúc NFT, đồng bộ giao dịch) hoặc gửi email/notif **phải** được tách ra thành Event Listener thực thi qua hàng đợi.
    *   Listener phải implements `ShouldQueue` để chạy ngầm (ví dụ: [MintVoucherGiftListener.php](file:///d:/git/cafe-blockchain/cafe-blockchain-api/app/Domain/Listeners/MintVoucherGiftListener.php)).
6.  **Bảo mật Token Xác thực:**
    *   JWT Token được lưu trữ bằng cookie `auth_token` cấu hình `HttpOnly`, `Secure` và `SameSite` tùy theo môi trường để chống tấn công XSS.
    *   Một cookie bổ trợ `auth_logged_in` (không HttpOnly) được cấp song song để hỗ trợ frontend nhận biết nhanh trạng thái đăng nhập của ví mà không cần gọi API check.
7.  **API Versioning:**
    *   Nhóm các API route trong `routes/api.php` thành `/api/v1/...` và `/api/v2/...` để đảm bảo khả năng tương thích ngược khi nâng cấp hệ thống.

---

## 🎨 3. KIẾN TRÚC FRONTEND (Angular Monorepo)
Frontend nằm tại thư mục `cafe-blockchain-web/`, cấu trúc theo dạng Angular Workspace hỗ trợ Monorepo đa ứng dụng.

### A. Cấu trúc thư mục Frontend
```text
cafe-blockchain-web/
├── angular.json                    # Cấu hình build của 2 project (cafe-blockchain-web & storefront)
├── tsconfig.json                   # Khai báo Path Aliases toàn cục
├── src/                            # ỨNG DỤNG CHÍNH (Admin POS - SPA) & Thư viện dùng chung
│   ├── main.ts                     # Điểm chạy SPA POS
│   └── app/
│       ├── core/                   # Các dịch vụ Singleton (ApiService, Web3Service, StateService...)
│       ├── shared/                 # Các UI component, pipes, layout dùng chung của hệ thống
│       │   ├── components/         # IconComponent, CustomSelectComponent, SkeletonLoaderComponent...
│       │   └── layout/sidebar/     # Sidebar định hướng dùng chung
│       └── features/               # Cấu trúc PHẲNG của các tính năng (Flat Features)
│           ├── dashboard/          # Trang chủ Dashboard
│           ├── pos/                # Màn hình POS bán hàng (menu, orders, debts, tables...)
│           ├── reports/            # Báo cáo tổng quan của chủ quán
│           ├── customers/          # Quản lý khách hàng
│           ├── financials/         # Quản lý thu chi tài chính
│           ├── staffs/             # Quản lý nhân viên và vai trò
│           ├── settings/           # Thiết lập cấu hình quán
│           ├── blockchain/         # Trình khám phá giao dịch onchain
│           └── storefront/         # StoreComponent (chứa giao diện gọi món cho khách)
│
└── projects/                       # THƯ MỤC CHỨA CÁC ỨNG DỤNG PHỤ
    └── storefront/                 # ỨNG DỤNG STOREFRONT (Hỗ trợ Angular SSR)
        ├── src/
        │   ├── main.ts                 # Điểm chạy client-side
        │   ├── main.server.ts          # Điểm chạy server-side (Angular SSR)
        │   └── app/                    # Shell cấu hình định tuyến và config SSR của Storefront
```

### B. Quy tắc lập trình Frontend
1.  **Sử dụng Path Aliases (Tránh tương đối):**
    *   Tuyệt đối không dùng relative path dài dòng (ví dụ: `../../../../core/services`).
    *   Phải sử dụng các alias được cấu hình sẵn trong `tsconfig.json`:
        *   `@core/*` -> trỏ tới `src/app/core/*`
        *   `@shared/*` -> trỏ tới `src/app/shared/*`
        *   `@features/*` -> trỏ tới `src/app/features/*`
        *   `@environments/*` -> trỏ tới `src/environments/*`
2.  **Làm phẳng tính năng (Flat Features):**
    *   Tất cả các module chức năng chính phải được đặt phẳng ngang hàng dưới thư mục `src/app/features/` (ví dụ: `features/customers`, `features/staffs`). Không lồng chúng vào các thư mục `pages` hoặc lồng bên trong thư mục tính năng khác.
3.  **Quản lý trạng thái bằng Slice Stores (Signals):**
    *   Không khai báo trực tiếp toàn bộ dữ liệu ứng dụng trong một file `StateService` khổng lồ.
    *   Chia nhỏ thành các store tín hiệu nằm trực tiếp trong thư mục tính năng tương ứng bao gồm: `OrderStore`, `SettingStore`, `ShiftStore`, `DebtStore`, `InventoryStore`, `CustomerStore`, `CartStore`, `ProductStore`, `TransactionStore`, `TableStore`, `StaffStore`, `DashboardStore`, và `PriceStore`.
    *   `StateService` đóng vai trò là một **Facade Pattern** - tiêm các Slice Store này vào và expose (hoặc ủy thác tham chiếu trực tiếp) các signal/method của chúng ra ngoài để giữ khả năng tương thích ngược 100% mà không làm gãy code cũ của các component con.
4.  **Tách biệt Toast Notifications & Loading ra Component độc lập:**
    *   Giao diện Toast phức tạp hoặc màn hình loading hệ thống không được code trực tiếp trong file root template `app.html`.
    *   Trích xuất giao diện Toast ra thành component standalone độc lập như [ToastComponent](file:///d:/git/cafe-blockchain/cafe-blockchain-web/src/app/shared/components/toast/toast.component.ts) để giữ cho tệp root layout `app.html` tinh gọn và sạch sẽ nhất (dưới 65 dòng).
5.  **Tách biệt Monorepo POS và Storefront:**
    *   Ứng dụng `storefront` nằm trong `projects/storefront` được thiết kế phục vụ khách hàng, bật chế độ render phía máy chủ (SSR).
    *   Ứng dụng storefront import trực tiếp giao diện `StoreComponent` từ thư viện dùng chung `@features/storefront` để tránh sao chép code.
    *   Tuyệt đối không import bất kỳ component quản trị nào (như `settings`, `reports`, `staffs`) vào ứng dụng `storefront` nhằm giữ bundle size nhẹ nhất cho khách hàng.
6.  **Thiết kế Giao diện (UI/UX) và Custom Component:**
    *   **Màu sắc chủ đạo:** Tông màu hồng Neon (`#ff00dd`) và tím Neon (`#8000ff`). Sử dụng các biến CSS động `--dynamic-primary` và `--dynamic-secondary`.
    *   **Bo góc:** Giới hạn bo góc tối đa của các khung, thẻ và nút là `15px` (ghi đè `--radius-xl` thành `15px`).
    *   **SVG Icons:** Không sử dụng Emoji thô trong giao diện. Sử dụng component `<app-icon>` hoặc inline SVG chất lượng cao, responsive.
    *   **Angular Host Display (Quan trọng):** Tất cả các component tự định nghĩa (ví dụ: `app-custom-switch`, `app-custom-select`) phải thiết lập `:host { display: block; }` trong CSS để tránh trình duyệt coi chúng là thẻ inline, làm vỡ khoảng cách margin/spacing.
