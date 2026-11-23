email = new FormControl('', [Validators.required, Validators.email]);
// <input [formControl]="email" [attr.aria-invalid]="email.invalid && email.touched">
// @if (email.touched && email.invalid) { <span class="field__error">Informe um e-mail válido.</span> }