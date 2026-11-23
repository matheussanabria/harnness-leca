tipo = signal('carro');
selected = new Set<string>();
toggle = (k: string) => this.selected.has(k) ? this.selected.delete(k) : this.selected.add(k);