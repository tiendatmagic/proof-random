import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';

@Component({
  selector: 'app-standard-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './standard-game.component.html'
})
export class StandardGameComponent extends BaseGameComponent implements OnDestroy {
  ngOnDestroy() {}
}
