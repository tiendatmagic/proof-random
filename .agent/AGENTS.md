# Nhật ký hoạt động (Proof-Random)

- Khắc phục các vấn đề liên quan đến AppKit và WalletConnect trên thiết bị di động (Chrome).
- Chỉnh sửa lỗi ứng dụng bị đặt sai chain khi reload lại trang do Provider.
- **Ngày 07/07/2026**: Viết lại hoàn toàn file `web3.service.ts` để đồng bộ lại với cơ chế lấy provider mới nhất, lấy cảm hứng từ cấu trúc của `cafe-blockchain`. Đã biên dịch Angular thành công. Cải thiện độ mượt khi kết nối Smart Contract trên cả web và app di động.
- **Bổ sung (07/07/2026)**: Chặn lỗi fallback sang `window.ethereum` khi đang kết nối bằng AppKit WalletConnect. Việc này giúp fix triệt để lỗi reload bị nhảy sang mạng lưới `1` (Mainnet) và lỗi ký giao dịch báo sai chain trên trình duyệt dApp In-App của thiết bị di động.
- **Bổ sung lần 2 (07/07/2026)**: Viết thêm `effect` tự động đồng bộ `configuredChainId` với `chainId` thực tế của ví nếu người dùng dùng mạng hợp lệ (Arbitrum One/Sepolia). Khắc phục triệt để lỗi hiện popup "Sai mạng lưới" vô lý khi người dùng mới kết nối.
- **Bổ sung lần 3 (07/07/2026)**: Khắc phục lỗi "missing revert data" khi người dùng quay Bingo với 1 bóng. Nguyên nhân do payload của danh sách 90 bóng bị gửi lên dù Contract chỉ nhận drawType=1 (chế độ Random Number). Xóa mảng `participants` trước khi gửi transaction nếu `drawType` không yêu cầu nhằm giảm gas limit và sửa lỗi Contract InvalidInput.
- **Bổ sung lần 4 (07/07/2026)**: Thêm fallback cơ chế `getSigner()` không tham số cho `BrowserProvider` để khắc phục lỗi không thể bốc thăm của **Trust Wallet** trên mạng lưới Arbitrum Sepolia thông qua WalletConnect. Tránh báo lỗi sai "WalletConnect provider chưa sẵn sàng".
- **Bổ sung lần 5 (07/07/2026)**: Thêm cơ chế gửi giao dịch thô (raw transaction) qua `eth_sendTransaction` trong `requestDraw` để vượt qua lỗi `getSigner()` không hoạt động triệt để trên Trust Wallet qua WalletConnect testnet. Đảm bảo giao dịch luôn được đẩy tới ví dù Ethers.js không thể khởi tạo Signer.
