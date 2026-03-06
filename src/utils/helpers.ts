/**
 * Format currency values
 */
export const formatCurrency = (value: number | null | undefined | string): string => {
  if (!value && value !== 0) return '$0.00'
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(numValue)
}

/**
 * Format dates
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Format short date (DD/MM/YYYY)
 */
export const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Get lote status label
 * D: Disponible | V: Vendido | B: Bloqueado | A: Apartado
 */
export const getLoteStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'D':
      return 'Disponible'
    case 'V':
      return 'Vendido'
    case 'B':
      return 'Bloqueado'
    case 'A':
      return 'Apartado'
    default:
      return status || '-'
  }
}

/**
 * Get lote status color
 */
export const getLoteStatusColor = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'D': // Disponible
      return 'bg-[#eaae4c] text-black'
    case 'V': // Vendido
      return 'bg-[#504840] text-white'
    case 'B': // Bloqueado
      return 'bg-red-600 text-white'
    case 'A': // Apartado
      return 'bg-[#9e9f92] text-white'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get venta (sale) status label
 * A: Activa | C: Cancelada
 */
export const getVentaStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'A':
      return 'Activa'
    case 'C':
      return 'Cancelada'
    default:
      return status || '-'
  }
}

/**
 * Get venta status color
 */
export const getVentaStatusColor = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'A': // Activa
      return 'bg-[#eaae4c] text-black'
    case 'C': // Cancelada
      return 'bg-red-600 text-white'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get pago (payment) status label
 * P: Pagado | C: Cancelado
 */
export const getPagoStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'P':
      return 'Pagado'
    case 'C':
      return 'Cancelado'
    default:
      return status || '-'
  }
}

/**
 * Get pago status color
 */
export const getPagoStatusColor = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'P': // Pagado
      return 'bg-[#eaae4c] text-black'
    case 'C': // Cancelado
      return 'bg-red-600 text-white'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get desarrollo (development) status label
 * A: Activo | V: Vendido
 */
export const getDesarrolloStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'A':
      return 'Activo'
    case 'V':
      return 'Vendido'
    default:
      return status || '-'
  }
}

/**
 * Get desarrollo status color
 */
export const getDesarrolloStatusColor = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'A': // Activo
      return 'bg-[#eaae4c] text-black'
    case 'V': // Vendido
      return 'bg-[#504840] text-white'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get status label (Generic for Desarrollo)
 * A: Activo | I: Inactivo | V: Vendido
 */
export const getStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'A':
      return 'Activo'
    case 'I':
      return 'Inactivo'
    case 'V':
      return 'Vendido'
    case 'P':
      return 'Pagado'
    case 'AP':
      return 'Apartado'
    default:
      return status || '-'
  }
}
