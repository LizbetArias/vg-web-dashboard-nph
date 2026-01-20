// menu.model.ts

export interface MenuItem {
  title: string;
  path?: string;
  icon?: string;
  children?: MenuItem[];
  role?: string[];
}

export const MENU_ITEMS: MenuItem[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: "layout-dashboard",
    role: ["ADMIN", "USER"]
  },
  {
    title: "Principal",
    icon: "grid",
    children: [
      { title: "Usuarios", path: "/usuarios", icon: "users", role: ["ADMIN"] },
      { title: "Beneficiarios", path: "/modulo-beneficiarios/beneficiarios", icon: "user-plus", role: ["ADMIN", "USER"] },
      { title: "Talleres", path: "/modulo-talleres/talleres", icon: "hammer", role: ["ADMIN", "USER"] },
      { title: "Metas", path: "/modulo-metas/metas", icon: "target", role: ["ADMIN", "USER"] },
      { title: "Sesiones", path: "/modulo-sesiones/sesiones", icon: "calendar-clock", role: ["ADMIN", "USER"] },
    ],
  },
  {
    title: "Funcionalidades",
    icon: "layers",
    children: [
      { title: "Familias", path: "/modulo-familias/familias", icon: "home", role: ["ADMIN", "USER"] },
      { title: "Transformación", path: "/modulo-tranformacion/transformacion", icon: "sparkles", role: ["ADMIN", "USER"] },
      { title: "Practicas Parentales", path: "/modulo-praticas-parentales/practicas parentales", icon: "sparkles", role: ["ADMIN", "USER"] },
      { title: "Asistencias", path: "/modulo-asistencias/asistencias", icon: "clipboard-check", role: ["ADMIN", "USER"] },
      { title: "Temas", path: "/modulo-temas/temas", icon: "book-open", role: ["ADMIN", "USER"] },
      { title: "Reportes", path: "/modulo-reportes/reportes", icon: "bar-chart-3", role: ["ADMIN", "USER"] },
    ],
  },
];
