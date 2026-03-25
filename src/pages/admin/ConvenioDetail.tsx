import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConvenioForm } from '@/components/forms/ConvenioForm'
import type { ConvenioFormData } from '@/components/forms/ConvenioForm'
import { ChevronLeft, Edit2 } from 'lucide-react'
import type { Convenio, Venta, Cliente, Lote } from '@/types/database'
import { formatDate, formatCurrency, getConvenioStatusLabel, getConvenioStatusColor } from '@/utils/helpers'

interface ConvenioWithDetails extends Convenio {
  venta?: Venta & { cliente?: Cliente; lote?: Lote }
}

export const ConvenioDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [convenio, setConvenio] = useState<ConvenioWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchConvenioDetail = async () => {
    if (!id) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('convenios')
        .select('*, venta:venta(ventaid, estatus, cliente:cliente(*), lote:lote(*))')
        .eq('convenioid', id)
        .single()
      if (error) throw error
      setConvenio(data as ConvenioWithDetails)
    } catch (err) {
      console.error('Error fetching convenio:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConvenioDetail() }, [id])

  const handleUpdate = async (data: ConvenioFormData) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('convenios')
        .update({
          fecha: data.fecha,
          motivo: data.motivo,
          descripcion: data.descripcion,
          meses_atraso: data.meses_atraso,
          recargo_original: data.recargo_original,
          recargo_acordado: data.recargo_acordado,
          estatus: data.estatus,
          comentarios: data.comentarios,
        })
        .eq('convenioid', id)
      if (error) throw error
      setShowEditModal(false)
      fetchConvenioDetail()
    } catch (err: any) {
      alert(`Error al actualizar convenio: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full" />
            </div>
            <p className="mt-4 text-[#9e9f92]">Cargando convenio...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!convenio) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró el convenio
        </div>
      </AdminLayout>
    )
  }

  const cliente = convenio.venta?.cliente
  const lote = convenio.venta?.lote

  return (
    <AdminLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              const from = (location.state as any)?.from
              navigate(from || '/admin/convenios')
            }}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2"
          >
            <Edit2 size={16} />
            Editar
          </Button>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8 border-t-4 border-[#504840]">
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Convenio #{convenio.convenioid}
            </h1>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getConvenioStatusColor(convenio.estatus)}`}>
              {getConvenioStatusLabel(convenio.estatus)}
            </span>
          </div>

          {/* Row 1: Fecha + Meses atraso + Motivo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">Fecha del Convenio</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(convenio.fecha)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pagos en Atraso al Registrar</p>
              <p className={`text-lg font-semibold ${(convenio.meses_atraso ?? 0) > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {convenio.meses_atraso ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Motivo</p>
              <p className="text-base font-semibold text-gray-900">{convenio.motivo ?? '—'}</p>
            </div>
          </div>

          {/* Row 2: Recargos */}
          {((convenio.recargo_original ?? 0) > 0 || (convenio.recargo_acordado ?? 0) >= 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pt-4 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500">Recargo Total Calculado</p>
                <p className="text-lg font-semibold text-amber-600">{formatCurrency(convenio.recargo_original)}</p>
                <p className="text-xs text-gray-400">Al momento del convenio</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Recargo Acordado</p>
                <p className={`text-lg font-semibold ${
                  (convenio.recargo_acordado ?? 0) === 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {(convenio.recargo_acordado ?? 0) === 0 ? 'Condonado ($0.00)' : formatCurrency(convenio.recargo_acordado)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Descuento / Condonado</p>
                <p className={`text-lg font-semibold ${
                  (convenio.recargo_original ?? 0) - (convenio.recargo_acordado ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {formatCurrency(Math.max(0, (convenio.recargo_original ?? 0) - (convenio.recargo_acordado ?? 0)))}
                </p>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Términos Acordados</p>
            <p className="text-base text-gray-800 whitespace-pre-wrap bg-gray-50 rounded p-4 border border-gray-100">
              {convenio.descripcion ?? '—'}
            </p>
          </div>

          {/* Comentarios */}
          {convenio.comentarios && (
            <div className="mb-6 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Comentarios</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{convenio.comentarios}</p>
            </div>
          )}

          {/* Venta info */}
          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Información de la Venta</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Venta</p>
                <Button
                  variant="ghost"
                  className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(`/admin/ventas/${convenio.ventaid}`)}
                >
                  #{convenio.ventaid}
                </Button>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cliente</p>
                <Button
                  variant="ghost"
                  className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(`/admin/clientes/${cliente?.clienteid}`)}
                >
                  {cliente?.nombre ?? '—'}
                </Button>
              </div>
              <div>
                <p className="text-sm text-gray-500">Lote</p>
                <p className="text-lg font-semibold text-gray-900">
                  {lote ? `Mza ${lote.manzana ?? '-'} / ${lote.nolote ?? '-'}` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Editar */}
      <Modal
        isOpen={showEditModal}
        title="Editar Convenio"
        onClose={() => !isSubmitting && setShowEditModal(false)}
        size="xl"
      >
        <ConvenioForm
          convenio={convenio}
          initialVentaId={convenio.ventaid ?? undefined}
          onSubmit={handleUpdate}
          isLoading={isSubmitting}
        />
      </Modal>
    </AdminLayout>
  )
}
