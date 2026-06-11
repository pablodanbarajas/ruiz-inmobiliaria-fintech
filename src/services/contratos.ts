// Servicio de contratos - conecta con Supabase
import { supabase } from '@/lib/supabaseClient'
import type {
  ContratoTemplate,
  ContratoGenerado,
  VariableDisponible,
  ContratoTemplateFormData
} from '@/types/contrato.types'

export const contratoService = {
  // ========== TEMPLATES ==========
  
  async obtenerTemplates(): Promise<ContratoTemplate[]> {
    const { data, error } = await supabase
      .from('contrato_template')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return (data || []) as ContratoTemplate[]
  },

  async obtenerTemplate(id: number): Promise<ContratoTemplate> {
    const { data, error } = await supabase
      .from('contrato_template')
      .select('*')
      .eq('contrato_template_id', id)
      .single()
    
    if (error) throw error
    return data as ContratoTemplate
  },

  async crearTemplate(formData: ContratoTemplateFormData): Promise<ContratoTemplate> {
    const { data, error } = await supabase
      .from('contrato_template')
      .insert({
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        desarrolloid: formData.desarrolloid,
        contenido_html: formData.contenido_html,
        variables_json: formData.variables_json,
        tipo_contrato: formData.tipo_contrato,
        notas: formData.notas,
        es_activa: true
      })
      .select()
      .single()
    
    if (error) throw error
    return data as ContratoTemplate
  },

  async actualizarTemplate(
    id: number,
    formData: Partial<ContratoTemplateFormData>
  ): Promise<ContratoTemplate> {
    const { data, error } = await supabase
      .from('contrato_template')
      .update({
        ...formData,
        updated_at: new Date().toISOString()
      })
      .eq('contrato_template_id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as ContratoTemplate
  },

  async eliminarTemplate(id: number): Promise<void> {
    const { error } = await supabase
      .from('contrato_template')
      .delete()
      .eq('contrato_template_id', id)
    
    if (error) throw error
  },

  // ========== CONTRATOS GENERADOS ==========
  
  async generarContrato(templateId: number, ventaId: number): Promise<ContratoGenerado> {
    // Llamar a función SQL que genera el HTML
    const { data, error } = await supabase.rpc('generar_contrato_html', {
      p_contrato_template_id: templateId,
      p_ventaid: ventaId
    })
    
    if (error) throw error
    
    const contenidoHtml = data as string
    
    // Guardar en tabla contrato_generado
    const { data: contrato, error: insertError } = await supabase
      .from('contrato_generado')
      .insert({
        contrato_template_id: templateId,
        ventaid: ventaId,
        contenido_html: contenidoHtml,
        estado: 'generado'
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    return contrato as ContratoGenerado
  },

  async obtenerContratosVenta(ventaId: number): Promise<ContratoGenerado[]> {
    const { data, error } = await supabase
      .from('contrato_generado')
      .select('*')
      .eq('ventaid', ventaId)
      .order('fecha_generacion', { ascending: false })
    
    if (error) throw error
    return (data || []) as ContratoGenerado[]
  },

  async obtenerContrato(id: number): Promise<ContratoGenerado> {
    const { data, error } = await supabase
      .from('contrato_generado')
      .select('*')
      .eq('contrato_generado_id', id)
      .single()
    
    if (error) throw error
    return data as ContratoGenerado
  },

  async marcarFirmado(id: number, fechaFirma: string): Promise<ContratoGenerado> {
    const { data, error } = await supabase
      .from('contrato_generado')
      .update({
        estado: 'firmado',
        fecha_firma: fechaFirma,
        updated_at: new Date().toISOString()
      })
      .eq('contrato_generado_id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as ContratoGenerado
  },

  // ========== VARIABLES DISPONIBLES ==========
  
  async obtenerVariablesDisponibles(): Promise<VariableDisponible[]> {
    const { data, error } = await supabase
      .from('variables_disponibles')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre_variable', { ascending: true })
    
    if (error) throw error
    return (data || []) as VariableDisponible[]
  },

  async obtenerVariablesPorCategoria(categoria: string): Promise<VariableDisponible[]> {
    const { data, error } = await supabase
      .from('variables_disponibles')
      .select('*')
      .eq('categoria', categoria)
      .order('nombre_variable', { ascending: true })
    
    if (error) throw error
    return (data || []) as VariableDisponible[]
  },

  // ========== UTILIDADES ==========
  
  /**
   * Extrae las variables {{}} de un texto HTML
   */
  extraerVariables(html: string): Set<string> {
    const regex = /\{\{([a-z_]+)\}\}/gi
    const matches = html.matchAll(regex)
    const variables = new Set<string>()
    
    for (const match of matches) {
      variables.add(`{{${match[1].toLowerCase()}}}`)
    }
    
    return variables
  },

  /**
   * Valida que el HTML tenga las variables esperadas
   */
  validarVariables(html: string, expectedVars: string[]): { valid: boolean; missing: string[] } {
    const foundVars = this.extraerVariables(html)
    const missing = expectedVars.filter(v => !foundVars.has(v.toLowerCase()))
    
    return {
      valid: missing.length === 0,
      missing
    }
  }
}
