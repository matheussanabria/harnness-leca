@Component({ selector: 'app-header', standalone: true, imports: [RouterLink],
  template: `<header class="header"><a routerLink="/">57Multimarcas</a>
    <app-user-menu [user]="user" (login)="login.emit()" /></header>` })
export class HeaderComponent { @Input() user: User | null = null; @Output() login = new EventEmitter(); }