@Component({ selector: 'app-footer', standalone: true,
  template: `<footer class="footer"><div class="footer__main"><ng-content></ng-content></div>
    <div class="footer__legal">© {{ year }} 57Multimarcas</div></footer>` })
export class FooterComponent { year = new Date().getFullYear(); }