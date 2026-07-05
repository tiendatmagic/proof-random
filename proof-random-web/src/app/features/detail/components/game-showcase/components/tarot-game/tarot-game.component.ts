import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-tarot-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarot-game.component.html'
})
export class TarotGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.initTarot();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isTarotRunning = signal<boolean>(false);
  public readonly tarotDone = signal<boolean>(false);
  public readonly tarotCards = signal<any[]>([]);
  public readonly tarotSelectedIdx = signal<number | null>(null);

  // Timers riêng của game
    private tarotTimeoutId: any = null;

    // ================= 14. RÚT BÀI TAROT (TAROT) =================
  public initTarot() {
    this.isTarotRunning.set(false);
    this.tarotDone.set(false);
    this.tarotSelectedIdx.set(null);
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);

    const details = this.sessionDetails();
    if (details && details.participants && details.result !== undefined && details.result !== null) {
      if (details.drawType === 3) {
        // Chế độ rút nhiều lá bài Tarot
        const indices = details.result.split(',').map(Number);
        const cardsList = indices.map((winnerIdx: number) => {
          const wName = details.participants[winnerIdx] || 'The Sun (Mặt Trời)';
          return {
            name: wName,
            isWinner: true,
            flipped: false,
            selected: false,
            desc: this.getTarotDesc(wName)
          };
        });
        this.tarotCards.set(cardsList);
      } else {
        // Chế độ rút 1 lá bài Tarot định mệnh (Game 3 lá bài)
        const winnerIdx = Number(details.result);
        const wName = details.participants[winnerIdx] || 'The Sun (Mặt Trời)';
        
        const allTarotList = [
          'The Fool (Chàng Khờ)', 'The Magician (Nhà Ảo Thuật)', 'The High Priestess (Nữ Tư Tế)',
          'The Empress (Nữ Hoàng)', 'The Emperor (Hoàng Đế)', 'The Hierophant (Giáo Hoàng)',
          'The Lovers (Tình Nhân)', 'The Chariot (Chiến Xa)', 'Strength (Sức Mạnh)',
          'The Hermit (Ẩn Sĩ)', 'Wheel of Fortune (Vòng Quay Số Phận)', 'Justice (Công Lý)',
          'The Hanged Man (Kẻ Treo)', 'Death (Tử Thần)', 'Temperance (Tiết Độ)',
          'The Devil (Ác Quỷ)', 'The Tower (Tòa Tháp)', 'The Star (Ngôi Sao)',
          'The Moon (Mặt Trăng)', 'The Sun (Mặt Trời)', 'Judgement (Phán Xét)', 'The World (Thế Giới)'
        ];

        const fakes = allTarotList.filter(c => c !== wName);
        const fake1 = fakes[Number(BigInt(details.randomWord || 0) % BigInt(fakes.length))];
        const fakes2 = fakes.filter(c => c !== fake1);
        const fake2 = fakes2[Number((BigInt(details.randomWord || 0) / 2n) % BigInt(fakes2.length))];

        const winPos = Number(BigInt(details.randomWord || 0) % 3n);
        const cardsList = new Array(3);
        cardsList[winPos] = { name: wName, isWinner: true, flipped: false, selected: false, desc: this.getTarotDesc(wName) };
        
        let fakeIdx = 0;
        const fakeArr = [fake1, fake2];
        for (let i = 0; i < 3; i++) {
          if (i !== winPos) {
            const fakeName = fakeArr[fakeIdx++];
            cardsList[i] = { name: fakeName, isWinner: false, flipped: false, selected: false, desc: this.getTarotDesc(fakeName) };
          }
        }
        this.tarotCards.set(cardsList);
      }
    }
  }

  public selectTarotCard(idx: number) {
    if (this.isTarotRunning() || this.tarotDone()) return;
    this.tarotSelectedIdx.set(idx);
    this.startTarotAnimation(idx);
  }

  public startTarot() {
    if (this.isTarotRunning() || this.tarotDone()) return;
    const cardsList = this.tarotCards();
    const winIdx = cardsList.findIndex(c => c.isWinner);
    this.tarotSelectedIdx.set(winIdx >= 0 ? winIdx : 1);
    this.startTarotAnimation(winIdx >= 0 ? winIdx : 1);
  }

  private startTarotAnimation(selectedIdx: number) {
    this.isTarotRunning.set(true);
    
    this.tarotTimeoutId = setTimeout(() => {
      this.isTarotRunning.set(false);
      this.tarotDone.set(true);

      const cardsList = this.tarotCards().map((c, i) => {
        if (i === selectedIdx || c.isWinner) {
          return { ...c, flipped: true, selected: i === selectedIdx };
        }
        return c;
      });
      this.tarotCards.set(cardsList);

      const details = this.sessionDetails();
      if (details && details.drawType === 3) {
        this.toastService.showToast(`Đã rút thành công bộ ${cardsList.length} lá bài Tarot!`, 'success');
      } else {
        const winnerCard = cardsList.find(c => c.isWinner);
        if (winnerCard) {
          this.toastService.showToast(`Bạn đã rút được lá bài: ${winnerCard.name}!`, 'success');
        }
      }
    }, 2000);
  }

  public skipTarot() {
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);
    this.isTarotRunning.set(false);
    this.tarotDone.set(true);

    const cardsList = this.tarotCards().map(c => ({ ...c, flipped: true }));
    this.tarotCards.set(cardsList);

    const details = this.sessionDetails();
    if (details && details.drawType === 3) {
      this.toastService.showToast(`Kết quả rút bộ ${cardsList.length} lá bài Tarot!`, 'success');
    } else {
      const winnerCard = cardsList.find(c => c.isWinner);
      if (winnerCard) {
        this.toastService.showToast(`Kết quả rút bài: ${winnerCard.name}!`, 'success');
      }
    }
  }

  public getTarotDesc(cardName: string): string {
    const cards = [
      { name: 'The Fool (Chàng Khờ)', desc: 'Khởi đầu mới, hành trình phiêu lưu và niềm tin thuần khiết.' },
      { name: 'The Magician (Nhà Ảo Thuật)', desc: 'Ý chí mạnh mẽ, tài năng thiên bẩm và khả năng hiện thực hóa ước mơ.' },
      { name: 'The High Priestess (Nữ Tư Tế)', desc: 'Trực giác nhạy bén, tri thức bí ẩn và thế giới nội tâm sâu sắc.' },
      { name: 'The Empress (Nữ Hoàng)', desc: 'Sự sung túc, khả năng sáng tạo, tình mẫu tử và thiên nhiên trù phú.' },
      { name: 'The Emperor (Hoàng Đế)', desc: 'Quyền lực, kỷ luật thép, sự bảo hộ và tính trật tự.' },
      { name: 'The Hierophant (Giáo Hoàng)', desc: 'Truyền thống, niềm tin tôn giáo, sự giáo dục và lời khuyên thông thái.' },
      { name: 'The Lovers (Tình Nhân)', desc: 'Tình yêu đôi lứa, sự hòa hợp và những lựa chọn quan trọng từ trái tim.' },
      { name: 'The Chariot (Chiến Xa)', desc: 'Chiến thắng vượt bậc nhờ ý chí kiên định và sự kiểm soát.' },
      { name: 'Strength (Sức Mạnh)', desc: 'Lòng quả cảm, sự nhẫn nại và sức mạnh tinh thần thuần hóa nghịch cảnh.' },
      { name: 'The Hermit (Ẩn Sĩ)', desc: 'Sự chiêm nghiệm, tìm kiếm chân lý nội tâm và sự cô độc thông thái.' },
      { name: 'Wheel of Fortune (Vòng Quay Số Phận)', desc: 'Sự thay đổi định mệnh, cơ hội bất ngờ và chu kỳ mới.' },
      { name: 'Justice (Công Lý)', desc: 'Sự công bằng, chân lý, luật nhân quả và quyết định sáng suốt.' },
      { name: 'The Hanged Man (Kẻ Treo)', desc: 'Sự hy sinh cống hiến, góc nhìn mới mẻ và sự tạm dừng cần thiết.' },
      { name: 'Death (Tử Thần)', desc: 'Sự kết thúc để khởi đầu mới, chuyển hóa sâu sắc và buông bỏ.' },
      { name: 'Temperance (Tiết Độ)', desc: 'Sự cân bằng, hòa hợp, kiên nhẫn và dòng chảy trung dung.' },
      { name: 'The Devil (Ác Quỷ)', desc: 'Sự ràng buộc vật chất, cám dỗ và nỗi sợ hãi vô hình.' },
      { name: 'The Tower (Tòa Tháp)', desc: 'Sự sụp đổ bất ngờ, thay đổi đột ngột giải phóng khỏi xiềng xích.' },
      { name: 'The Star (Ngôi Sao)', desc: 'Niềm hy vọng, sự chữa lành vết thương lòng và niềm tin vào tương lai.' },
      { name: 'The Moon (Mặt Trăng)', desc: 'Sự mơ hồ, ảo ảnh, nỗi sợ tiềm thức và trực giác trỗi dậy.' },
      { name: 'The Sun (Mặt Trời)', desc: 'Thành công rực rỡ, niềm vui tràn ngập, năng lượng tích cực và sự tỏ tường.' },
      { name: 'Judgement (Phán Xét)', desc: 'Sự thức tỉnh tâm linh, tiếng gọi lương tri và sự tha thứ giải thoát.' },
      { name: 'The World (Thế Giới)', desc: 'Sự hoàn thành viên mãn, thành tựu trọn vẹn và sự tự do tuyệt đối.' }
    ];
    const clean = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = clean(cardName);
    const found = cards.find(c => clean(c.name).includes(target) || target.includes(clean(c.name)));
    return found ? found.desc : 'Một lá bài may mắn mang thông điệp tích cực cho bạn hôm nay.';
  }


  ngOnDestroy() {
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);
  }
}
