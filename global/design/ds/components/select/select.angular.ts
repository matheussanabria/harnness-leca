<select formControlName="vendedor">
  <option value="">Selecione</option>
  @for (v of vendedores; track v.id) { <option [value]="v.id">{{ v.nome }}</option> }
</select>