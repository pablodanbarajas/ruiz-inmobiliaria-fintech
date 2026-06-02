export type AdminPanelRole =
  | 'admin'
  | 'finanzas'
  | 'vendedor'
  | 'contratos'
  | 'cobranza_caja'

export type UserRole = AdminPanelRole | 'cliente'

export const ADMIN_PANEL_ROLES: AdminPanelRole[] = [
  'admin',
  'finanzas',
  'vendedor',
  'contratos',
  'cobranza_caja',
]

export const ASSIGNABLE_ADMIN_ROLES: AdminPanelRole[] = [...ADMIN_PANEL_ROLES]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  finanzas: 'Finanzas',
  vendedor: 'Vendedor',
  contratos: 'Contratos',
  cobranza_caja: 'Cobranza/Caja',
  cliente: 'Cliente',
}

export type CapabilityKey =
  | 'ver_desarrollos'
  | 'editar_desarrollos'
  | 'ver_lotes'
  | 'editar_lotes'
  | 'bloquear_lotes'
  | 'desbloquear_lotes'
  | 'apartar_lotes'
  | 'cancelar_apartado'
  | 'editar_clientes'
  | 'editar_ventas'
  | 'ver_lotes_vendidos'
  | 'liberar_lotes_vendidos'
  | 'registrar_pagos'
  | 'consultar_pagos'
  | 'consultar_estados_cuenta'
  | 'administrar_usuarios'

export const ROLE_CAPABILITIES: Record<AdminPanelRole, Record<CapabilityKey, boolean>> = {
  admin: {
    ver_desarrollos: true,
    editar_desarrollos: true,
    ver_lotes: true,
    editar_lotes: true,
    bloquear_lotes: true,
    desbloquear_lotes: true,
    apartar_lotes: true,
    cancelar_apartado: true,
    editar_clientes: true,
    editar_ventas: true,
    ver_lotes_vendidos: true,
    liberar_lotes_vendidos: true,
    registrar_pagos: true,
    consultar_pagos: true,
    consultar_estados_cuenta: true,
    administrar_usuarios: true,
  },
  finanzas: {
    ver_desarrollos: true,
    editar_desarrollos: false,
    ver_lotes: true,
    editar_lotes: false,
    bloquear_lotes: true,
    desbloquear_lotes: true,
    apartar_lotes: true,
    cancelar_apartado: true,
    editar_clientes: false,
    editar_ventas: false,
    ver_lotes_vendidos: true,
    liberar_lotes_vendidos: true,
    registrar_pagos: true,
    consultar_pagos: true,
    consultar_estados_cuenta: true,
    administrar_usuarios: false,
  },
  vendedor: {
    ver_desarrollos: false,
    editar_desarrollos: false,
    ver_lotes: true,
    editar_lotes: false,
    bloquear_lotes: true,
    desbloquear_lotes: false,
    apartar_lotes: false,
    cancelar_apartado: false,
    editar_clientes: false,
    editar_ventas: false,
    ver_lotes_vendidos: false,
    liberar_lotes_vendidos: false,
    registrar_pagos: false,
    consultar_pagos: false,
    consultar_estados_cuenta: false,
    administrar_usuarios: false,
  },
  contratos: {
    ver_desarrollos: false,
    editar_desarrollos: false,
    ver_lotes: true,
    editar_lotes: false,
    bloquear_lotes: true,
    desbloquear_lotes: false,
    apartar_lotes: true,
    cancelar_apartado: false,
    editar_clientes: true,
    editar_ventas: true,
    ver_lotes_vendidos: true,
    liberar_lotes_vendidos: false,
    registrar_pagos: false,
    consultar_pagos: true,
    consultar_estados_cuenta: true,
    administrar_usuarios: false,
  },
  cobranza_caja: {
    ver_desarrollos: false,
    editar_desarrollos: false,
    ver_lotes: true,
    editar_lotes: false,
    bloquear_lotes: false,
    desbloquear_lotes: false,
    apartar_lotes: false,
    cancelar_apartado: false,
    editar_clientes: false,
    editar_ventas: true,
    ver_lotes_vendidos: true,
    liberar_lotes_vendidos: false,
    registrar_pagos: true,
    consultar_pagos: true,
    consultar_estados_cuenta: true,
    administrar_usuarios: false,
  },
}

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  ver_desarrollos: 'Ver desarrollos',
  editar_desarrollos: 'Agregar / modificar desarrollos',
  ver_lotes: 'Ver lotes y su estatus',
  editar_lotes: 'Agregar / modificar lotes',
  bloquear_lotes: 'Bloquear lotes',
  desbloquear_lotes: 'Desbloquear lote (liberar)',
  apartar_lotes: 'Apartar lote',
  cancelar_apartado: 'Cancelar apartado (liberar lote)',
  editar_clientes: 'Agregar / modificar clientes',
  editar_ventas: 'Registrar / modificar ventas',
  ver_lotes_vendidos: 'Ver listado de lotes vendidos',
  liberar_lotes_vendidos: 'Liberar lotes vendidos',
  registrar_pagos: 'Registro de pagos',
  consultar_pagos: 'Consultar pagos',
  consultar_estados_cuenta: 'Consultar estados de cuenta',
  administrar_usuarios: 'Administración de usuarios',
}
