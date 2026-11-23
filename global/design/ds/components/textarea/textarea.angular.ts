obs = new FormControl('', Validators.maxLength(200));
// <small>{{ obs.value?.length ?? 0 }}/200</small>