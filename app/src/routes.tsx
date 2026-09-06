import type { ComponentType } from "react";
import type { IconName } from "@/ui/icons";

// Telas — cada feature é um módulo isolado em src/features/*.
// Na Fase 4 os placeholders abaixo são substituídos pelas telas portadas.
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ShoppingList } from "@/features/list/ShoppingList";
import { RegisterPurchase } from "@/features/register/RegisterPurchase";
import { Products } from "@/features/products/Products";
import { Compare } from "@/features/compare/Compare";
import { History } from "@/features/history/History";
import { CalendarView } from "@/features/calendar/CalendarView";
import { SettingsView } from "@/features/settings/SettingsView";

/** props que o shell passa a toda tela — hoje só a navegação entre abas.
 *  A maioria das telas ignora; Registrar e o Modo Compra usam para "Ver histórico". */
export interface TelaProps {
  onNavigate: (rota: string) => void;
}

export interface RouteDef {
  id: string;
  label: string;
  icon: IconName;
  Component: ComponentType<Partial<TelaProps>>;
}

export const ROUTES: RouteDef[] = [
  { id: "dashboard", label: "Início", icon: "home", Component: Dashboard },
  { id: "shopping", label: "Lista", icon: "cart", Component: ShoppingList },
  { id: "purchase", label: "Registrar", icon: "plus", Component: RegisterPurchase },
  { id: "products", label: "Produtos", icon: "tag", Component: Products },
  { id: "compare", label: "Comparar", icon: "chart", Component: Compare },
  { id: "history", label: "Histórico", icon: "history", Component: History },
  { id: "calendar", label: "Calendário", icon: "calendar", Component: CalendarView },
  { id: "settings", label: "Config", icon: "settings", Component: SettingsView },
];

/** barra inferior no mobile mostra 5; o resto vai pro menu "Mais". */
export const MOBILE_TABS = ["dashboard", "shopping", "purchase", "products", "history"];
