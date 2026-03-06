import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { ChevronLeft } from 'lucide-react'
import type { Pago, CorridaFinanciera, Venta, Cliente, Lote } from '@/types/database'
import { formatDate, formatCurrency, getPagoStatusLabel, getPagoStatusColor } from '@/utils/helpers'

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

  useEffect(() => {
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
      } catch (error) {
        console.error('Error fetching pago detail:', error)
      } finally {
        setLoading(false)
      }
    }

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

  return (
    <AdminLayout>
      <div className="w-full">
        <Button
          variant="ghost"
          onClick={() => {
            const from = (location.state as any)?.from
            navigate(from || '/admin/pagos')
          }}
          className="mb-6 inline-flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>

        {/* Pago Details */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-4xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Pago #{pago.pagoid}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Monto Pagado</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(pago.montopagado)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Fecha de Pago</p>
                <p className="text-xl font-semibold text-gray-900">{formatDate(pago.fechapago)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Forma de Pago</p>
                <p className="text-lg font-semibold text-gray-900">
                  {pago.formapago === 1 ? 'Efectivo' : 'Transferencia'}
                </p>
              </div>
            </div>
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Estado</p>
                <p className={`text-lg font-semibold inline-block px-3 py-1 rounded-full text-sm ${getPagoStatusColor(pago.estatus)}`}>
                  {getPagoStatusLabel(pago.estatus)}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Corrida Financiera ID</p>
                <p className="text-lg font-semibold text-gray-900">
                  {pago.corridafinancieraid}
                </p>
              </div>
            </div>
          </div>

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
  )
}
