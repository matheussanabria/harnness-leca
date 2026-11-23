form = this.fb.group({ marca: [''], modelo: [{ value: '', disabled: true }], versao: [{ value: '', disabled: true }] });

constructor(private fb: FormBuilder) {
  this.form.controls.marca.valueChanges.subscribe(m => {
    this.form.controls.modelo.reset({ value: '', disabled: !m });
    this.form.controls.versao.disable();
  });
}