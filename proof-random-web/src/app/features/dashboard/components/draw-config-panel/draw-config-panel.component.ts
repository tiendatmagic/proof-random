import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-draw-config-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './draw-config-panel.component.html',
  styleUrls: ['./draw-config-panel.component.css']
})
export class DrawConfigPanelComponent {
  @Input() drawType = 2;
  @Input() selectedSkin = '';
  @Output() selectedSkinChange = new EventEmitter<string>();

  @Input() numMin = 1;
  @Output() numMinChange = new EventEmitter<number>();

  @Input() numMax = 100;
  @Output() numMaxChange = new EventEmitter<number>();

  @Input() numWinners = 1;
  @Output() numWinnersChange = new EventEmitter<number>();

  @Input() diceSides = 6;
  @Output() diceSidesChange = new EventEmitter<number>();

  @Input() numTeams = 3;
  @Output() numTeamsChange = new EventEmitter<number>();

  public getSeatingCols(): number {
    if (this.selectedSkin.startsWith('Seating-')) {
      return parseInt(this.selectedSkin.split('-')[1]) || 4;
    }
    return 4;
  }

  public changeSeatingCols(cols: number) {
    this.selectedSkinChange.emit(`Seating-${cols}`);
  }
}
