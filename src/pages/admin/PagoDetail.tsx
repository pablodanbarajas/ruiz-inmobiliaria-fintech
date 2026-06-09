import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PagoForm } from '@/components/forms/PagoForm'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { ChevronLeft, Edit2, XCircle, AlertTriangle } from 'lucide-react'
import type { Pago, CorridaFinanciera, Venta, Cliente, Lote, CuentaBancaria } from '@/types/database'
import { formatDate, formatCurrency, getPagoStatusLabel, getPagoStatusColor, getPagoFormaLabel } from '@/utils/helpers'

interface PagoWithDetails extends Pago {
  corridafinanciera?: CorridaFinanciera & {
    venta?: Venta & {
      cliente?: Cliente
      lote?: Lote
    }
  }
}

export const PagoDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [pago, setPago] = useState<PagoWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cuentaBancaria, setCuentaBancaria] = useState<CuentaBancaria | null>(null)

  const fetchPagoDetail = async () => {
    if (!id) return
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('pagos')
        .select('*, corridafinanciera:corridafinanciera(*, venta:venta(*, cliente:cliente(*), lote:lote(*)))')
        .eq('pagoid', id)
        .single()

      if (error) throw error
      setPago(data as PagoWithDetails)

      const accountId = (data as PagoWithDetails)?.cuenta_bancaria_id
      if (accountId) {
        const { data: cuentaData } = await supabase
          .from('cuentas_bancarias')
          .select('cuenta_bancaria_id, nombre, banco, numero_cuenta, clabe, desarrolloid, activa')
          .eq('cuenta_bancaria_id', accountId)
          .maybeSingle()

        setCuentaBancaria((cuentaData as CuentaBancaria) ?? null)
      } else {
        setCuentaBancaria(null)
      }
    } catch (error) {
      console.error('Error fetching pago detail:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPagoDetail()
  }, [id])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-4 text-[#9e9f92]">Cargando detalles...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!pago) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró el pago
        </div>
      </AdminLayout>
    )
  }

  const venta = pago.corridafinanciera?.venta
  const cliente = venta?.cliente
  const lote = venta?.lote

  // ── Edit handler ────────────────────────────────────
  const handleUpdatePago = async (data: PagoFormData) => {
    try {
      setIsSubmitting(true)
      const payload = {
        fechapago: data.fechapago,
        montopagado: data.montopagado,
        servicios_extra: data.servicios_extra,
        formapago: data.formapago,
        cuenta_bancaria_id: data.cuenta_bancaria_id,
        estatus: data.estatus,
        referencia: data.referencia,
        comentario: data.comentario,
        recargo: data.recargo,
        cobrador: data.cobrador,
      }

      let updateResult = await supabase
        .from('pagos')
        .update(payload)
        .eq('pagoid', id)

      if (updateResult.error && /servicios_extra|cuenta_bancaria_id/i.test(updateResult.error.message || '')) {
        const fallbackComentario = [
          data.comentario,
          data.servicios_extra > 0 ? `[Servicios/Extra: ${data.servicios_extra}]` : null,
          data.formapago === 2 && data.cuenta_bancaria_id ? `[Cuenta bancaria ID: ${data.cuenta_bancaria_id}]` : null,
        ].filter(Boolean).join(' | ')

        updateResult = await supabase
          .from('pagos')
          .update({
            fechapago: data.fechapago,
            montopagado: data.montopagado,
            formapago: data.formapago,
            estatus: data.estatus,
            referencia: data.referencia,
            comentario: fallbackComentario || null,
            recargo: data.recargo,
            cobrador: data.cobrador,
          })
          .eq('pagoid', id)
      }

      if (updateResult.error) throw updateResult.error

      setShowEditModal(false)
      await fetchPagoDetail()
    } catch (err: any) {
      console.error('Error updating pago:', err)
      alert(`Error al actualizar el pago: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Cancel handler ───────────────────────────────────
  const handleCancelPago = async () => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('pagos')
        .update({ estatus: 'C' })
        .eq('pagoid', id)

      if (error) throw error

      setShowCancelModal(false)
      await fetchPagoDetail()
    } catch (err: any) {
      console.error('Error cancelling pago:', err)
      alert(`Error al cancelar el pago: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              const from = (location.state as any)?.from
              navigate(from || '/admin/pagos')
            }}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>

          {/* Action buttons (only when not cancelled) */}
          {pago.estatus !== 'C' && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2"
              >
                <Edit2 size={16} />
                Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-2"
              >
                <XCircle size={16} />
                Cancelar Pago
              </Button>
            </div>
          )}
        </div>

        {/* Pago Details */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-8 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Pago #{pago.pagoid}</h1>

          {/* Row 1: Monto + Recargo + Fecha + Forma + Estado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">Monto Pagado</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(pago.montopagado)}</p>
              {pago.recargo != null && pago.recargo > 0 && (
                <p className="text-sm text-orange-600 mt-1">+ {formatCurrency(pago.recargo)} recargo</p>
              )}
              {pago.servicios_extra != null && pago.servicios_extra > 0 && (
                <p className="text-sm text-indigo-600 mt-1">+ {formatCurrency(pago.servicios_extra)} servicios/extra</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Pago</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(pago.fechapago)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Forma de Pago</p>
              <p className="text-base font-semibold text-gray-900">{getPagoFormaLabel(pago.formapago)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPagoStatusColor(pago.estatus)}`}>
                {getPagoStatusLabel(pago.estatus)}
              </span>
            </div>
          </div>

          {/* Row 2: Referencia + Corrida ID + Cobrador */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Referencia / Folio</p>
              <p className="text-base font-semibold text-gray-900">{pago.referencia || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Corrida Financiera ID</p>
              <p className="text-base font-semibold text-gray-900">{pago.corridafinancieraid}</p>
            </div>
            {pago.cobrador && (
              <div>
                <p className="text-sm text-gray-500">Cobrador (ruta)</p>
                <p className="text-base font-semibold text-gray-900">{pago.cobrador}</p>
              </div>
            )}
            {pago.formapago === 2 && pago.cuenta_bancaria_id != null && (
              <div>
                <p className="text-sm text-gray-500">Cuenta bancaria destino</p>
                <p className="text-base font-semibold text-gray-900">
                  {cuentaBancaria?.nombre ?? `ID #${pago.cuenta_bancaria_id}`}
                </p>
                {cuentaBancaria?.banco && (
                  <p className="text-xs text-gray-500">{cuentaBancaria.banco}{cuentaBancaria.numero_cuenta ? ` · ****${cuentaBancaria.numero_cuenta.slice(-4)}` : ''}</p>
                )}
              </div>
            )}
          </div>

          {/* Comentario */}
          {pago.comentario && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Comentario</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{pago.comentario}</p>
            </div>
          )}

          {/* Associated Venta Info */}
          {pago.corridafinanciera && (
            <>
              <div className="border-t pt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Información de la Venta</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Venta ID</p>
                      <Button
                        variant="ghost"
                        className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                        onClick={() => navigate(`/admin/ventas/${venta?.ventaid}`)}
                      >
                        {venta?.ventaid}
                      </Button>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Cliente</p>
                      <Button
                        variant="ghost"
                        className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                        onClick={() => navigate(`/admin/clientes/${cliente?.clienteid}`)}
                      >
                        {cliente?.nombre || '-'}
                      </Button>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Email Cliente</p>
                      <p className="text-lg font-semibold text-gray-900">{cliente?.email || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Lote</p>
                      <Button
                        variant="ghost"
                        className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                        onClick={() => navigate(`/admin/lotes/${lote?.loteid}`)}
                      >
                        {lote?.manzana} - {lote?.nolote}
                      </Button>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Precio del Lote</p>
                      <p className="text-lg font-semibold text-gray-900">{formatCurrency(venta?.preciolote)}</p>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">Fecha de Venta</p>
                      <p className="text-lg font-semibold text-gray-900">{formatDate(venta?.fecha)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Corrida Info */}
              <div className="border-t pt-8 mt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Información de la Corrida Financiera</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">No. de Pago</p>
                    <p className="text-3xl font-bold text-blue-600">{pago.corridafinanciera.nopago}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">Mensualidad</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(pago.corridafinanciera.mensualidad)}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">Saldo Pendiente</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCurrency(pago.corridafinanciera.saldo)}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-2">Fecha Esperada de Pago</p>
                  <p className="text-lg font-semibold text-gray-900">{formatDate(pago.corridafinanciera.fecha)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>

    {/* ── Modal: Editar Pago ────────────────────────────── */}
    <Modal
      isOpen={showEditModal}
      title={`Editar Pago #${pago?.pagoid}`}
      onClose={() => !isSubmitting && setShowEditModal(false)}
      size="xl"
    >
      <PagoForm pago={pago ?? undefined} onSubmit={handleUpdatePago} isLoading={isSubmitting} />
    </Modal>

    {/* ── Modal: Confirmar Cancelación ──────────────────── */}
    <Modal
      isOpen={showCancelModal}
      title="Cancelar Pago"
      onClose={() => !isSubmitting && setShowCancelModal(false)}
    >
      <div className="space-y-6">
        <div className="flex gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Confirmar cancelación</p>
            <p className="text-sm text-amber-700 mt-1">
              Se cambiará el estado del pago a <strong>Cancelado</strong>. Esta acción puede revertirse
              editando el pago.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setShowCancelModal(false)}
            disabled={isSubmitting}
          >
            No, volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancelPago}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cancelando...' : 'Sí, cancelar pago'}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  )
}
