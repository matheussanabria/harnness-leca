// npm i lucide-react
import { BarChart3, Car, Cog, CreditCard, FileText, GitBranch, Landmark, LayoutDashboard,
  List, Palette, Percent, Plus, Sparkles, Tag, TrendingDown, TrendingUp, Users } from 'lucide-react';

export const ITEM_ICON = {
  // Vendas
  'vendas.dashboard': LayoutDashboard, 'vendas.veiculos': Car, 'vendas.leads': Users, 'vendas.cadastrar': Plus,
  // Gerenciamento
  'ger.marcas': Tag, 'ger.modelos': List, 'ger.versoes': GitBranch, 'ger.itens': Sparkles,
  'ger.caracteristicas': List, 'ger.categorias': Tag, 'ger.motores': Cog, 'ger.cores': Palette,
  // Financeiro
  'fin.dashboard': LayoutDashboard, 'fin.fluxo': BarChart3, 'fin.receitas': TrendingUp, 'fin.despesas': TrendingDown,
  'fin.categorias': Tag, 'fin.contas': Landmark, 'fin.cartoes': CreditCard, 'fin.veiculos': Car,
  'fin.colaboradores': Users, 'fin.comissoes': Percent, 'fin.folha': FileText, 'fin.relatorios': BarChart3,
  // Minha conta
  'conta.config': Cog,
};

// uso
const Icon = ITEM_ICON[item.key];
<Link role="menuitem" to={item.to}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /> {item.label}</Link>