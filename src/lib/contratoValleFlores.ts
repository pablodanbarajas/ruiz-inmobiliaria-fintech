import { numeroALetras } from '@/utils/helpers'
import { CLAUSULADO_V7 } from '@/lib/contratoValleFloresClausulado'

// Builds the Valle de Flores contract (Carátula, clausulado V7 and Anexo B) as HTML.
// Data that legal or sales still have to provide is written as "(TEXTO EN MAYÚSCULAS)",
// which GenerarContrato lists as fields to complete before signing.

export type DesignadoContrato = {
  rol: 'sustituto' | 'beneficiario'
  orden: number
  nombre: string | null
  domicilio: string | null
  telefono: string | null
  email: string | null
  parentesco: string | null
}

export type PagoCorrida = {
  nopago: number
  fecha: string | null
  mensualidad: number | null
  saldo: number | null
}

export type ContratoValleFloresData = {
  ventaid: number | string
  fechaCelebracion: Date
  cliente: {
    nombre: string | null
    domicilio: string
    rfc: string | null
    telefono: string | null
    emails: (string | null | undefined)[]
  }
  espacio: {
    tipolote: string | null
    zona: string | null
  }
  venta: {
    precio: number | null
    enganche: number | null
    plazo: number | null
    mensualidad: number | null
    fechaPrimeraMensualidad: string | null
  }
  corrida: PagoCorrida[]
  designados: DesignadoContrato[]
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Clause 4 fees. Criptas are not a contract type yet, so they stay pending.
const CUOTA_ANUAL: Record<string, number> = { nicho: 300, gaveta: 300, columbario: 300, fosa: 600 }
const TIPOS_CONTRATO = ['fosa', 'gaveta', 'columbario', 'nicho'] as const

const COLOR_ENCABEZADO = '#1D2F54'
const FUENTE = 'font-family: Arial, sans-serif; font-size: 10pt'

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const texto = (value: string | null | undefined, pendiente?: string) => {
  const limpio = value?.trim()
  if (limpio) return escapeHtml(limpio)
  return pendiente ? `(${pendiente})` : ''
}

const fechaLarga = (date: Date) => `${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`

/** Reads a date-only value (YYYY-MM-DD or an ISO timestamp) at local noon so it never shifts a day. */
const parseFecha = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return isNaN(date.getTime()) ? null : date
}

const monto = (value: number | null | undefined) =>
  value == null ? '' : `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`

const montoConLetra = (value: number | null | undefined) => {
  if (value == null) return ''
  const centavos = Math.round((Math.abs(value) % 1) * 100)
  return `${monto(value)} (${numeroALetras(value)} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.)`
}

const casilla = (marcada: boolean, etiqueta: string) => `${marcada ? '☒' : '☐'} ${etiqueta}`

/** Contado: one payment. Contado comercial: three. Crédito: 6 to 120 months (Cláusula Segunda). */
const modalidadDePago = (plazo: number | null): 'contado' | 'comercial' | 'credito' | null => {
  if (plazo == null || plazo <= 1) return 'contado'
  if (plazo <= 3) return 'comercial'
  if (plazo >= 6) return 'credito'
  return null
}

const tipoContrato = (tipolote: string | null) => {
  const tipo = tipolote?.trim().toLowerCase() || ''
  return TIPOS_CONTRATO.find((candidato) => tipo.startsWith(candidato)) ?? null
}

/** First scheduled date by which payments without interest reach 70% of the price (Cláusula Tercera). */
const fechaSetentaPorCiento = (precio: number | null, corrida: PagoCorrida[]) => {
  if (!precio) return null
  let acumulado = 0
  for (const pago of corrida) {
    acumulado += pago.mensualidad || 0
    if (acumulado >= precio * 0.7 - 0.005) return parseFecha(pago.fecha)
  }
  return null
}

