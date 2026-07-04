import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, SpinnerComponent],
  templateUrl: './verify.component.html'
})
export class VerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Đầu vào tìm kiếm
  public queryInput = '';

  // Trạng thái verify
  public readonly sessionDetails = signal<any | null>(null);
  public readonly clientResult = signal<any | null>(null);
  public readonly isVerifying = signal<boolean>(false);
  public readonly hasSearched = signal<boolean>(false);
  public readonly isVerifiedSuccess = signal<boolean>(false);

  ngOnInit() {
    // Tự động kiểm tra và verify nếu có query parameter 'q' truyền từ trang chi tiết
    this.route.queryParams.subscribe(params => {
      const q = params['q'];
      if (q && q.trim()) {
        this.queryInput = q.trim();
        this.runVerification();
      }
    });
  }

  /**
   * Chạy quy trình xác minh tính minh bạch
   */
  public async runVerification() {
    const query = this.queryInput.trim();
    if (!query) {
      this.toastService.showToast('Vui lòng nhập mã Request ID!', 'error');
      return;
    }

    this.isVerifying.set(true);
    this.hasSearched.set(true);
    this.sessionDetails.set(null);
    this.clientResult.set(null);
    this.isVerifiedSuccess.set(false);

    try {
      // Tự động dò tìm mạng (Sepolia hay Mainnet) cho Tx Hash hoặc Request ID
      await this.web3Service.detectAndSwitchChain(query);

      // 1. Tải chi tiết phiên bốc thăm
      let requestId = query;

      // Xử lý trường hợp người dùng nhập Tx Hash thay vì RequestID
      // Chúng ta sẽ quét sự kiện DrawCreated để tìm requestId tương ứng với Tx Hash đó
      if (query.startsWith('0x') && query.length === 66) {
        console.log('[Verify] Phát hiện mã băm giao dịch (Tx Hash). Đang tìm RequestID...');
        const contract = this.web3Service.getContract(false);
        const filter = contract['filters']['DrawCreated']();
        const events = await contract.queryFilter(filter, 0, 'latest');
        
        const targetEvent = events.find(e => e.transactionHash.toLowerCase() === query.toLowerCase());
        if (targetEvent) {
          requestId = (targetEvent as any).args.requestId.toString();
          console.log('[Verify] Đã tìm thấy Request ID tương ứng:', requestId);
        } else {
          this.toastService.showToast('Không tìm thấy phiên bốc thăm tương ứng với Tx Hash này!', 'error');
          this.isVerifying.set(false);
          return;
        }
      }

      // 2. Lấy dữ liệu session chi tiết từ contract
      const data = await this.web3Service.getDrawSessionDetails(requestId);
      if (data) {
        this.sessionDetails.set(data);

        // 3. Nếu phiên đã được callback số ngẫu nhiên từ VRF
        if (data.fulfilled && data.randomWord && data.randomWord !== '0') {
          // Thực thi thuật toán deterministic ở client-side
          const clientRes = this.web3Service.calculateResultClientSide(
            data.drawType,
            data.param1,
            data.param2,
            data.randomWord,
            data.participants
          );
          this.clientResult.set(clientRes);

          // 4. Đối chiếu kết quả client-side và on-chain để verify
          if (data.drawType === 9) {
            // Đối với chia team, contract lưu kết quả tĩnh "Teams Assigned"
            // Kết quả hợp lệ khi client tính toán chia thành công đầy đủ số team
            this.isVerifiedSuccess.set(clientRes && clientRes.teams && clientRes.teams.length === data.param2);
          } else {
            // Đối với các chế độ khác, so khớp trực tiếp kết quả nối chuỗi
            this.isVerifiedSuccess.set(data.result.trim() === clientRes.result.trim());
          }

          if (this.isVerifiedSuccess()) {
            this.toastService.showToast('Xác minh thành công! Kết quả hoàn toàn minh bạch.', 'success');
          } else {
            this.toastService.showToast('Cảnh báo: Phát hiện sai lệch kết quả!', 'error');
          }
        }
      } else {
        this.toastService.showToast('Không tìm thấy phiên bốc thăm với ID được yêu cầu!', 'error');
      }
    } catch (err) {
      console.error('[Verify] Lỗi xác minh bốc thăm:', err);
      this.toastService.showToast('Đã xảy ra lỗi trong quá trình xác minh.', 'error');
    } finally {
      this.isVerifying.set(false);
    }
  }

  public get skinType(): string {
    const details = this.sessionDetails();
    return details && details.skin ? details.skin : '';
  }

  /**
   * Helper hiển thị tên loại quay
   */
  public getDrawTypeName(type: number): string {
    const names: Record<number, string> = {
      1: "Quay số ngẫu nhiên",
      2: "Chọn 1 tên ngẫu nhiên",
      3: "Chọn nhiều người thắng",
      4: "Lật đồng xu",
      5: "Quay xúc xắc",
      6: "Chẵn / Lẻ",
      7: "Màu sắc ngẫu nhiên",
      8: "Chữ cái ngẫu nhiên (A-Z)",
      9: "Chia đội ngẫu nhiên"
    };
    return names[type] || "Chưa xác định";
  }
}
