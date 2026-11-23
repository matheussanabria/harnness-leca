@Component({ selector: 'app-button', standalone: true,
  template: `<button class="btn" [class]="'btn--' + variant" [disabled]="disabled" type="button">
    <ng-content></ng-content></button>` })
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled = false;
}