// ── Table helpers ─────────────────────────────────────────────────────────
const celda = 'border:1px solid #9aa5b5; padding:4px; vertical-align:top'

const encabezado = (titulo: string, columnas = 2) =>
  `<tr><td colspan="${columnas}" style="${celda}; background:${COLOR_ENCABEZADO}; color:#FFFFFF; font-weight:bold">${titulo}</td></tr>`

const fila = (concepto: string, valor: string) =>
  `<tr><td style="${celda}; width:38%; font-weight:bold">${concepto}</td><td style="${celda}">${valor || '&nbsp;'}</td></tr>`

const tabla = (filas: string) =>
  `<table cellspacing="0" style="width:100%; border-collapse:collapse; ${FUENTE}">${filas}</table>`

const separador = '<p>&nbsp;</p>'
const parrafo = (contenido: string, align = 'justify') => `<p style="text-align:${align}">${contenido}</p>`
const saltoDePagina = (contenido: string) => `<p style="page-break-before:always; text-align:center"><b>${contenido}</b></p>`

const bloquePersona = (titulo: string, persona: DesignadoContrato | undefined, aceptacion: string) => tabla(
  encabezado(titulo) +
  fila('Nombre completo', texto(persona?.nombre)) +
  fila('Domicilio', texto(persona?.domicilio)) +
  fila('Teléfono', texto(persona?.telefono)) +
  fila('Correo electrónico', texto(persona?.email)) +
  fila('Parentesco, en su caso', texto(persona?.parentesco)) +
  fila(aceptacion, 'Nombre y firma: __________________')
)

