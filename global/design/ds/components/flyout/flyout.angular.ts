// user-menu.component.ts
type Role = 'cliente' | 'vendedor' | 'financeiro' | 'admin';
interface Item { label: string; path: string; icon: string }
interface Group { title: string; icon: string; items: Item[] }

const GROUPS: Record<string, Group> = {
  vendas: { title: 'Vendas', icon: 'dollar', items: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Veículos', path: '/admin/veiculos', icon: 'car' },
    { label: 'Leads', path: '/admin/leads', icon: 'users' },
    { label: 'Cadastrar veículo', path: '/admin/veiculos/novo', icon: 'plus' } ] },
  gerenciamento: { title: 'Gerenciamento', icon: 'sliders', items: [
    { label: 'Marcas', path: '/admin/marcas', icon: 'sliders' }, /* Modelos, Versões, Itens, Motores, Cores… */ ] },
  financeiro: { title: 'Financeiro', icon: 'wallet', items: [
    { label: 'Fluxo de Caixa', path: '/admin/financeiro/fluxo', icon: 'wallet' } /* Receitas, Despesas, Contas… */ ] },
  conta: { title: 'Minha conta', icon: 'user', items: [
    { label: 'Configurações', path: '/conta', icon: 'gear' } ] },
};

const BY_ROLE: Record<Role, (keyof typeof GROUPS)[]> = {
  cliente: ['conta'],
  vendedor: ['vendas', 'conta'],
  financeiro: ['financeiro', 'conta'],
  admin: ['vendas', 'gerenciamento', 'financeiro', 'conta'],
};

@Component({
  selector: 'app-user-menu', standalone: true, imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './user-menu.component.html', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  private auth = inject(AuthService);
  private bp = inject(BreakpointObserver);
  open = signal(false);
  active = signal<string | null>(null);              // grupo com painel aberto
  isMobile = toSignal(this.bp.observe('(max-width: 991px)').pipe(map(r => r.matches)), { initialValue: false });
  groups = computed(() => BY_ROLE[this.auth.role()].map(k => ({ key: k, ...GROUPS[k] })));

  show = (key: string) => this.active.set(key);
  hide = () => !this.isMobile() && this.active.set(null);
  toggle = (key: string) => this.active.update(a => (a === key ? null : key));

  @HostListener('document:keydown.escape') onEsc() { this.active() ? this.active.set(null) : this.open.set(false); }
  @HostListener('document:click', ['$event']) onDoc(e: Event) { if (!(e.target as HTMLElement).closest('app-user-menu')) this.open.set(false); }
}

// user-menu.component.html
// <div class="user-menu" role="menu" (mouseleave)="hide()">
//   @for (g of groups(); track g.key) {
//     <div class="um-group" [class.is-open]="active() === g.key" (mouseenter)="!isMobile() && show(g.key)">
//       <button class="um-group__head" role="menuitem" aria-haspopup="menu"
//               [attr.aria-expanded]="active() === g.key"
//               (click)="isMobile() ? toggle(g.key) : show(g.key)" (focus)="!isMobile() && show(g.key)">…</button>
//       <div class="um-flyout" role="menu">
//         <div class="um-flyout__panel">
//           @for (i of g.items; track i.path) { <a role="menuitem" [routerLink]="i.path" (click)="open.set(false)">{{ i.label }}</a> }
//         </div>
//       </div>
//     </div>
//   }
// </div>