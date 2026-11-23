@Component({ selector: 'app-count', standalone: true, template: `<span class="count">{{ n > 99 ? '99+' : n }}</span>` })
export class CountComponent { @Input() n = 0; }