import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/DataTable'
import { ContratoTemplateForm } from '@/components/forms/ContratoTemplateForm'
import { useToastContext } from '@/context/ToastContext'
import { contratoService } from '@/services/contratos'
import { Eye, Plus, Edit, Trash2, FileText, Download } from 'lucide-react'
import type { ContratoTemplate, ContratoGenerado } from '@/types/contrato.types'
import { formatDate } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

export const Contratos = () => {
  const { success, error: showError } = useToastContext()
  const [templates, setTemplates] = useState<ContratoTemplate[]>([])
  const [contratosgenerados, setContratosGenerados] = useState<ContratoGenerado[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'templates' | 'generados'>('templates')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ContratoTemplate | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [filterName, setFilterName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cargar templates
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const data = await contratoService.obtenerTemplates()
      
      // Filtrar por desarrollos en demo mode
      let filtered = data
      if (DEMO_DESARROLLOIDS.length > 0) {
        filtered = data.filter(t => DEMO_DESARROLLOIDS.includes(t.desarrolloid))
      }
      
      setTemplates(filtered)
    } catch (err) {
      showError('Error', `No se pudieron cargar los templates: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  // Cargar contratos generados
  const fetchContratosGenerados = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contrato_generado')
        .select(`
          *,
          template:contrato_template(nombre, tipo_contrato),
          venta:venta(ventaid, estatus, cliente:cliente(nombre), lote:lote(clavelote))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      let list = (data || []) as ContratoGenerado[]
      
      // Filtrar por demo mode
      if (DEMO_DESARROLLOIDS.length > 0) {
        list = list.filter(c => {
          const templateDevId = (c.template as any)?.desarrolloid
          return DEMO_DESARROLLOIDS.includes(templateDevId)
        })
      }

      setContratosGenerados(list)
    } catch (err) {
      showError('Error', `No se pudieron cargar los contratos: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates()
    } else {
      fetchContratosGenerados()
    }
  }, [activeTab])

  // Manejar creación de template
  const handleCreateTemplate = async (formData: any) => {
    try {
      setIsSubmitting(true)
      await contratoService.crearTemplate(formData)
      success('Éxito', 'Template creado correctamente')
      setShowCreateModal(false)
      fetchTemplates()
    } catch (err) {
      showError('Error', `No se pudo crear el template: ${(err as Error).message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Previsualizar contrato
  const handlePreview = async (template: ContratoTemplate) => {
    setSelectedTemplate(template)
    setPreviewContent(template.contenido_html || '<p>Sin contenido</p>')
    setShowPreviewModal(true)
  }

  // Descargar contrato
  const handleDownload = (contrato: ContratoGenerado) => {
    const html = contrato.contenido_html || ''
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `contrato-${contrato.contratoid}.html`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Marcar como firmado
  const handleMarkSigned = async (contractId: number) => {
    try {
      const { error } = await supabase
        .from('contrato_generado')
        .update({ estatus: 'firmado', fecha_firma: new Date().toISOString() })
        .eq('contratoid', contractId)

      if (error) throw error
      success('Éxito', 'Contrato marcado como firmado')
      fetchContratosGenerados()
    } catch (err) {
      showError('Error', `No se pudo marcar como firmado: ${(err as Error).message}`)
    }
  }

  // Filtrar templates por nombre
  const filteredTemplates = templates.filter(t =>
    t.nombre?.toLowerCase().includes(filterName.toLowerCase())
  )

  // Columnas para tabla de templates
  const templateColumns = [
    { key: 'nombre', label: 'Nombre', width: '25%' },
    { 
      key: 'tipo_contrato', 
      label: 'Tipo', 
      width: '15%',
      render: (value: string) => <span className="text-sm">{value || '-'}</span>
    },
    { 
      key: 'descripcion', 
      label: 'Descripción', 
      width: '30%',
      render: (value: string) => <span className="text-sm text-gray-600">{value?.substring(0, 50) || '-'}</span>
    },
    { 
      key: 'es_activa', 
      label: 'Estado', 
      width: '10%',
      render: (value: boolean) => (
        <span className={`text-xs px-2 py-1 rounded ${value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {value ? 'Activa' : 'Inactiva'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      label: 'Creado', 
      width: '10%',
      render: (value: string) => <span className="text-sm">{formatDate(value)}</span>
    }
  ]

  // Columnas para tabla de contratos generados
  const contratosColumns = [
    { key: 'contratoid', label: 'ID', width: '8%' },
    { 
      key: 'template', 
      label: 'Template', 
      width: '15%',
      render: (value: any) => <span>{value?.nombre || '-'}</span>
    },
    { 
      key: 'venta', 
      label: 'Cliente', 
      width: '20%',
      render: (value: any) => <span>{value?.cliente?.nombre || '-'}</span>
    },
    { 
      key: 'estatus', 
      label: 'Estado', 
      width: '12%',
      render: (value: string) => (
        <span className={`text-xs px-2 py-1 rounded ${
          value === 'firmado' ? 'bg-blue-100 text-blue-800' :
          value === 'cancelado' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value || 'generado'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      label: 'Generado', 
      width: '12%',
      render: (value: string) => <span className="text-sm">{formatDate(value)}</span>
    }
  ]

  return (
    <AdminLayout title="Contratos">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'templates'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="inline-block w-4 h-4 mr-2" />
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('generados')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'generados'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="inline-block w-4 h-4 mr-2" />
            Contratos Generados ({contratosgenerados.length})
          </button>
        </div>

        {/* Tab: Templates */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {/* Encabezado y filtros */}
            <div className="flex justify-between items-center gap-4">
              <Input
                placeholder="Buscar template..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="flex-1 max-w-xs"
              />
              <Button
                onClick={() => setShowCreateModal(true)}
                className="gap-2"
                variant="default"
              >
                <Plus className="w-4 h-4" />
                Nuevo Template
              </Button>
            </div>

            {/* Tabla de templates */}
            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : (
              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      {templateColumns.map(col => (
                        <th key={col.key} style={{ width: col.width }} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700" style={{ width: '10%' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map(template => (
                      <tr key={template.contrato_template_id} className="border-b hover:bg-gray-50">
                        {templateColumns.map(col => (
                          <td key={col.key} className="px-4 py-3 text-sm">
                            {col.render ? col.render((template as any)[col.key]) : (template as any)[col.key]}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePreview(template)}
                              className="p-1 hover:bg-blue-100 rounded text-blue-600"
                              title="Previsualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedTemplate(template)}
                              className="p-1 hover:bg-yellow-100 rounded text-yellow-600"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Contratos Generados */}
        {activeTab === 'generados' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : (
              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      {contratosColumns.map(col => (
                        <th key={col.key} style={{ width: col.width }} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700" style={{ width: '10%' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratosgenerados.map(contrato => (
                      <tr key={contrato.contratoid} className="border-b hover:bg-gray-50">
                        {contratosColumns.map(col => (
                          <td key={col.key} className="px-4 py-3 text-sm">
                            {col.render ? col.render((contrato as any)[col.key]) : (contrato as any)[col.key]}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedTemplate(null)
                                setPreviewContent(contrato.contenido_html || '')
                                setShowPreviewModal(true)
                              }}
                              className="p-1 hover:bg-blue-100 rounded text-blue-600"
                              title="Ver"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(contrato)}
                              className="p-1 hover:bg-green-100 rounded text-green-600"
                              title="Descargar"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {contrato.estatus !== 'firmado' && (
                              <button
                                onClick={() => handleMarkSigned(contrato.contratoid)}
                                className="p-1 hover:bg-purple-100 rounded text-purple-600"
                                title="Marcar como firmado"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal crear/editar template */}
      {showCreateModal && (
        <Modal title="Nuevo Template de Contrato" onClose={() => setShowCreateModal(false)}>
          <ContratoTemplateForm
            onSubmit={handleCreateTemplate}
            isSubmitting={isSubmitting}
          />
        </Modal>
      )}

      {/* Modal previsualizar */}
      {showPreviewModal && (
        <Modal title="Previsualización de Contrato" onClose={() => setShowPreviewModal(false)} size="lg">
          <div className="bg-white p-6 rounded border">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
              Cerrar
            </Button>
            {selectedTemplate && (
              <Button onClick={() => handleDownload({ contenido_html: previewContent } as ContratoGenerado)}>
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
            )}
          </div>
        </Modal>
      )}
    </AdminLayout>
  )
}