// ── Carátula ──────────────────────────────────────────────────────────────
const buildCaratula = (data: ContratoValleFloresData) => {
  const { cliente, espacio, venta, corrida } = data
  const tipo = tipoContrato(espacio.tipolote)
  const modalidad = modalidadDePago(venta.plazo)
  const esCredito = modalidad === 'credito' || modalidad === 'comercial'
  const pagos = corrida.filter((pago) => pago.nopago > 0)
  const ultimaFecha = parseFecha(pagos[pagos.length - 1]?.fecha)
  const primeraFecha = parseFecha(pagos[0]?.fecha) ?? parseFecha(venta.fechaPrimeraMensualidad)
  const totalCorrida = corrida.reduce((suma, pago) => suma + (pago.mensualidad || 0), 0)
  const fechaUsoAnticipado = fechaSetentaPorCiento(venta.precio, corrida)
  const cuota = tipo ? CUOTA_ANUAL[tipo] : undefined
  const noAplica = 'No aplica'

  const caracteristicas = [espacio.tipolote, espacio.zona && `Zona ${espacio.zona}`].filter(Boolean).join(' · ')

  const sustituto = data.designados.find((persona) => persona.rol === 'sustituto')
  const beneficiario = (orden: number) => data.designados.find((persona) => persona.rol === 'beneficiario' && persona.orden === orden)

  return [
    `<p style="text-align:center; font-size:12pt"><b>CARÁTULA - CONTRATO DE OTORGAMIENTO DE DERECHO PERSONAL DE USO SOBRE ESPACIO FUNERARIO</b></p>`,
    tabla(
      encabezado('DATOS DEL CONTRATO') +
      fila('Número de contrato', escapeHtml(String(data.ventaid))) +
      fila('Fecha de celebración', fechaLarga(data.fechaCelebracion)) +
      fila('Número y fecha de registro ante PROFECO', '(NÚMERO Y FECHA DE REGISTRO PROFECO)')
    ),
    separador,
    tabla(
      encabezado('DATOS DEL TITULAR') +
      fila('Nombre completo', texto(cliente.nombre)) +
      fila('Domicilio', texto(cliente.domicilio)) +
      fila('Registro Federal de Contribuyentes', texto(cliente.rfc)) +
      fila('Teléfono', texto(cliente.telefono)) +
      [0, 1, 2].map((indice) => fila(`Correo electrónico ${indice + 1}`, texto(cliente.emails[indice]))).join('')
    ),
    separador,
    tabla(
      encabezado('DATOS DEL ESPACIO FUNERARIO') +
      fila(
        'Tipo de espacio funerario',
        TIPOS_CONTRATO.map((candidato) => casilla(tipo === candidato, candidato)).join(' ') +
          (tipo ? '' : ` (CONFIRMAR TIPO DE ESPACIO PARA ${escapeHtml((espacio.tipolote || 'ESTE PRODUCTO').toUpperCase())})`)
      ) +
      fila('Capacidad', '(CAPACIDAD DEL ESPACIO)') +
      fila('Modalidad, en su caso', '') +
      fila('Dimensiones', 'Conforme al Anexo A') +
      fila('Características particulares', escapeHtml(caracteristicas)) +
      fila(
        'Asignación del espacio funerario',
        'La ubicación e identificación específica del Espacio Funerario serán determinadas con posterioridad a la celebración del presente Contrato y se harán constar en el Título de Derecho de Uso que GARDEL expida con motivo de su asignación, en términos de la Cláusula Primera.'
      )
    ),
    separador,
    tabla(
      encabezado('CONDICIONES DEL DERECHO DE USO') +
      fila('Vigencia', 'Indefinida, sujeta a los términos y causas de extinción previstas en el Contrato') +
      fila('Destino', 'Exclusivamente funerario') +
      fila('Fecha prevista para solicitar la utilización anticipada', fechaUsoAnticipado ? fechaLarga(fechaUsoAnticipado) : '(FECHA PREVISTA DE USO ANTICIPADO)') +
      fila('Condición económica para utilización anticipada', 'Haber cubierto cuando menos el 70% del precio total del Derecho de Uso, sujeto a las demás condiciones de la Cláusula Tercera.')
    ),
    separador,
    tabla(
      encabezado('CONTRAPRESTACIÓN DERECHO DE USO') +
      fila('Precio del derecho de uso', montoConLetra(venta.precio)) +
      fila(
        'Modalidad de pago',
        [casilla(modalidad === 'contado', 'Contado'), casilla(modalidad === 'comercial', 'Contado comercial'), casilla(modalidad === 'credito', 'Crédito')].join(' ') +
          (modalidad ? '' : ' (CONFIRMAR MODALIDAD DE PAGO)')
      ) +
      fila('Enganche, en su caso', venta.enganche ? montoConLetra(venta.enganche) : noAplica) +
      fila('Plazo/ número de parcialidades', esCredito && venta.plazo ? `${venta.plazo} (${numeroALetras(venta.plazo).toLowerCase()}) parcialidades` : noAplica) +
      fila('Periodicidad', esCredito ? 'Mensual' : noAplica) +
      fila('Importe de cada parcialidad', esCredito ? montoConLetra(venta.mensualidad) : noAplica) +
      fila('Tasa de interés ordinario anual', modalidad === 'credito' ? '(TASA DE INTERÉS ORDINARIO)' : noAplica) +
      fila('Tasa de interés moratorio', '1% (uno por ciento) mensual') +
      fila('Fecha de primer pago', primeraFecha ? fechaLarga(primeraFecha) : '') +
      fila('Fecha vencimiento final', ultimaFecha ? fechaLarga(ultimaFecha) : '') +
      fila('Importe total a pagar, incluidos intereses ordinarios del financiamiento, en su caso', montoConLetra(totalCorrida || venta.precio)) +
      fila('Medio de pago', '(MEDIO DE PAGO)') +
      fila('Cuenta o referencia de pago', '(CUENTA O REFERENCIA DE PAGO)') +
      fila('Calendario de pagos', esCredito ? 'Anexo B' : noAplica)
    ),
    separador,
    tabla(
      encabezado('CUOTA DE SERVICIOS DE JARDINERÍA, LIMPIEZA Y ACCESO') +
      fila('Periodicidad', 'Anual') +
      fila('Inicio de la obligación', 'Fecha de asignación') +
      fila('Cuota anual', cuota ? montoConLetra(cuota) : '(CUOTA ANUAL DEL ESPACIO)') +
      fila('Vencimiento', 'Fecha de Asignación y cada aniversario de ésta') +
      fila('Plazo de gracia', 'Dentro de los 5 (cinco) días naturales posteriores a la fecha en que resulte exigible cada anualidad.') +
      fila('Tasa de interés moratorio', '12% (doce por ciento) anual') +
      fila('Forma de pago', '(FORMA DE PAGO DE LA CUOTA)') +
      fila('Cuenta/referencia de pago', '(CUENTA O REFERENCIA DE LA CUOTA)')
    ),
    separador,
    bloquePersona('DATOS DEL TITULAR SUSTITUTO', sustituto, 'Aceptación del Titular Sustituto'),
    separador,
    bloquePersona('BENEFICIARIOS DEL DERECHO DE USO — Beneficiario 1, primer orden de prelación', beneficiario(1), 'Aceptación del Beneficiario'),
    separador,
    bloquePersona('BENEFICIARIOS DEL DERECHO DE USO — Beneficiario 2, segundo orden de prelación', beneficiario(2), 'Aceptación del Beneficiario'),
    separador,
    `<table cellspacing="0" style="width:100%; border-collapse:collapse; ${FUENTE}">` +
      `<tr><td style="${celda}; width:25%">&nbsp;</td><td style="${celda}; text-align:center; font-weight:bold">“GARDEL”</td><td style="${celda}; text-align:center; font-weight:bold">“EL TITULAR”</td></tr>` +
      `<tr><td style="${celda}; font-weight:bold">Razón Social</td><td style="${celda}">DISTRIBUIDORA GARDEL, S.A.P.I. DE C.V.</td><td style="${celda}; font-weight:bold">Nombre completo</td></tr>` +
      `<tr><td style="${celda}; font-weight:bold">Nombre de los representantes legales</td><td style="${celda}">José de Jesús Villalobos García, Presidente del Consejo de Administración y Santiago Alcocer Leal, Secretario del Consejo de Administración.</td><td style="${celda}">${texto(cliente.nombre)}</td></tr>` +
      `<tr><td style="${celda}; font-weight:bold">Datos del instrumento donde constan sus facultades</td><td style="${celda}">(DATOS DEL INSTRUMENTO DE FACULTADES)</td><td style="${celda}">&nbsp;</td></tr>` +
      `<tr><td style="${celda}; font-weight:bold">Firma</td><td style="${celda}"><br/><br/>&nbsp;</td><td style="${celda}"><br/><br/>&nbsp;</td></tr>` +
      `</table>`,
    parrafo('<i>La presente Carátula forma parte integrante del CONTRATO DE OTORGAMIENTO DE DERECHO PERSONAL DE USO SOBRE ESPACIO FUNERARIO celebrado entre Gardel y El Titular. Los datos y condiciones particulares contenidos en ella se sujetan en todo momento a los términos y condiciones establecidos en el clausulado del Contrato.</i>'),
  ].join('\n')
}

