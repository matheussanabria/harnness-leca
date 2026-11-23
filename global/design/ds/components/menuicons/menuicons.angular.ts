// npm i lucide-angular
import { LucideAngularModule, BarChart3, Car, Cog, CreditCard, FileText, GitBranch, Landmark,
  LayoutDashboard, List, Palette, Percent, Plus, Sparkles, Tag, TrendingDown, TrendingUp, Users } from 'lucide-angular';

export const MENU_ICONS = { BarChart3, Car, Cog, CreditCard, FileText, GitBranch, Landmark,
  LayoutDashboard, List, Palette, Percent, Plus, Sparkles, Tag, TrendingDown, TrendingUp, Users };

// item de menu -> ícone
export const ITEM_ICON: Record<string, keyof typeof MENU_ICONS> = {
  // Vendas
  'vendas.dashboard': 'LayoutDashboard', 'vendas.veiculos': 'Car', 'vendas.leads': 'Users', 'vendas.cadastrar': 'Plus',
  // Gerenciamento
  'ger.marcas': 'Tag', 'ger.modelos': 'List', 'ger.versoes': 'GitBranch', 'ger.itens': 'Sparkles',
  'ger.caracteristicas': 'List', 'ger.categorias': 'Tag', 'ger.motores': 'Cog', 'ger.cores': 'Palette',
  // Financeiro
  'fin.dashboard': 'LayoutDashboard', 'fin.fluxo': 'BarChart3', 'fin.receitas': 'TrendingUp', 'fin.despesas': 'TrendingDown',
  'fin.categorias': 'Tag', 'fin.contas': 'Landmark', 'fin.cartoes': 'CreditCard', 'fin.veiculos': 'Car',
  'fin.colaboradores': 'Users', 'fin.comissoes': 'Percent', 'fin.folha': 'FileText', 'fin.relatorios': 'BarChart3',
  // Minha conta
  'conta.config': 'Cog',
};

// app.config.ts: importProvidersFrom(LucideAngularModule.pick(MENU_ICONS))
// template: <lucide-icon [img]="ICONS[ITEM_ICON[i.key]]" [size]="16" [strokeWidth]="1.8" />