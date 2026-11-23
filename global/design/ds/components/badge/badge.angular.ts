@Component({ selector: 'app-pill', standalone: true,
  template: `<span class="pill" [class]="'pill--' + tone"><ng-content></ng-content></span>` })
export class PillComponent { @Input() tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral'; }