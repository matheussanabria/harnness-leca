@Component({ selector: 'app-shell', standalone: true, imports: [RouterOutlet, EnvBannerComponent, HeaderComponent, FooterComponent],
  template: `<app-env-banner /><app-header /><main><router-outlet /></main><app-footer />` })
export class ShellComponent {}