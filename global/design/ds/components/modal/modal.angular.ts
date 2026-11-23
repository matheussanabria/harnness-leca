private dialog = inject(MatDialog);
confirmDelete(id: number) {
  this.dialog.open(ConfirmDialogComponent, { data: { title: 'Excluir lançamento' } })
    .afterClosed().subscribe(ok => ok && this.service.remove(id));
}