// ── Clausulado ────────────────────────────────────────────────────────────
const TITULOS_DE_SECCION = new Set(['Antecedentes', 'Declaraciones', 'Cláusulas'])
const ORDINALES = '(?:Primera|Segunda|Tercera|Cuarta|Quinta|Sexta|Séptima|Octava|Novena|Décima|Vigésima)'
const TITULO_DE_CLAUSULA = new RegExp(`^(${ORDINALES}(?: ${ORDINALES})?\\. [^.]+\\.)`)

const TABLA_TASAS = tabla(
  `<tr><td style="${celda}; font-weight:bold">Plazo de financiamiento</td>${['6 a 12 meses', '13 a 24 meses', '25 a 36 meses', '37 a 60 meses', '61 a 84 meses', '85 a 120 meses'].map((plazo) => `<td style="${celda}; text-align:center">${plazo}</td>`).join('')}</tr>` +
  `<tr><td style="${celda}; font-weight:bold">Tasa de interés ordinario anual</td>${['3%', '3.5%', '4%', '4.5%', '5%', '6%'].map((tasa) => `<td style="${celda}; text-align:center">${tasa}</td>`).join('')}</tr>`
)

const buildClausulado = (data: ContratoValleFloresData) => {
  const fecha = fechaLarga(data.fechaCelebracion)
  const cuerpo = CLAUSULADO_V7.map((linea) => {
    if (linea === '{{TABLA_TASAS}}') return TABLA_TASAS
    if (TITULOS_DE_SECCION.has(linea)) return parrafo(`<b>${linea}</b>`, 'center')
    const conFecha = escapeHtml(linea).replaceAll('{{fecha_celebracion}}', fecha)
    return parrafo(conFecha.replace(TITULO_DE_CLAUSULA, '<b>$1</b>'))
  })

  const firma = (lineas: string) => `<td style="padding:4px; text-align:center; vertical-align:top"><br/><br/>_________________________________<br/>${lineas}</td>`
  const firmas = `<table cellspacing="0" style="width:100%; border-collapse:collapse; ${FUENTE}">` +
    `<tr>${firma('“Gardel” Distribuidora Gardel, S.A.P.I de C.V. por conducto del Presidente del Consejo de Administración, el señor José de Jesús Villalobos García.')}${firma('“Gardel” Distribuidora Gardel, S.A.P.I de C.V. por conducto del Secretario del Consejo de Administración, el señor Santiago Alcocer Leal.')}</tr>` +
    `<tr>${firma(`“El Titular” ${texto(data.cliente.nombre)}, por su propio derecho.`)}<td>&nbsp;</td></tr>` +
    `<tr>${firma('Testigo')}${firma('Testigo')}</tr>` +
    `</table>`

  return [
    saltoDePagina('Contrato de otorgamiento de derecho personal sobre espacio funerario.'),
    ...cuerpo,
    separador,
    firmas,
  ].join('\n')
}

