// Shell.jsx  (React 18 + React Router)
import { Outlet } from 'react-router-dom';
import { EnvBanner } from './EnvBanner';
import { Header } from './Header';
import { Footer } from './Footer';

export function Shell({ header, footer }) {
  return (
    <>
      <EnvBanner />
      <Header {...header} />
      <main id="conteudo"><Outlet /></main>
      <Footer {...footer} />
    </>
  );
}
// body { display:grid; min-height:100vh; grid-template-rows:auto auto 1fr auto }