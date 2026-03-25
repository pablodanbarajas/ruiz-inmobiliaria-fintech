import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ClienteForm } from '@/components/forms/ClienteForm'
import { ClienteDocumentos } from '@/components/ClienteDocumentos'
import { ChevronLeft, Edit2, Trash2 } from 'lucide-react'
import type { Cliente, Venta, Lote, Pago, CorridaFinanciera, Desarrollo } from '@/types/database'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatCurrency, getStatusLabel, getPagoStatusLabel, getPagoStatusColor } from '@/utils/helpers'

interface VentaWithDetails extends Venta {
  lote?: Lote & { desarrollo?: Desarrollo }
}

interface PagoWithDetails extends Pago {
  corridafinanciera?: CorridaFinanciera & { 
    venta?: Venta & { 
      lote?: Lote & { desarrollo?: Desarrollo }
    }
  }
}

export const ClienteDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [ventas, setVentas] = useState<VentaWithDetails[]>([])
  const [pagos, setPagos] = useState<PagoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const fetchClienteDetail = async () => {
      if (!id) return
      try {
        setLoading(true)

        // Fetch cliente
        const { data: clienteData, error: clienteError } = await supabase
          .from('cliente')
          .select('*')
          .eq('clienteid', id)
          .single()

        if (clienteError) throw clienteError
        setCliente(clienteData)

        // Fetch ventas with lote and desarrollo
        const { data: ventasData, error: ventasError } = await supabase
          .from('venta')
          .select('*, lote:lote(*, desarrollo:desarrollo(*))')
          .eq('clienteid', id)
          .order('fecha', { ascending: false })

        if (ventasError) throw ventasError
        setVentas((ventasData || []) as any)

        // Fetch pagos with corrida financiera
        const { data: pagosData, error: pagosError } = await supabase
          .from('pagos')
          .select('*, corridafinanciera:corridafinanciera(*, venta:venta(*, lote:lote(*, desarrollo:desarrollo(*))))')
          .in(
            'corridafinancieraid',
            (ventasData || []).length > 0
              ? await supabase
                  .from('corridafinanciera')
                  .select('corridafinancieraid')
                  .in(
                    'ventaid',
                    (ventasData || []).map((v) => v.ventaid)
                  )
                  .then((res) => res.data?.map((cf) => cf.corridafinancieraid) || [])
              : []
          )
          .order('fechapago', { ascending: false })

        if (!pagosError) {
          setPagos((pagosData || []) as any)
        }
      } catch (error) {
        console.error('Error fetching cliente detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClienteDetail()
  }, [id])

  const handleUpdateCliente = async (formData: any) => {
    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from('cliente')
        .update(formData)
        .eq('clienteid', id)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setIsEditModalOpen(false)

      // Refetch data
      const { data: clienteData } = await supabase
        .from('cliente')
        .select('*')
        .eq('clienteid', id)
        .single()

      setCliente(clienteData)
    } catch (error) {
      console.error('Error updating cliente:', error)
      alert('Error al actualizar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCliente = async () => {
    try {
      setDeleteLoading(true)

      // Check if there are associated ventas
      if (ventas.length > 0) {
        alert('No se puede eliminar el cliente porque tiene ventas asociadas. Cambia su estado a inactivo en su lugar.')
        return
      }

      const { error } = await supabase
        .from('cliente')
        .delete()
        .eq('clienteid', id)

      if (error) throw error

      navigate('/admin/clientes')
    } catch (error) {
      console.error('Error deleting cliente:', error)
      alert('Error al eliminar el cliente')
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

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

  if (!cliente) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró el cliente
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/clientes')}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold inline-flex items-center gap-2"
            >
              <Edit2 size={18} />
              Editar
            </Button>
            {role === 'admin' && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-2"
              >
                <Trash2 size={18} />
                Eliminar
              </Button>
            )}
          </div>
        </div>

        {/* Cliente Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-3xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            {cliente.nombre}
          </h1>

          {/* Section 1: General Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Información General</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">ID Cliente</p>
                <p className="text-sm font-bold text-gray-900">{cliente.clienteid}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Nombre</p>
                <p className="text-sm font-bold text-gray-900">{cliente.nombre || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Sexo</p>
                <p className="text-sm font-bold text-gray-900">{cliente.sexo || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado</p>
                <span className={`text-xs font-bold inline-block px-2 py-1 rounded-full ${
                  cliente.estatus === 'A'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {getStatusLabel(cliente.estatus)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Identification */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Datos de Identificación</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">RFC</p>
                <p className="text-sm font-bold text-gray-900">{cliente.rfc || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">CURP</p>
                <p className="text-sm font-bold text-gray-900">{cliente.curp || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Clave Elector</p>
                <p className="text-sm font-bold text-gray-900">{cliente.claveelector || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Contact */}
          <div className="bg-amber-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Contacto</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Email</p>
                <p className="text-sm font-bold text-gray-900">{cliente.email || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Teléfono Celular</p>
                <p className="text-sm font-bold text-gray-900">{cliente.telefonocelular || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Teléfono 2</p>
                <p className="text-sm font-bold text-gray-900">{cliente.telefono2 || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 4: Address */}
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Domicilio</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Calle</p>
                <p className="text-sm font-bold text-gray-900">{cliente.calle || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">No. Exterior</p>
                <p className="text-sm font-bold text-gray-900">{cliente.numeroext || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">No. Interior</p>
                <p className="text-sm font-bold text-gray-900">{cliente.numeroint || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Código Postal</p>
                <p className="text-sm font-bold text-gray-900">{cliente.codigopostal || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Colonia</p>
                <p className="text-sm font-bold text-gray-900">{cliente.colonia || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Municipio/Ciudad</p>
                <p className="text-sm font-bold text-gray-900">{cliente.municipio_ciudad || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado</p>
                <p className="text-sm font-bold text-gray-900">{cliente.estado || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">País</p>
                <p className="text-sm font-bold text-gray-900">{cliente.pais || '-'}</p>
              </div>
            </div>
            <div className="bg-white rounded p-2 mt-3">
              <p className="text-xs text-gray-600">Domicilio de Cobro</p>
              <p className="text-sm font-bold text-gray-900">{cliente.domiciliocobro || '-'}</p>
            </div>
          </div>

          {/* Section 5: Marital Information */}
          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Información Matrimonial</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado Civil</p>
                <p className="text-sm font-bold text-gray-900">{cliente.estadocivil || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Régimen Matrimonial</p>
                <p className="text-sm font-bold text-gray-900">{cliente.regimenmatrimonial || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Nombre Cónyuge</p>
                <p className="text-sm font-bold text-gray-900">{cliente.nombreconyuge || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 6: Birth Information */}
          <div className="bg-cyan-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Datos de Nacimiento</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Municipio/Ciudad Nacimiento</p>
                <p className="text-sm font-bold text-gray-900">{cliente.municipio_ciudad_nacimiento || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado Nacimiento</p>
                <p className="text-sm font-bold text-gray-900">{cliente.estado_nacimiento || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">País Nacimiento</p>
                <p className="text-sm font-bold text-gray-900">{cliente.pais_nacimiento || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 7: Additional Info */}
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Información Adicional</h2>
            <div className="bg-white rounded p-2 mb-3">
              <p className="text-xs text-gray-600">Beneficiarios</p>
              <p className="text-sm font-bold text-gray-900">{cliente.beneficiarios || '-'}</p>
            </div>
            <div className="bg-white rounded p-2">
              <p className="text-xs text-gray-600">Comentarios</p>
              <p className="text-sm text-gray-900">{cliente.comentarios || '-'}</p>
            </div>
          </div>
        </div>

        {/* Expediente Documental */}
        <ClienteDocumentos clienteid={cliente.clienteid} />

        {/* Ventas section */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-8 py-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Ventas Asociadas ({ventas.length})</h2>
          </div>

          {ventas.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay ventas registradas para este cliente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Venta ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Desarrollo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Manzana</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lote</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Precio</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Enganche</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventas.map((venta) => (
                    <tr key={venta.ventaid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{venta.ventaid}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {venta.lote?.desarrollo?.nombre || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {venta.lote?.manzana || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {venta.lote?.nolote || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(venta.fecha)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(venta.preciolote)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(venta.enganche)}</td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/ventas/${venta.ventaid}`, { state: { from: `/admin/clientes/${id}` } })}
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

        {/* Pagos section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Pagos Realizados ({pagos.length})</h2>
          </div>

          {pagos.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay pagos registrados para este cliente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pago ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Venta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Desarrollo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Manzana</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lote</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha de Pago</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Monto</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagos.map((pago) => (
                    <tr key={pago.pagoid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{pago.pagoid}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {pago.corridafinanciera?.venta?.ventaid || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {pago.corridafinanciera?.venta?.lote?.desarrollo?.nombre || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {pago.corridafinanciera?.venta?.lote?.manzana || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {pago.corridafinanciera?.venta?.lote?.nolote || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(pago.fechapago)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(pago.montopagado)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPagoStatusColor(pago.estatus)}`}>
                          {getPagoStatusLabel(pago.estatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/pagos/${pago.pagoid}`, { state: { from: `/admin/clientes/${id}` } })}
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

      {/* Modal para editar */}
      <Modal
        isOpen={isEditModalOpen}
        title="Editar Cliente"
        onClose={() => setIsEditModalOpen(false)}
      >
        <ClienteForm
          cliente={cliente}
          onSubmit={handleUpdateCliente}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        isOpen={showDeleteConfirm}
        title="Confirmar eliminación"
        onClose={() => setShowDeleteConfirm(false)}
      >
        <div className="text-center">
          <p className="text-gray-700 mb-6">
            ¿Estás seguro de que deseas eliminar al cliente <strong>{cliente?.nombre}</strong>?
          </p>
          <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
              className="px-6 py-2"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteCliente}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2"
            >
              {deleteLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
