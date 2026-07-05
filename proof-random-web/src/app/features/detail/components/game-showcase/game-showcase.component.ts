import { Component, Input, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

// Imports 16 components con
import { LuckyWheelGameComponent } from './components/lucky-wheel-game/lucky-wheel-game.component';
import { RacingGameComponent } from './components/racing-game/racing-game.component';
import { MysteryBoxGameComponent } from './components/mystery-box-game/mystery-box-game.component';
import { BauCuaGameComponent } from './components/bau-cua-game/bau-cua-game.component';
import { ScratchCardGameComponent } from './components/scratch-card-game/scratch-card-game.component';
import { VietlottGameComponent } from './components/vietlott-game/vietlott-game.component';
import { PlinkoGameComponent } from './components/plinko-game/plinko-game.component';
import { SlotMachineGameComponent } from './components/slot-machine-game/slot-machine-game.component';
import { CardDrawGameComponent } from './components/card-draw-game/card-draw-game.component';
import { OanTuTiGameComponent } from './components/oan-tu-ti-game/oan-tu-ti-game.component';
import { SequenceGameComponent } from './components/sequence-game/sequence-game.component';
import { SeatingGameComponent } from './components/seating-game/seating-game.component';
import { WhatToEatGameComponent } from './components/what-to-eat-game/what-to-eat-game.component';
import { TarotGameComponent } from './components/tarot-game/tarot-game.component';
import { BingoGameComponent } from './components/bingo-game/bingo-game.component';
import { StandardGameComponent } from './components/standard-game/standard-game.component';

@Component({
  selector: 'app-game-showcase',
  standalone: true,
  imports: [
    CommonModule,
    LuckyWheelGameComponent,
    RacingGameComponent,
    MysteryBoxGameComponent,
    BauCuaGameComponent,
    ScratchCardGameComponent,
    VietlottGameComponent,
    PlinkoGameComponent,
    SlotMachineGameComponent,
    CardDrawGameComponent,
    OanTuTiGameComponent,
    SequenceGameComponent,
    SeatingGameComponent,
    WhatToEatGameComponent,
    TarotGameComponent,
    BingoGameComponent,
    StandardGameComponent
  ],
  templateUrl: './game-showcase.component.html'
})
export class GameShowcaseComponent implements OnDestroy {
  @Input() skinType: string = '';

  public readonly sessionDetails = signal<any | null>(null);
  public readonly clientResult = signal<any | null>(null);

  @Input('sessionDetails') set _sessionDetails(val: any) {
    this.sessionDetails.set(val);
  }

  @Input('clientResult') set _clientResult(val: any) {
    this.clientResult.set(val);
  }

  ngOnDestroy() {}
}
