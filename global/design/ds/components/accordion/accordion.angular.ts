@Component({ selector: 'app-accordion', standalone: true,
  template: `<button class="acc__head" [attr.aria-expanded]="open" (click)="open = !open">{{ title }}</button>
    @if (open) { <div class="acc__body"><ng-content></ng-content></div> }` })
export class AccordionComponent { @Input() title = ''; open = false; }