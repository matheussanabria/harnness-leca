@Input() note!: Note;
@Output() remove = new EventEmitter<number>();
expired = computed(() => this.note.expiresAt < Date.now());