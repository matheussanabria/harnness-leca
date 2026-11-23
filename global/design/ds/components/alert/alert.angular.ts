@Component({ selector: 'app-alert', standalone: true,
  template: `@if (open) {
    <div class="alert" [class]="'alert--' + type" role="alert">
      <ng-content></ng-content>
      <button class="alert__close" (click)="open = false" aria-label="Fechar">×</button>
    </div> }` })
export class AlertComponent { @Input() type = 'info'; open = true; }