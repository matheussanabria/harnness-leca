// AppShell.jsx  (React 18)
import { EnvBanner } from './EnvBanner';
import { Header } from './Header';
import { SideNav } from './SideNav';
import { Footer } from './Footer';
import './app.css';

export function AppShell({ header, nav, footer, children }) {
  return (
    <div className="app">
      <EnvBanner />
      <Header {...header} />
      <div className="app__body">
        <SideNav items={nav} />
        <main id="conteudo">{children}</main>
      </div>
      <Footer {...footer} />
    </div>
  );
}