// ── Anexo B ───────────────────────────────────────────────────────────────
const buildAnexoB = (data: ContratoValleFloresData) => {
  if (!data.corrida.length) return ''
  const encabezados = ['No.', 'Fecha', 'Concepto', 'Importe', 'Saldo']
  const filas = data.corrida.map((pago) => {
    const fecha = parseFecha(pago.fecha)
    const concepto = pago.nopago === 0 ? 'Enganche' : `Parcialidad ${pago.nopago}`
    return `<tr>${[String(pago.nopago), fecha ? fecha.toLocaleDateString('es-MX') : '', concepto, monto(pago.mensualidad), monto(pago.saldo)]
      .map((valor) => `<td style="${celda}">${valor}</td>`).join('')}</tr>`
  })
  return [
    saltoDePagina('ANEXO B — CALENDARIO DE PAGOS'),
    parrafo(`Contrato número ${escapeHtml(String(data.ventaid))} · Titular: ${texto(data.cliente.nombre)}`, 'center'),
    tabla(
      `<tr>${encabezados.map((titulo) => `<td style="${celda}; background:${COLOR_ENCABEZADO}; color:#FFFFFF; font-weight:bold">${titulo}</td>`).join('')}</tr>` +
      filas.join('')
    ),
  ].join('\n')
}

/** Full Valle de Flores contract: Carátula, clausulado V7 and, for payment plans, Anexo B. */
export const buildContratoValleFloresHtml = (data: ContratoValleFloresData): string =>
  `<div style="${FUENTE}">\n${buildCaratula(data)}\n${buildClausulado(data)}\n${buildAnexoB(data)}\n</div>`
