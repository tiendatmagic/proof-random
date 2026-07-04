# FairDraw - Nền tảng Bốc thăm & Quay số ngẫu nhiên minh bạch Blockchain

FairDraw là một ứng dụng phi tập trung (DApp) hoàn chỉnh giúp tạo các phiên bốc thăm, giveaway và quay số ngẫu nhiên minh bạch 100%, có thể kiểm chứng hoàn toàn bằng blockchain. 

Ứng dụng hướng tới các sự kiện như Livestream, Giveaway, Hội thảo, Workshop, Trường học, Company Event... **FairDraw không phải game, không cá cược, không nạp/rút tiền, không Play-to-Earn.** Mục đích duy nhất là bảo chứng tính khách quan của kết quả bằng công nghệ VRF.

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
    FE->>Participant: Hiển thị kết quả trúng thưởng rực rỡ (Winner, mã màu, xúc xắc...)
    Participant->>FE: Nhập requestId tại trang Verify để đối soát kết quả độc lập (Client-side vs On-Chain)
```

---

## ⚙️ Hướng dẫn cấu hình Chainlink VRF v2.5

Để DApp hoạt động thực tế trên Testnet/Mainnet, bạn cần liên kết dịch vụ Chainlink VRF v2.5:

1. **Tạo Subscription**:
   - Truy cập trang quản trị [Chainlink VRF Subscription Management](https://vrf.chain.link/).
   - Kết nối ví của bạn và chọn mạng lưới tương ứng (Arbitrum One hoặc Arbitrum Sepolia).
   - Chọn **Create Subscription** và ký giao dịch trên ví.
2. **Nạp quỹ (Fund Subscription)**:
   - Nạp một ít token LINK hoặc Native Token (ETH trên Arbitrum) vào Subscription mới tạo để trả phí gas cho các cuộc gọi Oracle sinh số ngẫu nhiên.
3. **Thêm Consumer (Sau khi deploy contract)**:
   - Sau khi deploy contract `FairDraw` (ở bước dưới), hãy lấy địa chỉ contract đó.
   - Trên giao diện Chainlink Subscription, chọn **Add Consumer**, điền địa chỉ contract `FairDraw` vừa deploy và ký xác nhận giao dịch ví.

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
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

### 4. Deploy lên Arbitrum One (Mainnet)
```bash
npx hardhat run scripts/deploy.ts --network arbitrum
```

### 5. Verify contract trên Arbiscan (để mở tab Read/Write contract công khai)
```bash
npx hardhat verify --network <tên_mạng> <địa_chỉ_contract> "<địa_chỉ_coordinator>" "<subscription_id>" "<key_hash>"
```

---

## 💻 Hướng dẫn chạy local phát triển

### 1. Chạy Blockchain Node local & Chạy Test Smart Contract
Để chạy kiểm thử độc lập smart contract local:
```bash
# Chạy toàn bộ Unit Test (bao quát 100% 9 chế độ quay)
npm run test

# Khởi động local node blockchain giả lập
npx hardhat node
```

### 2. Chạy Frontend DApp (Angular 22)
Di chuyển vào thư mục frontend và khởi chạy máy chủ phát triển:
```bash
cd proof-random-web

# Khởi chạy dev server (mặc định tại http://localhost:4200)
npm run start
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

## 🔒 Các chế độ quay & Bảo mật an toàn

DApp hỗ trợ 9 chế độ bốc thăm:
1. **Random Number**: Quay số trong khoảng Min - Max.
2. **Random Name**: Chọn ngẫu nhiên 1 người từ danh sách.
3. **Multiple Winners**: Chọn K người thắng không trùng từ danh sách.
4. **Coin Flip**: Lật đồng xu ngẫu nhiên (Heads/Tails).
5. **Dice**: Quay xúc xắc (6 mặt hoặc 20 mặt).
6. **Even/Odd**: Bốc chẵn lẻ.
7. **Random Color**: Sinh mã màu HEX ngẫu nhiên.
8. **Random Letter**: Chọn chữ cái từ A đến Z.
9. **Random Team**: Chia đều danh sách người tham gia vào các đội ngẫu nhiên.

**Bảo mật**:
- **ReentrancyGuard**: Chống tấn công re-entrancy khi gọi giao dịch.
- **Pausable**: Cho phép tạm dừng DApp trong trường hợp khẩn cấp.
- **Ownable2Step**: Chuyển nhượng quyền sở hữu contract an toàn qua 2 bước.
- **Anti-Spam Constraint**: Giới hạn mỗi ví chỉ được gửi 1 giao dịch tạo phiên trên 1 block để tránh hiện tượng spam mempool.
