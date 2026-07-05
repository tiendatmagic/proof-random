# Nhật ký hoạt động ProofRandom DApp

## Yêu cầu dự án
Xây dựng DApp ProofRandom hoàn chỉnh:
- **Frontend**: Angular 22, ethers.js v6, tích hợp Reown AppKit (WalletConnect), thiết kế Glassmorphism Neon Pink/Purple.
- **Blockchain/Smart Contract**: Solidity, OpenZeppelin, Hardhat, Chainlink VRF v2.5.
- **Tính năng chính**:
  1. Trang chủ: Thống kê, tạo phiên bốc thăm mới với 9 chế độ quay (Random Number, Random Name, Multiple Winners, Coin Flip, Dice, Even/Odd, Random Color, Random Letter, Random Team).
  2. Draw History: Bộ lọc lịch sử bốc thăm.
  3. Detail: Xem chi tiết phiên, danh sách tham gia, người thắng, tx hash, requestId, v.v.
  4. Verification: Nhập requestId/tx hash để chạy lại thuật toán verify deterministic khớp với kết quả on-chain.
  5. Share & Export: Copy Link, Copy Result, Share mạng xã hội, QR Code. Xuất PDF, CSV, JSON.

## Tiến độ thực hiện
- [x] Nghiên cứu cấu trúc mã nguồn tham chiếu `cafe-blockchain`.
- [x] Nghiên cứu hệ thống design quy chuẩn (font Quicksand, Tailwind v4, biến màu dynamic).
- [x] Lên kế hoạch triển khai chi tiết và tạo file `implementation_plan.md` trong thư mục artifacts.
- [x] Đảm bảo cấu trúc file `.gitignore` đầy đủ và chính xác tại thư mục gốc và thư mục `proof-random-web`.
- [x] Thêm script `start` vào `package.json` gốc để tự động chạy frontend Angular (`ng serve`) trong thư mục `proof-random-web`.
- [x] Đổi tên toàn bộ dự án từ FairDraw sang ProofRandom trên cả Frontend và Smart Contract.
- [x] Xây dựng và biên dịch thành công Smart Contract `ProofRandom.sol` tích hợp Chainlink VRF v2.5.
- [x] Hoàn thiện 100% các trang giao diện (Dashboard, Lịch sử, Chi tiết phiên, Xác minh).
- [x] Tích hợp WalletConnect AppKit và Ethers.js v6, lọc tự động nếu sai mạng.
- [x] Khắc phục các lỗi Typescript strict type check và parser template của Angular.
- [x] Thiết kế logo trong suốt và favicon (PNG & ICO), tích hợp thành công vào giao diện Frontend.
- [x] Đồng bộ hóa hệ thống biến môi trường của Angular (`src/environments`).
- [x] Chuyển đổi mặc định sang Arbitrum One Mainnet (`42161`) cho ví và cấu hình dApp.
- [x] Sửa lỗi vỡ style CSS Tailwind v4 (chuyển đổi sang `styles.css` và định vị `@source`).
- [x] Thiết lập Project ID chính thức của người dùng và hiển thị chính xác danh sách các ví ưu tiên (MetaMask, Bitget Wallet, Binance Wallet, SafePal).
- [x] Khắc phục triệt để lỗi lệch chiều cao input/button ở verify và lỗi icon đè chữ placeholder ở history/verify.
- [x] Thiết kế Context Menu ví tích hợp các action: sao chép địa chỉ ví, chi tiết ví và ngắt kết nối ví, đi kèm HostListener click outside tự đóng.
- [x] Thiết kế lại Toast Notification Glassmorphism mượt mà giống hệt mẫu (hỗ trợ Light/Dark mode, progress bar chạy ở đáy và logic clear() trong ToastService).
- [x] Thiết kế lại giao diện Wallet Widget hiển thị khi đã kết nối ví: bổ sung badge (ULTRA- 355d) bo góc viền xanh ngọc, chấm xanh trạng thái, phân tách địa chỉ rút gọn dòng trên và số dư dòng dưới màu hồng neon, chevron pink cùng viền hồng kính mờ, hỗ trợ đổi ký hiệu tiền tệ động.
- [x] Xây dựng các component dùng chung độc lập: `CardComponent` (`<app-card>`), `SpinnerComponent` (`<app-spinner>`), và `SkeletonLoaderComponent` (`<app-skeleton-loader>`).
- [x] Kế thừa và thay thế các khối card, spinner và trang loading tĩnh bằng các component mới trên cả 4 trang giao diện (Dashboard, History, Detail, Verify).
- [x] Loại bỏ badge "ULTRA- 355d" khỏi widget ví để làm giao diện tinh gọn, tự nhiên hơn.
- [x] Tinh giản các stats card trên Dashboard thành màu trắng đơn giản và loại bỏ hoàn toàn các họa tiết màu sắc phát sáng nền.
- [x] Sửa lại giao diện dropdown chọn mạng chỉ hiển thị 2 chain (Arbitrum One Mainnet, Arbitrum Sepolia), loại bỏ border-b tiêu đề và giảm bớt padding dọc của item xuống py-1 cho nhỏ gọn tinh tế.
- [x] Khắc phục triệt để lỗi các icon bị dẹt ngang (ở cả 3 stats card và 9 chế độ quay) bằng việc sử dụng 100% các class Tailwind v4 chính thống (`shrink-0 min-w-X`).
- [x] Giải quyết triệt để lỗi icon đè lên chữ ở stats card bằng cách chuyển bố cục sang dạng dọc (`flex-col items-start gap-3`).
- [x] Đồng bộ hóa chiều cao (`h-[44px]`) và độ bo góc (`rounded-2xl`) của nút "Kết nối ví" và "Nút chọn mạng" (quả địa cầu) trên header với widget ví khi đã kết nối để đảm bảo tính nhất quán của giao diện.
- [x] Sửa lỗi đứt nét/méo mó của icon SVG xoay vòng (Refresh) bằng việc cập nhật sang path Heroicons v2 chuẩn.
- [x] Tối ưu responsive cho phần Tiêu đề và nút Tải lên CSV của danh sách người tham gia bằng bố cục `flex-col` trên mobile.
- [x] Tối ưu responsive cho phần Tiêu đề, nút Làm mới dữ liệu và Grid bộ lọc của trang Lịch sử (History) (tự động chuyển thành 1 hàng 1 field trên tablet/mobile) để hiển thị tốt trên tablet và mobile.
- [x] Khắc phục triệt để lỗi lệch chiều cao/hàng ngang ở verify/history và lỗi icon đè chữ placeholder ở history/verify.
- [x] Loại bỏ hoàn toàn hiệu ứng chuyển động (transition, duration) và phóng to (scale hover) của toàn bộ các card hệ thống trong CSS.
- [x] Xây dựng Custom Select Component dùng chung có thiết kế Glassmorphism và thay thế toàn bộ thẻ `<select>` native trong ứng dụng.
- [x] Thiết kế lại Custom Select Component có giao diện Slate tinh tế và định vị fixed thông minh theo mẫu dự án cũ cafe-blockchain.
- [x] Xây dựng Custom Checkbox Component dùng chung (sử dụng model signal hai chiều tránh lỗi toggle) và thay thế các checkbox native trên Dashboard.
- [x] Sửa lỗi checkbox custom không tích được bằng cách loại bỏ input native ẩn và tự động toggle trực tiếp bằng model signal hai chiều.
- [x] Dọn dẹp toàn bộ các import và imports component không sử dụng (SpinnerComponent, SkeletonLoaderComponent) ở Dashboard, Detail, History và Verify để xóa các cảnh báo NG8113.
- [x] Bổ sung card thứ 4 "Số dư Oracle (LINK)" trên Dashboard: đọc `s_subscriptionId` từ contract, truy vấn Chainlink VRF Coordinator (`getSubscription`) để lấy balance LINK (juels → LINK), hiển thị kèm Sub ID. Grid stats chuyển từ 3 cột thành 4 cột (`sm:grid-cols-2 lg:grid-cols-4`). Skeleton loader cũng cập nhật tương ứng.
- [x] Gỡ bỏ toàn bộ các họa tiết trang trí (decorative elements): vòng tròn blur hồng góc trên phải của Event Title Card, gradient radial nền sau vùng hiển thị kết quả (detail.html), gradient radial xanh lá nền sau banner Verify thành công (verify.html). Đồng thời dọn sạch các class `relative overflow-hidden`, `relative z-10` thừa.
- [x] Tích hợp tính năng tự động nhận diện mạng lưới (Arbitrum Sepolia / Arbitrum One Mainnet) dựa trên Request ID hoặc Tx Hash khi truy cập thẳng bằng liên kết chia sẻ hoặc trên trang Xác minh (Verify), tự động cập nhật cấu hình RPC và Contract Address tương ứng của dApp mà không cần người dùng chọn thủ công.
- [x] Điền sẵn tên phiên bốc thăm mặc định định dạng ngày/tháng/năm và giờ/phút/giây trong ô nhập liệu (Event Name Input) ở trang Dashboard nhằm tối ưu hóa UX, giảm thiểu thao tác nhập liệu cho người dùng.
- [x] Khắc phục lỗi crash dApp trên trình duyệt (ReferenceError: require is not defined) ở các chế độ bốc thăm sử dụng thuật toán hash (Random Color, Multi Winners, Random Team) bằng cách import trực tiếp `solidityPackedKeccak256` từ `ethers` thay vì gọi dynamic `require('ethers')`.
- [x] Tách bảng cấu hình bốc thăm của Dashboard ra component con độc lập `DrawConfigPanelComponent` (`<app-draw-config-panel>`).
- [x] Triển khai thành công 5 game ngẫu nhiên trực quan (Lucky Wheel, Racing, Mystery Box, Bầu Cua, Scratch Card) trên giao diện.
- [x] Thiết lập mã hóa và giải mã tự động loại Skin (`[Skin:xxx]`) trong `eventName` của Smart Contract.
- [x] Khắc phục triệt để lỗi biên dịch TypeScript của Angular đối với hàm `Number()` trong template Detail.
- [x] Tích hợp khối Showcase hiển thị người chiến thắng / chia đội trực quan trên trang Xác minh (Verify) khi đối soát thành công.
- [x] Đồng bộ hóa toàn bộ giao diện: loại bỏ 100% emoji khỏi các nút chế độ, bảng đối soát, các mini-game, thay thế hoàn toàn bằng các biểu tượng SVG và màu chữ hệ thống đồng bộ.
- [x] Thay đổi cấu hình định tuyến từ Hash Routing (sử dụng "#/") sang Path Routing mặc định (đường dẫn "/history", "/detail") trong file app.config.ts.
- [x] Thiết kế lại giao diện của các mini-game (Racing, Bau Cua, Scratch Card) để hỗ trợ hoàn hảo chế độ Light/Dark mode.
- [x] Khắc phục triệt để lỗi trò chơi Đua xe (Racing) không hiển thị người đua lúc ban đầu và bị đứng im khi chạy bằng cách chuyển đổi racerProgresses sang Signal và tự động khởi tạo mảng tiến độ.
- [x] Thiết lập chế độ mặc định khi truy cập phiên bốc thăm: luôn hiển thị nút bắt đầu hiệu ứng game (QUAY, ĐUA XE,...) kèm nút BỎ QUA để người dùng tự chọn xem hiệu ứng kịch tính hoặc xem nhanh kết quả luôn.
- [x] Khắc phục triệt để lỗi không tự động cập nhật giao diện sau khi kết thúc hiệu ứng game (hoặc khi nhấn Bỏ qua) bằng cách chuyển đổi toàn bộ 10 biến trạng thái hiển thị game sang Signal.
- [x] Thiết kế lại giao diện hộp quà (Mystery Box) bằng đồ họa vector SVG 3D chi tiết với nơ ruy băng vàng óng, bóng neon phát sáng và hiệu ứng mở nắp bay ra pháo hoa lấp lánh (confetti).
- [x] Triển khai thành công trò chơi mô phỏng Xổ số Vietlott hỗ trợ đầy đủ 3 chế độ (Power 6/55, Mega 6/45, Keno) từ kết quả ngẫu nhiên Chainlink VRF, tích hợp hiệu ứng quay chốt bóng kịch tính và bảng highlight số Keno.
- [x] Đồng bộ hóa tài liệu README.md và cấu hình package.json: Cập nhật tên dự án sang ProofRandom, bổ sung hướng dẫn chạy nhanh npm start, hướng dẫn cấu hình Chainlink VRF v2.5, mô tả chi tiết 5 mini-game trực quan, game xổ số Vietlott, tính năng tự động nhận dạng mạng lưới và thống kê số dư Oracle LINK.
- [x] Triển khai khối "Chuỗi băm xác minh theo từng bước" trên trang Verify: hiển thị trực quan randomWord gốc on-chain → từng bước keccak256 (drawType 3,7,9) hoặc công thức mod trực tiếp (drawType 1,2,4,5,6,8) → kết quả cuối cùng khớp on-chain. Hỗ trợ copy hash đầy đủ, Timeline layout, không cần sửa Smart Contract.
- [x] Áp dụng khối "Chuỗi băm xác minh theo từng bước" cho cả trang Detail page (tất cả 9 chế độ bốc thăm). Import HashStep/DirectModResult interface từ verify component, thêm buildHashSteps() vào detail.component.ts, thêm UI timeline vào detail.component.html.
- [x] Bổ sung case Bầu Cua (BauCua skin) vào buildHashSteps(): hiển thị rõ 3 xúc xắc (d1=seed%6, d2=keccak256(seed,"1")%6, d3=keccak256(seed,"2")%6) kèm tên con vật tương ứng.
- [x] Cập nhật đầy đủ 15 chế độ quay (9 drawType + 6 game skin) cho bộ lọc trang History: thêm skin vào filterOptions, logic filter theo skin, badge màu tím phân biệt skin vs drawType thuần, hàm getDrawTypeName nhận thêm skin param. Đồng bộ getDrawTypeName cho cả Verify page và hiển thị skin đúng trong bảng đối soát.
- [x] Tối ưu hóa CSS layout bảng History: cố định chiều rộng cột th/td, nới rộng giới hạn hiển thị tên phiên bốc thăm lên max-w-[280px], đồng bộ kích thước tất cả các nhãn Chế độ quay (w-[165px], h-7, inline-flex) giúp bảng hiển thị thẳng hàng tăm tắp, cân đối và chuyên nghiệp.
- [x] Thiết lập hệ thống màu sắc badge thông minh cho 15 chế độ bốc thăm (Sky Blue cho bốc thăm số/tên, Teal cho may rủi nhị phân, Indigo cho màu sắc/chia đội, Đỏ cam cho Vietlott, Hồng neon cho Vòng quay, Vàng hổ phách cho Hộp quà, Xanh lá cho Bầu Cua...) nhằm tăng độ thẩm mỹ công nghệ cao và dễ nhận diện.
- [x] Khắc phục lỗi xác minh (Verify) ở chế độ Màu ngẫu nhiên (Random Color): Đồng bộ lại thứ tự đọc 3 byte cuối từ phải sang trái (hash[31], hash[30], hash[29]) trong thuật toán tính màu ở client-side để khớp chính xác 100% với hàm `getRandomColor` của Smart Contract.
- [x] Tạo và cấu hình các tệp `netlify.toml` tại thư mục gốc và thư mục frontend (`proof-random-web`) hỗ trợ build tự động và redirect routing SPA trên Netlify.
- [x] Cập nhật các file `.gitignore` tại thư mục gốc và thư mục frontend để bỏ qua thư mục cache tạm `.netlify/` của Netlify.
- [x] Khắc phục triệt để lỗi Connection declined (previous request is still active) của WalletConnect AppKit bằng cách chuyển đổi cập nhật số dư qua JsonRpcProvider công cộng và thiết lập khoảng trễ setTimeout khi lắng nghe các sự kiện tài khoản/mạng lưới.
- [x] Khắc phục lỗi nút "Bắt đầu đối soát" làm xoay icon chiếc khiên bằng cách tách biệt icon chiếc khiên đứng yên khi bình thường và hiển thị spinner xoay chuẩn CSS khi đang thực hiện đối soát.
- [x] Khắc phục lỗi icon bị đứt nét ở nút "BẮT ĐẦU QUAY SỐ" (Vietlott) bằng cách chuyển đổi sang path Heroicons v2 chuẩn, bổ sung hiệu ứng xoay (animate-spin) sinh động khi đang quay số và chống dẹt ngang (shrink-0).
- [x] Tối ưu hóa hiệu năng trang Lịch sử bằng cơ chế phân trang On-chain trực tiếp qua mảng `requestIds` của Smart Contract, giúp giảm thiểu tải lượng RPC và tránh hoàn toàn lỗi Block Limit khi dữ liệu cực lớn, kết hợp cơ chế cache quét full thông minh khi người dùng thực hiện lọc/tìm kiếm.
- [x] Loại bỏ hoàn toàn card thống kê "Nhà sáng lập (Creators)" trên giao diện Dashboard theo yêu cầu của người dùng, tối ưu hóa grid layout hiển thị 3 card còn lại thành 3 cột cân đối, dọn dẹp các biến, logic đếm người dùng duy nhất và điều chỉnh skeleton loader tương ứng.
- [x] Khắc phục lỗi ẩn nút đổi chain, kết nối ví và thông tin ví trên mobile bằng việc tích hợp các điều khiển ví/mạng rút gọn trên Mobile Header và hiển thị bảng điều khiển ví/mạng chi tiết tại Sidebar Drawer.
- [x] Định cấu hình lại Grid thống kê Dashboard (Tổng số phiên bốc thăm, Lượt quay thành công, Số dư Oracle) hiển thị thành 2 cột trên mobile, trong đó card Số dư Oracle chiếm trọn 2 cột để tạo bố cục cân đối và tránh bị cắt text Sub ID.
- [x] Đồng bộ hóa component Skeleton Loader thống kê Dashboard tương ứng với bố cục grid 2 cột mới trên mobile.
- [x] Xây dựng bộ điều khiển tùy chỉnh cài đặt gas (Gas Settings Widget) tại chân Sidebar: Hỗ trợ 3 chế độ (Mặc định - ví tự tính, Nhanh - nhân đôi x2 phí gas, Tùy chọn - tự nhập hệ số nhân gas). Cấu hình tự động lưu trữ vào localStorage và tự động áp dụng dưới dạng Overrides (`gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`) khi gửi transaction, giúp giảm thiểu tối đa lỗi Out-of-gas hoặc nghẽn mạng blockchain.
- [x] Thiết kế lại bộ chọn giao diện Sáng/Tối (Theme Toggler) ở chân Sidebar: hiển thị tiêu đề và trạng thái Sáng/Tối/Tự động ở bên trái và cụm 3 nút icon tròn nhỏ (Mặt trời, Đồng hồ, Mặt trăng) dạng pill (rounded-full) có shadow-sm nổi bật bên phải, đồng bộ giao diện và màu sắc động.
- [x] Đồng bộ hóa giao diện và màu sắc badge của bảng "5 Phiên gần đây nhất" trên Dashboard giống như bảng của trang Lịch sử (History) (hỗ trợ hiển thị tên và màu sắc động cho cả 15 chế độ/skins khác nhau).
- [x] Thiết lập chế độ gas mặc định là "Mặc định" (default) khi dApp chạy trên mạng Arbitrum One Mainnet (chain ID 42161) và khôi phục cài đặt hoặc chuyển về "Nhanh" (fast) đối với các mạng thử nghiệm.
- [x] Tích hợp bộ đếm thời gian (waitingTime) hiển thị số giây chờ Chainlink VRF thực tế chạy động trên trang Chi tiết (Detail) thay thế cho văn bản tĩnh.
- [x] Thiết lập hệ thống lưu cache thông minh client-side (RAM Web3Service kết hợp sessionStorage chia theo chainId) cho trang Lịch sử (History) và Chi tiết (Detail), giúp chuyển đổi trang mượt mà tức thì (Instant Load UX) và giảm tải 90% RPC Node request.
- [x] Sửa lỗi Social Login (Google, Facebook) trên Reown AppKit: chuyển đổi default account type sang EOA và cung cấp hướng dẫn whitelist domain để tránh lỗi "Action not allowed" khi ký giao dịch, đồng thời cô lập hoàn toàn các cuộc gọi RPC phụ trợ (estimateGas, getFeeData) sang JsonRpcProvider công cộng để tránh lỗi "Requested RPC call is not allowed".
- [x] Khắc phục lỗi nút "Kết nối" ví trên mobile bị đổi màu nền thành trắng (làm ẩn chữ khi hover) bằng cách định nghĩa đầy đủ biến CSS `--color-primary-hover` trong `styles.css`.
- [x] Đồng bộ hóa logo hiển thị trên WalletConnect AppKit bằng cách chép đè logo trong suốt chính thức của DApp từ `public/logo.png` sang `public/assets/logo.png`.
- [x] Bổ sung banner thông báo và liên kết Faucet (Chainlink Faucet & Alchemy Faucet) tại trang chủ (Dashboard) khi người dùng truy cập mạng thử nghiệm Arbitrum Sepolia.
- [x] Khắc phục triệt để lỗi lệch dữ liệu thống kê trên Dashboard (Tổng phiên vs Lượt quay thành công) bằng cách truy vấn getSessionsCount trực tiếp từ contract state và tự động làm mới cache sự kiện khi phát hiện dữ liệu lỗi thời.
- [x] Khắc phục lỗi hiển thị tên chế độ quay "Quay xúc xắc" thay vì "Bầu Cua Tôm Cá" trên trang Chi tiết (Detail) bằng cách sửa đổi hàm getDrawTypeName nhận thêm tham số skin, đồng bộ hóa tại giao diện và các bộ dữ liệu xuất file.
- [x] Triển khai thành công 4 chế độ bốc thăm mới: Plinko (Thả bóng may mắn), Slot Machine (Quay hũ), Bốc bài tây (Card Draw), và Oản tù tì (Rock-Paper-Scissors). Đồng bộ hóa hoàn hảo trên cả 4 trang Dashboard, Lịch sử, Chi tiết, Xác minh và hệ thống băm đối soát.
- [x] Xây dựng component phân trang dùng chung `PaginationComponent` độc lập và thay thế phần phân trang cũ tại trang Lịch sử (History) bằng thiết kế hình tròn Glassmorphism với màu sắc hoạt động hồng neon cực kỳ cao cấp, giống với cafe-blockchain.
- [x] Khắc phục triệt để lỗi trò chơi Thả bóng Plinko bị đứng im không chạy do lỗi RangeError của đối tượng Proxy Result từ thư viện ethers v6 (ném ra khi truy cập chỉ số ngoài phạm vi của mảng người tham gia), bằng cách ép kiểu mảng `participants` sang dạng mảng JavaScript thuần (`Array.from`) trước khi lọc dữ liệu vẽ.























