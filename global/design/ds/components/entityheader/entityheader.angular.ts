@Component({ selector: 'app-entity-header', standalone: true,
  template: `<header class="entity"><small>{{ kicker }}</small><h1>{{ name }}</h1><ng-content /></header>` })
export class EntityHeaderComponent { @Input() kicker = ''; @Input() name = ''; }