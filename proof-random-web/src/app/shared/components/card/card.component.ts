import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `<ng-content></ng-content>`,
  styles: [`
    :host {
      display: block;
    }
  `],
  host: {
    '[class.app-card]': '!interactive()',
    '[class.app-card-interactive]': 'interactive()',
    '[class.p-0]': "padding() === 'p-0'",
    '[class.p-3]': "padding() === 'p-3'",
    '[class.p-4]': "padding() === 'p-4'",
    '[class.p-5]': "padding() === 'p-5'",
    '[class.p-6]': "padding() === 'p-6'",
  }
})
export class CardComponent {
  interactive = input<boolean>(false);
  padding = input<string>('p-6');
}
