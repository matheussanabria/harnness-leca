// Layout.jsx  (React 18)
import './grid.css';

export const Container = ({ fluid = false, children }) => (
  <div className={fluid ? 'container-fluid' : 'container-lg'}>{children}</div>
);
export const Row = ({ children }) => <div className="row">{children}</div>;
export const Col = ({ span = 12, md, sm, children }) => (
  <div className={['col-' + span, md && 'col-md-' + md, sm && 'col-sm-' + sm].filter(Boolean).join(' ')}>{children}</div>
);
// <Container fluid><Row><Col span={8}>…</Col><Col span={4}>…</Col></Row></Container>