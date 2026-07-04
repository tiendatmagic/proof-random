# ProofRandom - Nền tảng Bốc thăm & Quay số ngẫu nhiên minh bạch Blockchain

ProofRandom là một ứng dụng phi tập trung (DApp) hoàn chỉnh giúp tạo các phiên bốc thăm, giveaway và quay số ngẫu nhiên minh bạch 100%, có thể kiểm chứng hoàn toàn bằng công nghệ Blockchain và Chainlink VRF v2.5. 

Ứng dụng hướng tới các sự kiện như Livestream, Giveaway, Hội thảo, Workshop, Trường học, Company Event... **ProofRandom không phải game, không cá cược, không nạp/rút tiền, không Play-to-Earn.** Mục đích duy nhất là bảo chứng tính khách quan của kết quả bằng công nghệ VRF.

---

## 🏗️ Kiến trúc hệ thống và Luồng hoạt động

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Người tạo phiên
    participant FE as Frontend DApp (Angular 22)
    participant BC as Blockchain (Arbitrum)
    participant VRF as Chainlink VRF Coordinator
    actor Participant as Người tham gia / Viewer

    Creator->>FE: Nhập tên phiên, danh sách người, chọn 1 trong 9 chế độ quay
    Creator->>FE: Bấm nút bốc thăm và ký xác nhận giao dịch ví (MetaMask/WalletConnect)
    FE->>BC: Gọi hàm requestDraw(...) gửi transaction
    BC->>VRF: Gửi yêu cầu số ngẫu nhiên requestRandomWords(...)
    BC-->>FE: Trả về requestId & Emit Event DrawCreated (Lưu danh sách người tham gia)
    FE-->>Creator: Chuyển hướng sang trang chi tiết phiên (Trạng thái: Chờ kết quả)
    Note over VRF: Chainlink VRF Oracle sinh số ngẫu nhiên cryptographically secure
    VRF->>BC: Callback rawFulfillRandomWords(requestId, randomWord)
    BC->>BC: Tính toán kết quả bốc thăm deterministic & Lưu on-chain & Emit Event DrawFulfilled
    Note over FE: Frontend tự động polling phát hiện trạng thái fulfilled chuyển thành true
    FE->>Participant: Hiển thị kết quả trúng thưởng (Winner, mã màu, xúc xắc...) kèm Game visual
    Participant->>FE: Nhập requestId tại trang Verify để đối soát kết quả độc lập (Client-side vs On-Chain)
```

---

## 🌟 Các tính năng nổi bật đã triển khai

### 1. 9 Chế độ bốc thăm cốt lõi
* **Random Number**: Quay số ngẫu nhiên trong khoảng tùy chỉnh `Min - Max`.
* **Random Name**: Chọn ngẫu nhiên 1 người từ danh sách tham gia.
* **Multiple Winners**: Chọn danh sách $K$ người chiến thắng không trùng lặp từ danh sách tham gia.
* **Coin Flip**: Lật đồng xu ngẫu nhiên (Heads/Tails).
* **Dice**: Lắc xúc xắc ngẫu nhiên (hỗ trợ 6 mặt hoặc 20 mặt).
* **Even/Odd**: Bốc số chẵn hoặc lẻ ngẫu nhiên.
* **Random Color**: Sinh mã màu HEX ngẫu nhiên trực quan.
* **Random Letter**: Chọn chữ cái ngẫu nhiên từ A đến Z.
* **Random Team**: Tự động chia danh sách người tham gia vào các đội ngẫu nhiên.

### 2. 5 Mini-game trực quan & Hiệu ứng sinh động
Khi thực hiện quay thưởng, người dùng có thể kích hoạt hoặc bỏ qua hiệu ứng trực quan sinh động của các game mô phỏng:
* **Vòng quay may mắn (Lucky Wheel)**: Hiệu ứng quay kim chỉ điểm dừng đẹp mắt.
* **Đua xe kỳ thú (Racing)**: Cuộc đua kịch tính giữa các xe đại diện cho những người tham gia.
* **Hộp quà bí ẩn (Mystery Box)**: Đồ họa vector 3D chi tiết với nơ vàng ruy-băng, mở nắp và bắn pháo hoa lấp lánh (confetti) khi mở ra kết quả.
* **Bầu Cua Tôm Cá**: Lắc 3 viên xúc xắc Bầu Cua truyền thống.
* **Thẻ cào may mắn (Scratch Card)**: Cho phép người dùng di chuột cào lớp phủ để xem kết quả.

### 3. Mô phỏng Xổ số Vietlott chuyên nghiệp
Hỗ trợ đầy đủ 3 chế độ quay xổ số dựa trên số ngẫu nhiên Chainlink VRF:
* **Power 6/55**: Quay chốt 6 quả bóng chính và 1 quả bóng đặc biệt.
* **Mega 6/45**: Quay chốt 6 quả bóng ngẫu nhiên từ 1 đến 45.
* **Keno**: Quay chốt 20 quả bóng và hiển thị bảng highlight số trúng thưởng trực quan.

### 4. Quản lý & Xác minh tối ưu
* **Dashboard Thống kê & Số dư LINK**: Tích hợp card thống kê truy vấn trực tiếp từ Chainlink VRF Coordinator hiển thị **Số dư Oracle (LINK)** và **Subscription ID** giúp Owner kiểm soát quỹ dễ dàng.
* **Tự động nhận diện mạng lưới (Auto Chain-Detection)**: Khi truy cập trực tiếp bằng liên kết chia sẻ hoặc nhập Request ID / Transaction Hash tại trang Xác minh (Verify), dApp sẽ tự động phát hiện xem phiên thuộc mạng **Arbitrum Sepolia** hay **Arbitrum One Mainnet** để tự động chuyển cấu hình RPC mà không cần bắt người dùng chọn mạng thủ công trên ví.
* **Xác minh client-side độc lập**: Khách truy cập có thể chạy lại thuật toán băm (Deterministic Keccak256) trên trình duyệt để đối soát xem kết quả có trùng khớp 100% với kết quả on-chain mà không cần tin tưởng vào máy chủ của dApp.

---

## ⚙️ Hướng dẫn cấu hình Chainlink VRF v2.5

Để DApp hoạt động thực tế trên Testnet/Mainnet, bạn cần liên kết dịch vụ Chainlink VRF v2.5:

1. **Tạo Subscription**:
   - Truy cập trang quản trị [Chainlink VRF Subscription Management](https://vrf.chain.link/).
   - Kết nối ví của bạn và chọn mạng lưới tương ứng (Arbitrum One hoặc Arbitrum Sepolia).
   - Chọn **Create Subscription** và ký giao dịch trên ví.
2. **Nạp quỹ (Fund Subscription)**:
   - Nạp token LINK hoặc Native Token (ETH trên Arbitrum) vào Subscription mới tạo để trả phí sinh số ngẫu nhiên.
3. **Thêm Consumer (Sau khi deploy contract)**:
   - Sau khi deploy contract `ProofRandom` (ở bước dưới), hãy lấy địa chỉ contract đó.
   - Trên giao diện Chainlink Subscription, chọn **Add Consumer**, điền địa chỉ contract `ProofRandom` vừa deploy và ký xác nhận giao dịch ví.

---

## 🚀 Hướng dẫn deploy Smart Contract lên Arbitrum

### 1. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc của dự án `d:\git\proof-random\.env` và cấu hình các thông số sau:

```env
PRIVATE_KEY="địa_chỉ_private_key_ví_deploy_của_bạn"
ARBISCAN_API_KEY="api_key_arbiscan_để_verify_contract"
VRF_SUBSCRIPTION_ID="mã_subscription_id_chainlink_vrf_của_bạn"
```

### 2. Cài đặt và compile contract
Chạy lệnh sau tại thư mục gốc:
```bash
# Cài đặt dependency
npm install

