import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import type { ContratoTemplateFormData } from '@/types/contrato.types'

interface ContratoTemplateFormProps {
  initialData?: Partial<ContratoTemplateFormData>
  onSubmit: (data: ContratoTemplateFormData) => Promise<void>
  isSubmitting?: boolean
}

export const ContratoTemplateForm = ({
  initialData,
  onSubmit,
  isSubmitting = false
}: ContratoTemplateFormProps) => {
  const [desarrollos, setDesarrollos] = useState<any[]>([])
  const [variables, setVariables] = useState<string[]>([])
  const [formData, setFormData] = useState<ContratoTemplateFormData>({
    nombre: initialData?.nombre || '',
    descripcion: initialData?.descripcion || '',
    tipo_contrato: initialData?.tipo_contrato || 'venta',
    desarrolloid: initialData?.desarrolloid || null,
    contenido_html: initialData?.contenido_html || '',
    notas: initialData?.notas || '',
    variables_json: initialData?.variables_json || {}
  })

  // Cargar desarrollos
  useEffect(() => {
    const loadDesarrollos = async () => {
      try {
        const { data, error } = await supabase
          .from('desarrollo')
          .select('desarrolloid, nombre')
          .order('nombre')

        if (error) throw error

        let list = data || []
        if (DEMO_DESARROLLOIDS.length > 0) {
          list = list.filter(d => DEMO_DESARROLLOIDS.includes(d.desarrolloid))
        }

        setDesarrollos(list)
      } catch (err) {
        console.error('Error loading desarrollos:', err)
      }
    }

    loadDesarrollos()
  }, [])

  // Extraer variables del HTML {{variable}}
  const extractVariables = (html: string) => {
    const regex = /\{\{(\w+)\}\}/g
    const matches = Array.from(html.matchAll(regex)).map(m => m[1])
    const unique = Array.from(new Set(matches))
    setVariables(unique)
    
    // Crear objeto Record<string, boolean>
    const variablesObj: Record<string, boolean> = {}
    unique.forEach(v => {
      variablesObj[v] = true
    })
    setFormData(prev => ({ ...prev, variables_json: variablesObj }))
  }

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const html = e.target.value
    setFormData(prev => ({ ...prev, contenido_html: html }))
    extractVariables(html)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    if (formData.desarrolloid === null || formData.desarrolloid === 0) {
      alert('Selecciona un desarrollo')
      return
    }

    if (!formData.contenido_html.trim()) {
      alert('El contenido HTML es requerido')
      return
    }

    try {
      await onSubmit(formData)
    } catch (err) {
      console.error('Error al enviar formulario:', err)
    }
  }

  // Variables disponibles para insertar
  const availableVariables = [
    'cliente_nombre',
    'cliente_email',
    'cliente_telefono',
    'venta_id',
    'venta_precio',
    'venta_fecha',
    'lote_clavelote',
    'lote_manzana',
    'lote_nolote',
    'desarrollo_nombre',
    'convenio_monto_mensual',
    'convenio_meses',
    'convenio_monto_total',
    'convenio_fecha_inicio',
    'convenio_fecha_fin',
    'fecha_hoy',
    'fecha_firma'
  ]
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del Template
        </label>
        <Input
          value={formData.nombre}
          onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
          placeholder="ej: Contrato de Venta Estándar"
          required
        />
      </div>

      {/* Tipo de contrato */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Contrato
          </label>
          <select
            value={formData.tipo_contrato}
            onChange={(e) => setFormData(prev => ({ ...prev, tipo_contrato: e.target.value as 'venta' | 'enganche' | 'convenio' | 'otro' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="venta">Venta</option>
            <option value="enganche">Enganche</option>
            <option value="convenio">Convenio</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {/* Desarrollo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Desarrollo
          </label>
          <select
            value={formData.desarrolloid || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, desarrolloid: parseInt(e.target.value) || null }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona un desarrollo</option>
            {desarrollos.map(dev => (
              <option key={dev.desarrolloid} value={dev.desarrolloid}>
                {dev.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          value={formData.descripcion}
          onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
          placeholder="Breve descripción del template..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
        />
      </div>

      {/* Editor HTML */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contenido HTML
        </label>
        <div className="space-y-2">
          {/* Quick insert buttons */}
          <div className="bg-gray-50 p-3 rounded border">
            <p className="text-xs font-medium text-gray-600 mb-2">Variables disponibles:</p>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map(varName => (
                <button
                  key={varName}
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById('htmlContent') as HTMLTextAreaElement
                    const cursorPos = textarea.selectionStart
                    const textBefore = formData.contenido_html.substring(0, cursorPos)
                    const textAfter = formData.contenido_html.substring(cursorPos)
                    const newHtml = `${textBefore}{{${varName}}}${textAfter}`
                    setFormData(prev => ({ ...prev, contenido_html: newHtml }))
                    extractVariables(newHtml)
                    setTimeout(() => textarea.focus(), 0)
                  }}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                >
                  {'{{' + varName + '}}'}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Editor */}
          <textarea
            id="htmlContent"
            value={formData.contenido_html}
            onChange={handleHtmlChange}
            placeholder={`<h1>Contrato de {{tipo_contrato}}</h1>
<p>Vendedor: {{cliente_nombre}}</p>
<p>Propiedad: {{lote_clavelote}} en {{desarrollo_nombre}}</p>
<p>Precio: ${{venta_precio}}</p>

Inserta las variables usando {{nombreVariable}}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            rows={12}
            required
          />

          {/* Variables found */}
          {variables.length > 0 && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-xs font-medium text-blue-900">
                Variables encontradas ({variables.length}):
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {variables.map(varName => (
                  <span
                    key={varName}
                    className="px-2 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded"
                  >
                    {`{{${varName}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas Internas
        </label>
        <textarea
          value={formData.notas}
          onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
          placeholder="Notas sobre este template..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="secondary" type="button" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar Template'}
        </Button>
      </div>
    </form>
  )
}
