import {
  ChefHat,
  Goal,
  LayoutDashboard,
  Leaf,
  Settings,
  Soup,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Desktop sidebar (spec §Navigation: Dashboard, Log Food, Meals, Recipes, Progress, Insights, Goals, Settings). */
export const sidebarNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/log", label: "Log Food", icon: UtensilsCrossed },
  { href: "/app/meals", label: "Meals", icon: Soup },
  { href: "/app/recipes", label: "Recipes", icon: ChefHat },
  { href: "/app/progress", label: "Progress", icon: TrendingUp },
  { href: "/app/insights", label: "Insights", icon: Sparkles },
  { href: "/app/goals", label: "Goals", icon: Goal },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

/** Mobile bottom nav: Home / Log / Progress / Insights / Profile (spec §Navigation). */
export const bottomNav: NavItem[] = [
  { href: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/app/log", label: "Log", icon: UtensilsCrossed },
  { href: "/app/progress", label: "Progress", icon: TrendingUp },
  { href: "/app/insights", label: "Insights", icon: Sparkles },
  { href: "/app/settings", label: "Profile", icon: Settings },
];

export const brand = {
  name: "EatWise",
  icon: Leaf,
};
