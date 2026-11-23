@Component({ selector: 'app-shell', standalone: true, imports: [RouterOutlet, SidenavComponent],
  template: `<app-env-banner /><app-header /><div class="app__body"><app-sidenav /><main><router-outlet /></main></div><app-footer />` })
export class AppShellComponent {}