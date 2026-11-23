idx = signal(0);
items = ['Hatch', 'Sedan', 'SUV', 'Picape'];
offset = (i: number) => { const n = this.items.length; let o = (((i - this.idx()) % n) + n) % n; return o > n / 2 ? o - n : o; };
next = () => this.idx.update(i => (i + 1) % this.items.length);