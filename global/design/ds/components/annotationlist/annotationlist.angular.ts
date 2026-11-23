open = signal<number | null>(0);
// <button [attr.aria-expanded]="open() === i" (click)="open.set(open() === i ? null : i)">