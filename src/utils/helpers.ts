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
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by JS, which
  // shifts the displayed day backwards in negative-offset timezones (e.g. Mexico).
  // Appending T12:00:00 anchors the time to local noon, avoiding the shift.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? dateString + 'T12:00:00'
    : dateString
  const date = new Date(normalized)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Format full datetime with time (e.g. "1 de junio de 2026, 10:21 a. m.")
 */
export const formatDateTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(date)
}

/**
 * Format short date (DD/MM/YYYY)
 */
export const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? dateString + 'T12:00:00'
    : dateString
  const date = new Date(normalized)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Get lote status label
 * D: Disponible | V: Vendido | B: Bloqueado | A: Apartado | N: No disponible
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
    case 'N':
      return 'No disponible'
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
    case 'N': // No disponible
      return 'bg-slate-700 text-white'
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
 * Get pago forma de pago label
 */
export const getPagoFormaLabel = (formapago: number | null | undefined): string => {
  switch (formapago) {
    case 1:
      return 'Efectivo'
    case 2:
      return 'Transferencia Bancaria'
    case 3:
      return 'Cheque'
    case 4:
      return 'Tarjeta de Débito/Crédito'
    case 5:
      return 'Depósito Bancario'
    default:
      return formapago != null ? formapago.toString() : '-'
  }
}

/**
 * Calcula el recargo por atraso: $150 por cada 6 días vencidos.
 * fechaPago defaults to today if not provided.
 */
export const calcularRecargo = (fechaVencimiento: string, fechaPago?: string, diasTolerancia = 0): number => {
  const hoy = fechaPago ?? new Date().toISOString().split('T')[0]
  const venc = new Date(fechaVencimiento + 'T12:00:00')
  const pago = new Date(hoy + 'T12:00:00')
  const diffMs = pago.getTime() - venc.getTime()
  if (diffMs <= 0) return 0
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const effectiveDays = diffDays - diasTolerancia
  if (effectiveDays <= 0) return 0
  return Math.ceil(effectiveDays / 6) * 150
}

export const FORMAS_PAGO = [
  { value: 1, label: 'Efectivo' },
  { value: 2, label: 'Transferencia Bancaria' },
  { value: 3, label: 'Cheque' },
  { value: 4, label: 'Tarjeta de Débito/Crédito' },
  { value: 5, label: 'Depósito Bancario' },
  { value: 6, label: 'Ruta de cobranza' },
] as const

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

export const MOTIVOS_CONVENIO = [
  'Atraso en pagos',
  'Dificultad económica temporal',
  'Reestructuración de deuda',
  'Acuerdo voluntario',
  'Otro',
] as const

export const getConvenioStatusLabel = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'V': return 'Vigente'
    case 'C': return 'Cumplido'
    case 'X': return 'Cancelado'
    default: return status || '-'
  }
}

export const getConvenioStatusColor = (status: string | null | undefined): string => {
  switch (status?.toUpperCase()) {
    case 'V': return 'bg-blue-100 text-blue-800'
    case 'C': return 'bg-green-100 text-green-800'
    case 'X': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
