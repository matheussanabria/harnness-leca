active = signal('resumo');
// @for (t of tabs; track t.id) { <button role="tab" [attr.aria-selected]="active() === t.id" (click)="active.set(t.id)">{{ t.label }}</button> }