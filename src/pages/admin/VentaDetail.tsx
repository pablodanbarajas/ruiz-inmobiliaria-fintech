import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { ChevronLeft } from 'lucide-react'
import type { Venta, Cliente, Lote, CorridaFinanciera, Pago, Desarrollo } from '@/types/database'
import { formatDate, formatCurrency, getStatusLabel, getPagoStatusLabel, getPagoStatusColor } from '@/utils/helpers'

interface VentaWithDetails extends Venta {
  cliente?: Cliente
  lote?: Lote & { desarrollo?: Desarrollo }
}

interface CorridaWithPagos extends CorridaFinanciera {
  pagos?: Pago[]
}

export const VentaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [venta, setVenta] = useState<VentaWithDetails | null>(null)
  const [corridas, setCorridas] = useState<CorridaWithPagos[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVentaDetail = async () => {
      if (!id) return
      try {
        setLoading(true)

        // Fetch venta with cliente and lote
        const { data: ventaData, error: ventaError } = await supabase
          .from('venta')
          .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
          .eq('ventaid', id)
          .single()

        if (ventaError) throw ventaError
        setVenta(ventaData as VentaWithDetails)

        // Fetch corrida financiera with pagos
        const { data: corridaData, error: corridaError } = await supabase
          .from('corridafinanciera')
          .select('*')
          .eq('ventaid', id)
          .order('nopago', { ascending: true })

        if (corridaError) throw corridaError

        // Fetch pagos for each corrida
        const corridasConPagos = await Promise.all(
          (corridaData || []).map(async (corrida) => {
            const { data: pagosData } = await supabase
              .from('pagos')
              .select('*')
              .eq('corridafinancieraid', corrida.corridafinancieraid)

            return {
              ...corrida,
              pagos: pagosData || [],
            }
          })
        )

        setCorridas(corridasConPagos)
      } catch (error) {
        console.error('Error fetching venta detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchVentaDetail()
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

  if (!venta) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró la venta
        </div>
      </AdminLayout>
    )
  }

  const totalPagado = corridas.reduce(
    (sum, c) => sum + (c.pagos?.reduce((ps, p) => ps + (p.montopagado || 0), 0) || 0),
    0
  )
  const saldoPendiente = (venta.preciolote || 0) - (venta.enganche || 0) - totalPagado

  return (
    <AdminLayout>
      <div className="w-full">
        <Button
          variant="ghost"
          onClick={() => {
            const from = (location.state as any)?.from
            navigate(from || '/admin/ventas')
          }}
          className="mb-6 inline-flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>

        {/* Venta Details */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-4xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Venta #{venta.ventaid}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Cliente</p>
                <Button
                  variant="ghost"
                  className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(`/admin/clientes/${venta.clienteid}`)}
                >
                  {venta.cliente?.nombre || '-'}
                </Button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Desarrollo</p>
                <p className="text-lg font-semibold text-gray-900">{venta.lote?.desarrollo?.nombre || '-'}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Lote</p>
                <Button
                  variant="ghost"
                  className="p-0 text-left text-lg font-semibold text-blue-600 hover:underline"
                  onClick={() => navigate(`/admin/lotes/${venta.loteid}`)}
                >
                  {venta.lote?.manzana} - {venta.lote?.nolote}
                </Button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Fecha de Venta</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(venta.fecha)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Plazo (meses)</p>
                <p className="text-lg font-semibold text-gray-900">{venta.plazo}</p>
              </div>
            </div>
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Precio del Lote</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(venta.preciolote)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Enganche</p>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(venta.enganche)}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Fecha Primera Mensualidad</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(venta.fechaprimeramensualidad)}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Estado</p>
                <p className={`text-lg font-semibold inline-block px-3 py-1 rounded-full text-sm ${
                  venta.estatus === 'A'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {getStatusLabel(venta.estatus)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Precio Total</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(venta.preciolote)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Total Pagado</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency((venta.enganche || 0) + totalPagado)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Saldo Pendiente</p>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(saldoPendiente)}</p>
          </div>
        </div>

        {/* Corrida Financiera */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Corrida Financiera</h2>
          </div>

          {corridas.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay corrida financiera registrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">No. Pago</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha Esperada</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mensualidad</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Saldo Pendiente</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pagos Realizados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {corridas.map((corrida) => {
                    return (
                      <tr key={corrida.corridafinancieraid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {corrida.nopago}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{formatDate(corrida.fecha)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatCurrency(corrida.mensualidad)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatCurrency(corrida.saldo)}
                        </td>
                        <td className="px-6 py-4">
                          {corrida.pagos && corrida.pagos.length > 0 ? (
                            <div className="space-y-2">
                              {corrida.pagos.map((pago) => (
                                <div key={pago.pagoid} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-700">{formatCurrency(pago.montopagado)} - {formatDate(pago.fechapago)}</span>
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ml-2 ${getPagoStatusColor(pago.estatus)}`}>
                                    {getPagoStatusLabel(pago.estatus)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Sin pagos</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
