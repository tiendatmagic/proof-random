import { Directive, Input, OnDestroy, signal } from '@angular/core';

@Directive()
export abstract class BaseGameComponent implements OnDestroy {
  @Input() skinType: string = '';

  public readonly sessionDetails = signal<any | null>(null);
  public readonly clientResult = signal<any | null>(null);

  @Input('sessionDetails') set _sessionDetails(val: any) {
    this.sessionDetails.set(val);
  }

  @Input('clientResult') set _clientResult(val: any) {
    this.clientResult.set(val);
  }

  public isWinnerIndex(idx: number): boolean {
    const details = this.sessionDetails();
    return details && details.result !== undefined && details.result !== null && Number(details.result) === idx;
  }

  public isWinnerIndexInMulti(idx: number): boolean {
    const details = this.sessionDetails();
    if (!details || !details.result) return false;
    const winnerIndices = details.result.split(',').map(Number);
    return winnerIndices.includes(idx);
  }

  public isNumberWinners(): boolean {
    const res = this.clientResult();
    if (!res || !res.winners || res.winners.length === 0) return false;
    return !isNaN(Number(res.winners[0]));
  }

  abstract ngOnDestroy(): void;
}
