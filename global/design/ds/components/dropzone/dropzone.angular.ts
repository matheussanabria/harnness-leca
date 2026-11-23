@HostListener('drop', ['$event']) onDrop(e: DragEvent) {
  e.preventDefault();
  this.files.update(f => [...f, ...Array.from(e.dataTransfer?.files ?? [])]);
}