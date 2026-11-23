rows = signal<Row[]>([]);
sortKey = signal<keyof Row>('desc');
sorted = computed(() => [...this.rows()].sort((a, b) =>
  String(a[this.sortKey()]).localeCompare(String(b[this.sortKey()]), 'pt-BR', { numeric: true })));

// template
// @for (r of sorted(); track r.id) { <tr><td>{{ r.desc }}</td></tr> }