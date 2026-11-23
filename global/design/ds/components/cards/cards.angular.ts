@Component({ selector: 'app-card', standalone: true,
  template: `<article class="card" [class.card--product]="variant === 'product'"><ng-content /></article>` })
export class CardComponent { @Input() variant: 'default' | 'product' = 'default'; }