// Tipos para el módulo de Contratos
export type ContratoTemplate = {
  contrato_template_id: number
  nombre: string
  descripcion: string | null
  desarrolloid: number | null
  contenido_html: string
  variables_json: Record<string, boolean>
  version: number
  es_activa: boolean
  tipo_contrato: 'venta' | 'enganche' | 'convenio' | 'otro'
  notas: string | null
  created_at: string
  updated_at: string
}

export type ContratoGenerado = {
  contrato_generado_id: number
  contrato_template_id: number
  ventaid: number
  clienteid: number | null
  contenido_html: string
  contenido_pdf: string | null
  fecha_generacion: string
  fecha_firma: string | null
  estado: 'draft' | 'generado' | 'firmado' | 'cancelado'
  generado_por: string | null
  notas: string | null
}

export type VariableDisponible = {
  variable_id: number
  nombre_variable: string
  descripcion: string | null
  tipo_dato: string
  tabla_origen: string | null
  columna_origen: string | null
  ejemplo: string | null
  categoria: string | null
}

export interface ContratoTemplateFormData {
  nombre: string
  descripcion: string
  desarrolloid: number | null
  contenido_html: string
  variables_json: Record<string, boolean>
  tipo_contrato: 'venta' | 'enganche' | 'convenio' | 'otro'
  notas: string
}