# Biên dịch contract
npm run compile
```

### 3. Deploy lên Arbitrum Sepolia (Testnet)
```bash
npm run deploy:sepolia
```

### 4. Deploy lên Arbitrum One (Mainnet)
```bash
npm run deploy:mainnet
```

### 5. Verify contract trên Arbiscan (để mở tab Read/Write contract công khai)
```bash
npx hardhat verify --network <tên_mạng> <địa_chỉ_contract> "<địa_chỉ_coordinator>" "<subscription_id>" "<key_hash>"
```

---

## 💻 Hướng dẫn chạy local phát triển

### 1. Khởi động nhanh Frontend (Khuyên dùng)
Bạn chỉ cần chạy lệnh sau tại thư mục gốc, hệ thống sẽ tự động di chuyển vào thư mục frontend và kích hoạt dev server:
```bash
npm start
```
Mặc định ứng dụng sẽ chạy tại địa chỉ: `http://localhost:4200`

### 2. Chạy Blockchain Node local & Chạy Test Smart Contract
Để chạy kiểm thử độc lập smart contract local:
```bash
# Chạy toàn bộ Unit Test (bao quát 100% các chế độ quay)
npm run test

# Khởi động local node blockchain giả lập
npx hardhat node
```

### 3. Cập nhật Contract Address trên Frontend sau khi deploy
Cập nhật địa chỉ contract vừa deploy vào file cấu hình [web3.config.ts](file:///d:/git/proof-random/proof-random-web/src/app/core/config/web3.config.ts) để Frontend liên kết chính xác:
```typescript
contracts: {
  arbitrumSepolia: "ĐỊA_CHỈ_CONTRACT_TESTNET_VỪA_DEPLOY",
  arbitrum: "ĐỊA_CHỈ_CONTRACT_MAINNET_VỪA_DEPLOY"
}
```

---

## 🔒 An toàn & Bảo mật hệ thống

* **ReentrancyGuard**: Chống tấn công re-entrancy khi gọi giao dịch.
* **Pausable**: Cho phép tạm dừng DApp trong trường hợp khẩn cấp.
* **Anti-Spam Constraint**: Giới hạn mỗi ví chỉ được gửi tối đa 1 giao dịch tạo phiên trên 1 block để tránh hiện tượng spam giao dịch làm cạn kiệt LINK.
* **Deterministic Verification**: Kết quả được lưu on-chain kết hợp với thuật toán băm công khai bảo đảm không một bên nào (kể cả Owner) có thể can thiệp hoặc thay đổi kết quả sau khi đã tạo phiên.
