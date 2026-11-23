q = new FormControl('');
results$ = this.q.valueChanges.pipe(debounceTime(250), switchMap(v => this.api.search(v ?? '')));