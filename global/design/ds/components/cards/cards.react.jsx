// Card.jsx  (React 18)
import './card.css';

export function Card({ variant = 'default', as: Tag = 'article', onClick, children }) {
  const clickable = !!onClick;
  return (
    <Tag className={'card card--' + variant} onClick={onClick}
      role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e) : undefined}>
      {children}
    </Tag>
  );
}
export const Indicator = ({ title, value, delta }) => (
  <Card variant="indicator"><h3 className="card__title">{title}</h3><p className="card__value">{value}</p>{delta && <small className="card__delta">{delta}</small>}</Card>
);