page = signal(1);
slice = computed(() => this.rows().slice((this.page() - 1) * 10, this.page() * 10));