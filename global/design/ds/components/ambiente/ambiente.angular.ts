// environment.ts
export const environment = { production: false, label: 'DESENVOLVIMENTO' };

@Component({ selector: 'app-env-banner', standalone: true,
  template: `@if (label) { <div class="env" [class]="'env--' + kind" role="note">{{ label }}</div> }` })
export class EnvBannerComponent { label = environment.production ? '' : environment.label; kind = 'dev'; }