@for (c of crumbs; track c.url; let last = $last) {
  <li [attr.aria-current]="last ? 'page' : null">
    @if (last) { {{ c.label }} } @else { <a [routerLink]="c.url">{{ c.label }}</a> }
  </li>
}