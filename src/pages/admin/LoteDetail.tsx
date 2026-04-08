import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoteForm } from '@/components/forms/LoteForm'
import { VentaForm } from '@/components/forms/VentaForm'
import type { VentaFormData } from '@/components/forms/VentaForm'
import { ChevronLeft, Plus } from 'lucide-react'
import type { Lote, Desarrollo, Venta, Cliente } from '@/types/database'
import { getLoteStatusLabel, getLoteStatusColor, formatCurrency, formatDate } from '@/utils/helpers'

interface VentaWithCliente extends Venta {
  cliente?: Cliente
}

export const LoteDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const [lote, setLote] = useState<Lote & { desarrollo?: Desarrollo }  | null>(null)
  const [ventas, setVentas] = useState<VentaWithCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVentaModal, setShowVentaModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchLoteDetail = async () => {
      if (!id) return
      try {
        setLoading(true)

        // Fetch lote with desarrollo and duenio
        const { data: loteData, error: loteError } = await supabase
          .from('lote')
          .select('*, desarrollo(*), duenio(*)')
          .eq('loteid', id)
          .single()

        if (loteError) throw loteError
        setLote(loteData as any)

        // Fetch associated ventas with cliente
        const { data: ventasData, error: ventasError } = await supabase
          .from('venta')
          .select('*, cliente:cliente(*)')
          .eq('loteid', id)
          .order('fecha', { ascending: false })

        if (ventasError) throw ventasError
        setVentas((ventasData || []) as any)
      } catch (error) {
        console.error('Error fetching lote detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLoteDetail()
  }, [id])

  const handleUpdateLote = async (formData: any) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('lote')
        .update(formData)
        .eq('loteid', id)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowEditModal(false)

      // Refetch data
      const { data: loteData } = await supabase
        .from('lote')
        .select('*, desarrollo(*), duenio(*)')
        .eq('loteid', id)
        .single()

      setLote((loteData as any) || null)
    } catch (err) {
      console.error('Error updating lote:', err)
      alert('Error al actualizar el lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLote = async () => {
    try {
      setIsSubmitting(true)
      
      // Check if there are any ventas
      const { data: ventasCount } = await supabase
        .from('venta')
        .select('ventaid', { count: 'exact' })
        .eq('loteid', id)

      if (ventasCount && ventasCount.length > 0) {
        alert('No se puede eliminar un lote que tiene ventas asociadas')
        setShowDeleteModal(false)
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase
        .from('lote')
        .delete()
        .eq('loteid', id)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowDeleteModal(false)
      navigate('/admin/lotes')
    } catch (err) {
      console.error('Error deleting lote:', err)
      alert('Error al eliminar el lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateCorridaFinanciera = (
    ventaid: number,
    data: Pick<VentaFormData, 'preciolote' | 'enganche' | 'plazo' | 'fechaenganche' | 'fechaprimeramensualidad' | 'mensualidad'>
  ) => {
    const saldoInicial = data.preciolote - data.enganche
    const records: { ventaid: number; nopago: number; fecha: string; mensualidad: number; saldo: number }[] = []
    records.push({ ventaid, nopago: 0, fecha: data.fechaenganche, mensualidad: data.enganche, saldo: saldoInicial })
    const fechaPrimera = new Date(data.fechaprimeramensualidad + 'T12:00:00')
    for (let i = 1; i <= data.plazo; i++) {
      const fechaPago = new Date(fechaPrimera)
      fechaPago.setMonth(fechaPago.getMonth() + (i - 1))
      const saldoRestante = i === data.plazo ? 0 : parseFloat((saldoInicial - data.mensualidad * i).toFixed(2))
      records.push({ ventaid, nopago: i, fecha: fechaPago.toISOString().split('T')[0], mensualidad: data.mensualidad, saldo: Math.max(0, saldoRestante) })
    }
    return records
  }

  const handleCreateVenta = async (data: VentaFormData) => {
    try {
      setIsSubmitting(true)
      const { data: loteCheck } = await supabase.from('lote').select('loteid, estatus').eq('loteid', data.loteid).single()
      if (!loteCheck || loteCheck.estatus !== 'D') {
        alert('El lote ya no está disponible.')
        return
      }
      const { data: authData } = await supabase.auth.getUser()
      const usuarioid = authData.user?.id ?? null
      const { data: ventaData, error: ventaError } = await supabase
        .from('venta')
        .insert([{
          loteid: data.loteid, clienteid: data.clienteid, fecha: data.fecha,
          fechacontrato: data.fechacontrato, usuarioid, preciolote: data.preciolote,
          enganche: data.enganche, porcenganche: data.porcenganche,
          fechaenganche: data.fechaenganche, plazo: data.plazo,
          fechaprimeramensualidad: data.fechaprimeramensualidad,
          mensualidad: data.mensualidad, estatus: 'A',
          comentarios: data.comentarios ?? null, plazoenganche: data.plazoenganche ?? 1,
        }])
        .select().single()
      if (ventaError) throw new Error(ventaError.message)
      const ventaid: number = ventaData.ventaid
      const { error: loteUpdateError } = await supabase.from('lote').update({ estatus: 'V' }).eq('loteid', data.loteid)
      if (loteUpdateError) {
        await supabase.from('venta').delete().eq('ventaid', ventaid)
        throw new Error(loteUpdateError.message)
      }
      const corridaRecords = generateCorridaFinanciera(ventaid, data)
      const { error: corridaError } = await supabase.from('corridafinanciera').insert(corridaRecords)
      if (corridaError) {
        await supabase.from('venta').delete().eq('ventaid', ventaid)
        await supabase.from('lote').update({ estatus: 'D' }).eq('loteid', data.loteid)
        throw new Error(corridaError.message)
      }
      setShowVentaModal(false)
      navigate(`/admin/ventas/${ventaid}`, { state: { from: `/admin/lotes/${id}` } })
    } catch (err: any) {
      console.error('Error creating venta:', err)
      alert(`Error al registrar la venta: ${err.message}`)
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
              <div className="h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-4 text-[#9e9f92]">Cargando detalles...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!lote) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró el lote
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              const from = (location.state as any)?.from || searchParams.get('from')
              navigate(from || '/admin/lotes')
            }}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>
          <div className="flex gap-4">
            <Button
              onClick={() => setShowEditModal(true)}
              className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6"
            >
              Editar
            </Button>
            <Button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6"
            >
              Eliminar
            </Button>
          </div>
        </div>

        {/* Lote Details */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-3xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Lote {lote.nolote} - Manzana {lote.manzana}
          </h1>

          {/* Section 1: Identifiers & Status */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Información General</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">ID del Lote</p>
                <p className="text-sm font-bold text-gray-900">{lote.loteid}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Desarrollo</p>
                <p className="text-sm font-bold text-gray-900">{lote.desarrollo?.nombre || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Tipo de Lote</p>
                <p className="text-sm font-bold text-gray-900">{lote.tipolote || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado</p>
                <span className={`text-xs font-bold inline-block px-2 py-1 rounded-full ${getLoteStatusColor(lote.estatus)}`}>
                  {getLoteStatusLabel(lote.estatus)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Ubicación</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Clave</p>
                <p className="text-sm font-bold text-gray-900">{lote.clavedesarrollo || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Coto</p>
                <p className="text-sm font-bold text-gray-900">{lote.coto || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Manzana</p>
                <p className="text-sm font-bold text-gray-900">{lote.manzana || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">No. Lote</p>
                <p className="text-sm font-bold text-gray-900">{lote.nolote || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Clave Lote</p>
                <p className="text-sm font-bold text-gray-900">{lote.clavelote || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Linderos */}
          <div className="bg-amber-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Medidas - Linderos (m)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Norte</p>
                <p className="text-sm font-bold text-gray-900">{lote.linderonte ? lote.linderonte.toFixed(2) : '0.00'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Sur</p>
                <p className="text-sm font-bold text-gray-900">{lote.linderosur ? lote.linderosur.toFixed(2) : '0.00'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Este</p>
                <p className="text-sm font-bold text-gray-900">{lote.linderoote ? lote.linderoote.toFixed(2) : '0.00'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Oeste</p>
                <p className="text-sm font-bold text-gray-900">{lote.linderopte ? lote.linderopte.toFixed(2) : '0.00'}</p>
              </div>
            </div>
          </div>

          {/* Section 4: Colindancias */}
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Colindancias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Norte</p>
                <p className="text-sm font-bold text-gray-900">{lote.colindanciante || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Sur</p>
                <p className="text-sm font-bold text-gray-900">{lote.colindanciasur || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Este</p>
                <p className="text-sm font-bold text-gray-900">{lote.colindanciaote || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Oeste</p>
                <p className="text-sm font-bold text-gray-900">{lote.colindanciapte || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 5: Valores */}
          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Valores del Lote</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Superficie</p>
                <p className="text-sm font-bold text-gray-900">{lote.superficie ? lote.superficie.toFixed(2) : '0.00'} m²</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Precio/m²</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(lote.preciopormt2)}</p>
              </div>
              <div className="bg-green-100 rounded p-2">
                <p className="text-xs text-gray-600">Precio Total</p>
                <p className="text-sm font-bold text-green-700">{formatCurrency(lote.preciolote)}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Dueño</p>
                <p className="text-sm font-bold text-gray-900">{lote.duenio?.nombre || 'Sin asignar'}</p>
              </div>
            </div>
          </div>

          {/* Section 6: Comentarios */}
          {lote.comentarios && (
            <div className="bg-indigo-50 rounded-lg p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Comentarios</h2>
              <p className="text-sm text-gray-700">{lote.comentarios}</p>
            </div>
          )}
        </div>

        {/* Ventas associated */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 flex items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Ventas Asociadas</h2>
            {ventas.length === 0 && lote.estatus === 'D' && (
              <Button
                onClick={() => setShowVentaModal(true)}
                className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Nueva Venta
              </Button>
            )}
          </div>

          {ventas.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay ventas asociadas a este lote
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Venta ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Precio</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Enganche</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Plazo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventas.map((venta) => (
                    <tr key={venta.ventaid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          {venta.ventaid}
                          {venta.estatus === 'C' && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Cancelada</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{venta.cliente?.nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(venta.fecha)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(venta.preciolote)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(venta.enganche)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{venta.plazo} meses</td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/ventas/${venta.ventaid}`)}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Lote">
        <LoteForm lote={lote} onSubmit={handleUpdateLote} isLoading={isSubmitting} />
      </Modal>

      {/* Nueva Venta Modal */}
      <Modal isOpen={showVentaModal} onClose={() => setShowVentaModal(false)} title={`Nueva Venta — Lote ${lote.nolote} Mza ${lote.manzana}`} size="xl">
        <VentaForm
          defaultLoteId={lote.loteid}
          onSubmit={handleCreateVenta}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Lote">
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar este lote? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-4 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteLote}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6"
            >
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
