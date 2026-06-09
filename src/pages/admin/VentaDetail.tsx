import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { VentaForm } from '@/components/forms/VentaForm'
import type { VentaFormData } from '@/components/forms/VentaForm'
import { PagoForm } from '@/components/forms/PagoForm'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { ConvenioForm } from '@/components/forms/ConvenioForm'
import type { ConvenioFormData } from '@/components/forms/ConvenioForm'
import { AlertaCancelacion } from '@/components/AlertaCancelacion'
import { ChevronLeft, Edit2, XCircle, AlertTriangle, Plus, Eye, Clock, CheckCircle2, Wrench, ArrowLeftRight } from 'lucide-react'
import type { Venta, Cliente, Lote, CorridaFinanciera, Pago, Desarrollo, Convenio, Devolucion, DevolucionParcialidad, CargoExtra, Traspaso } from '@/types/database'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import { useAuth } from '@/context/AuthContext'
import { syncExpiredConvenios } from '@/services/convenios'
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getVentaStatusLabel,
  getVentaStatusColor,
  getPagoStatusLabel,
  getPagoStatusColor,
  calcularRecargo,
  getConvenioStatusLabel,
  getConvenioStatusColor,
} from '@/utils/helpers'

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
  const { role } = useAuth()
  const [venta, setVenta] = useState<VentaWithDetails | null>(null)
  const [corridas, setCorridas] = useState<CorridaWithPagos[]>([])
  const [corridaPage, setCorridaPage] = useState(0)
  const CORRIDA_PAGE_SIZE = 10
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [selectedCorridaId, setSelectedCorridaId] = useState<number | null>(null)
  const [isSubmittingPago, setIsSubmittingPago] = useState(false)
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [conveniosEsteAnio, setConveniosEsteAnio] = useState(0)
  const [showConvenioModal, setShowConvenioModal] = useState(false)
  const [isSubmittingConvenio, setIsSubmittingConvenio] = useState(false)
  const [numParcialidades, setNumParcialidades] = useState(3)
  const [devolucion, setDevolucion] = useState<(Devolucion & { parcialidades?: DevolucionParcialidad[] }) | null>(null)
  const [cargosExtra, setCargosExtra] = useState<CargoExtra[]>([])
  const [traspasos, setTraspasos] = useState<(Traspaso & { cliente_anterior?: { nombre: string | null }; cliente_nuevo?: { nombre: string | null } })[]>([])
  const [showTraspasoModal, setShowTraspasoModal] = useState(false)
  const [isSubmittingTraspaso, setIsSubmittingTraspaso] = useState(false)
  const [traspasoNuevoClienteId, setTraspasoNuevoClienteId] = useState('')
  const [traspasoFecha, setTraspasoFecha] = useState('')
  const [traspasoNotas, setTraspasoNotas] = useState('')
  const [traspasoClientes, setTraspasoClientes] = useState<ComboOption[]>([])
  const canManageConvenios = role === 'admin'

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

        // Auto-jump to the page of the last corrida that has a payment
        const lastPaidIdx = corridasConPagos.reduce((found, c, i) => {
          const hasPago = (c.pagos?.length ?? 0) > 0
          return hasPago ? i : found
        }, 0)
        setCorridaPage(Math.floor(lastPaidIdx / 10))

        // Fetch convenios for this venta
        const { data: conveniosData } = await supabase
          .from('convenios')
          .select('*')
          .eq('ventaid', id)
          .order('fecha', { ascending: false })
        const allConvenios = conveniosData || []
        setConvenios(allConvenios)
        const anio = new Date().getFullYear()
        setConveniosEsteAnio(allConvenios.filter((c) => c.fecha?.startsWith(String(anio))).length)

        // Fetch devolucion if venta is cancelled
        const { data: devData } = await supabase
          .from('devoluciones')
          .select('*, parcialidades:devolucion_parcialidades(*)')
          .eq('ventaid', id)
          .maybeSingle()
        if (devData) setDevolucion(devData as Devolucion & { parcialidades?: DevolucionParcialidad[] })

        // Fetch cargos extra for this lote (persists across ventas)
        const { data: cargosData } = await supabase
          .from('cargos_extra')
          .select('*')
          .eq('loteid', ventaData.loteid)
          .order('fecha', { ascending: true })
        setCargosExtra((cargosData || []) as CargoExtra[])

        // Fetch traspasos for this venta
        const { data: traspasosData } = await supabase
          .from('traspasos')
          .select('*, cliente_anterior:cliente!clienteid_anterior(nombre), cliente_nuevo:cliente!clienteid_nuevo(nombre)')
          .eq('ventaid', id)
          .order('fecha', { ascending: true })
        setTraspasos((traspasosData || []) as any[])
      } catch (error) {
        console.error('Error fetching venta detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchVentaDetail()
  }, [id])

  // ── Edit handler ──────────────────────────────────────────────────
  const handleUpdateVenta = async (data: VentaFormData) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('venta')
        .update({
          fecha: data.fecha,
          fechacontrato: data.fechacontrato,
          fechaenganche: data.fechaenganche,
          fechaprimeramensualidad: data.fechaprimeramensualidad,
          estatus: data.estatus,
          comentarios: data.comentarios ?? null,
          dias_tolerancia: data.dias_tolerancia ?? null,
          vendedor: data.vendedor ?? null,
        })
        .eq('ventaid', id)

      if (error) throw error

      setShowEditModal(false)
      // Refetch updated data
      const { data: ventaData } = await supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .eq('ventaid', id)
        .single()
      setVenta(ventaData as VentaWithDetails)
    } catch (err: any) {
      console.error('Error updating venta:', err)
      alert(`Error al actualizar la venta: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Traspaso handler ─────────────────────────────────────────────
  const loadTraspasoClientes = async () => {
    let all: { clienteid: number; nombre: string | null; email: string | null }[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    while (hasMore) {
      const { data } = await supabase
        .from('cliente')
        .select('clienteid, nombre, email')
        .order('nombre')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      all = all.concat(data || [])
      hasMore = (data?.length ?? 0) === pageSize
      page++
    }
    setTraspasoClientes(
      all.map((c) => ({
        value: c.clienteid.toString(),
        label: c.nombre ?? `Cliente #${c.clienteid}`,
        sublabel: c.email ?? undefined,
      }))
    )
  }

  const handleOpenTraspasoModal = async () => {
    setTraspasoNuevoClienteId('')
    setTraspasoFecha(new Date().toISOString().split('T')[0])
    setTraspasoNotas('')
    setShowTraspasoModal(true)
    if (traspasoClientes.length === 0) {
      await loadTraspasoClientes()
    }
  }

  const handleTraspaso = async () => {
    if (!venta || !traspasoNuevoClienteId) return
    try {
      setIsSubmittingTraspaso(true)
      const { data: authData } = await supabase.auth.getUser()
      const usuarioid = authData.user?.id ?? null
      const registrado_por = authData.user?.email ?? null

      const { error: insertError } = await supabase.from('traspasos').insert({
        ventaid: venta.ventaid,
        clienteid_anterior: venta.clienteid,
        clienteid_nuevo: parseInt(traspasoNuevoClienteId),
        fecha: traspasoFecha,
        notas: traspasoNotas.trim() || null,
        usuarioid,
        registrado_por,
      })
      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('venta')
        .update({ clienteid: parseInt(traspasoNuevoClienteId) })
        .eq('ventaid', venta.ventaid)
      if (updateError) throw updateError

      // Refetch venta and traspasos
      const { data: ventaData } = await supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .eq('ventaid', id)
        .single()
      setVenta(ventaData as VentaWithDetails)

      const { data: traspasosData } = await supabase
        .from('traspasos')
        .select('*, cliente_anterior:cliente!clienteid_anterior(nombre), cliente_nuevo:cliente!clienteid_nuevo(nombre)')
        .eq('ventaid', id)
        .order('fecha', { ascending: true })
      setTraspasos((traspasosData || []) as any[])

      setShowTraspasoModal(false)
    } catch (err: any) {
      console.error('Error al registrar traspaso:', err)
      alert(`Error al registrar el traspaso: ${err.message}`)
    } finally {
      setIsSubmittingTraspaso(false)
    }
  }

  // ── Cancel handler ───────────────────────────────────────────────
  const handleCancelVenta = async () => {
    if (!venta) return
    try {
      setIsSubmitting(true)

      const preciolote = venta.preciolote ?? 0
      const porcPagado = preciolote > 0 ? totalPagado / preciolote : 0
      const aplicaDevolucion = porcPagado > 0.20
      const montoDevolucion = preciolote * 0.20

      // 1. Mark venta as cancelled
      const { error: ventaError } = await supabase
        .from('venta')
        .update({ estatus: 'C' })
        .eq('ventaid', id)
      if (ventaError) throw ventaError

      // 2. Return lote to Disponible
      if (venta.loteid) {
        const { error: loteError } = await supabase
          .from('lote')
          .update({ estatus: 'D' })
          .eq('loteid', venta.loteid)
        if (loteError) {
          console.warn('No se pudo restablecer el estatus del lote:', loteError.message)
        }
      }

      // 3. Register devolución if >20% was paid
      if (aplicaDevolucion && venta.ventaid) {
        const { data: devData, error: devError } = await supabase
          .from('devoluciones')
          .insert({
            ventaid: venta.ventaid,
            clienteid: venta.clienteid ?? null,
            monto_total: montoDevolucion,
            motivo: 'Cancelación con más del 20% del precio pagado',
            estatus: 'P',
          })
          .select()
          .single()

        if (devError) {
          console.warn('No se pudo registrar la devolución:', devError.message)
        } else if (devData) {
          const montoParcial = parseFloat((montoDevolucion / numParcialidades).toFixed(2))
          const parcialidades = Array.from({ length: numParcialidades }, (_, i) => ({
            devolucionid: devData.devolucionid,
            monto: montoParcial,
            estatus: 'P',
            notas: `Parcialidad ${i + 1} de ${numParcialidades}`,
          }))
          await supabase.from('devolucion_parcialidades').insert(parcialidades)
          setDevolucion({ ...devData, parcialidades: parcialidades.map((p, i) => ({ ...p, parcialidadid: i, fecha_programada: null, fecha_pagada: null, created_at: null })) })
        }
      }

      setShowCancelModal(false)
      // Refetch
      const { data: ventaData } = await supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .eq('ventaid', id)
        .single()
      setVenta(ventaData as VentaWithDetails)
      // Refetch devolucion with real IDs
      const { data: devFinal } = await supabase
        .from('devoluciones')
        .select('*, parcialidades:devolucion_parcialidades(*)')
        .eq('ventaid', id)
        .maybeSingle()
      if (devFinal) setDevolucion(devFinal as Devolucion & { parcialidades?: DevolucionParcialidad[] })
        // Fetch cargos extra for this lote
        const { data: cargosData } = await supabase
          .from('cargos_extra')
          .select('*')
          .eq('loteid', ventaData.loteid)
          .order('fecha', { ascending: true })
        setCargosExtra((cargosData || []) as CargoExtra[])    } catch (err: any) {
      console.error('Error cancelling venta:', err)
      alert(`Error al cancelar la venta: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Create pago from corrida row ───────────────────────────
  const handleCreatePagoFromCorrida = async (data: PagoFormData) => {
    try {
      setIsSubmittingPago(true)
      const payload = {
        corridafinancieraid: data.corridafinancieraid,
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

      let insertResult = await supabase.from('pagos').insert(payload)

      if (insertResult.error && /servicios_extra|cuenta_bancaria_id/i.test(insertResult.error.message || '')) {
        const fallbackComentario = [
          data.comentario,
          data.servicios_extra > 0 ? `[Servicios/Extra: ${data.servicios_extra}]` : null,
          data.formapago === 2 && data.cuenta_bancaria_id ? `[Cuenta bancaria ID: ${data.cuenta_bancaria_id}]` : null,
        ].filter(Boolean).join(' | ')

        insertResult = await supabase.from('pagos').insert({
          corridafinancieraid: data.corridafinancieraid,
          fechapago: data.fechapago,
          montopagado: data.montopagado,
          formapago: data.formapago,
          estatus: data.estatus,
          referencia: data.referencia,
          comentario: fallbackComentario || null,
          recargo: data.recargo,
          cobrador: data.cobrador,
        })
      }

      if (insertResult.error) throw insertResult.error

      await syncExpiredConvenios()

      setShowPagoModal(false)
      setSelectedCorridaId(null)

      // Refetch corridas
      const { data: corridaData } = await supabase
        .from('corridafinanciera')
        .select('*')
        .eq('ventaid', id)
        .order('nopago', { ascending: true })

      const corridasConPagos = await Promise.all(
        (corridaData || []).map(async (corrida) => {
          const { data: pagosData } = await supabase
            .from('pagos')
            .select('*')
            .eq('corridafinancieraid', corrida.corridafinancieraid)

          return { ...corrida, pagos: pagosData || [] }
        })
      )
      setCorridas(corridasConPagos)
    } catch (err: any) {
      console.error('Error registering pago:', err)
      alert(`Error al registrar el pago: ${err.message}`)
    } finally {
      setIsSubmittingPago(false)
    }
  }

  // ── Create convenio ────────────────────────────────────────────────
  const handleCreateConvenio = async (data: ConvenioFormData) => {
    if (!canManageConvenios) {
      alert('Solo un administrador puede registrar convenios.')
      return
    }

    try {
      setIsSubmittingConvenio(true)
      const { error } = await supabase.from('convenios').insert({
        ventaid: id ? parseInt(id) : null,
        clienteid: venta?.clienteid ?? null,
        fecha: data.fecha,
        motivo: data.motivo,
        descripcion: data.descripcion,
        meses_atraso: data.meses_atraso,
        meses_convenio: data.meses_convenio,
        recargo_original: data.recargo_original,
        recargo_acordado: data.recargo_acordado,
        deuda_mensualidades: data.deuda_mensualidades,
        deuda_total_convenio: data.deuda_total_convenio,
        monto_convenio_mensual: data.monto_convenio_mensual,
        mensualidad_corriente: data.mensualidad_corriente,
        pago_total_mensual_objetivo: data.pago_total_mensual_objetivo,
        fecha_fin_estimada: data.fecha_fin_estimada,
        estatus: data.estatus,
        comentarios: data.comentarios,
      })
      if (error) throw error
      setShowConvenioModal(false)
      // Refetch convenios
      const { data: conveniosData } = await supabase
        .from('convenios')
        .select('*')
        .eq('ventaid', id)
        .order('fecha', { ascending: false })
      const allConvenios = conveniosData || []
      setConvenios(allConvenios)
      const anio = new Date().getFullYear()
      setConveniosEsteAnio(allConvenios.filter((c) => c.fecha?.startsWith(String(anio))).length)
    } catch (err: any) {
      alert(`Error al guardar el convenio: ${err.message}`)
    } finally {
      setIsSubmittingConvenio(false)
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

  if (!venta) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró la venta
        </div>
      </AdminLayout>
    )
  }

  // Only count non-cancelled pagos; enganche is already registered as nopago=0
  const totalPagado = corridas.reduce(
    (sum, c) => sum + (c.pagos?.filter((p) => p.estatus !== 'C').reduce((ps, p) => ps + (p.montopagado || 0), 0) || 0),
    0
  )
  const saldoPendiente = (venta.preciolote || 0) - totalPagado
  const porcPagado = (venta.preciolote ?? 0) > 0 ? totalPagado / (venta.preciolote ?? 1) : 0
  const aplicaDevolucion = porcPagado > 0.20
  const montoDevolucion = (venta.preciolote ?? 0) * 0.20

  // Corridas vencidas sin pago activo (para alerta de cancelación)
  const today = new Date().toISOString().split('T')[0]
  const corridasVencidas = corridas.filter((c) => {
    if (!c.fecha || c.fecha >= today || c.nopago === 0) return false
    const totalCorrida = c.pagos?.filter((p) => p.estatus !== 'C').reduce((s, p) => s + (p.montopagado || 0), 0) ?? 0
    return totalCorrida < (c.mensualidad || 0)
  }).length

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              const from = (location.state as any)?.from
              navigate(from || '/admin/ventas')
            }}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>

          {/* Action buttons (only when active) */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2"
            >
              <Edit2 size={16} />
              Editar
            </Button>
            {venta.estatus === 'A' && (
              <Button
                variant="outline"
                onClick={handleOpenTraspasoModal}
                className="inline-flex items-center gap-2"
              >
                <ArrowLeftRight size={16} />
                Traspaso
              </Button>
            )}
            {venta.estatus === 'A' && (
              <Button
                variant="destructive"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-2"
              >
                <XCircle size={16} />
                Cancelar Venta
              </Button>
            )}
          </div>
        </div>

        {/* Venta Details */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-8 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Venta #{venta.ventaid}</h1>

          {/* Row 1: Identificación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <Button
                variant="ghost"
                className="p-0 text-left text-base font-semibold text-blue-600 hover:underline"
                onClick={() => navigate(`/admin/clientes/${venta.clienteid}`)}
              >
                {venta.cliente?.nombre || '-'}
              </Button>
            </div>
            <div>
              <p className="text-sm text-gray-500">Desarrollo</p>
              <p className="text-base font-semibold text-gray-900">{venta.lote?.desarrollo?.nombre || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Lote</p>
              <Button
                variant="ghost"
                className="p-0 text-left text-base font-semibold text-blue-600 hover:underline"
                onClick={() => navigate(`/admin/lotes/${venta.loteid}`)}
              >
                Mza {venta.lote?.manzana} — Lote {venta.lote?.nolote}
                {venta.lote?.clavelote ? ` (${venta.lote.clavelote})` : ''}
              </Button>
            </div>
          </div>

          {/* Row 2: Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Fecha de Venta</p>
              <p className="text-base font-semibold text-gray-900">{formatDate(venta.fecha)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Contrato</p>
              <p className="text-base font-semibold text-gray-900">{formatDate(venta.fechacontrato)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Enganche</p>
              <p className="text-base font-semibold text-gray-900">{formatDate(venta.fechaenganche)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha 1ª Mensualidad</p>
              <p className="text-base font-semibold text-gray-900">{formatDate(venta.fechaprimeramensualidad)}</p>
            </div>
          </div>

          {/* Row 3: Datos financieros */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Precio del Lote</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(venta.preciolote)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Enganche</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(venta.enganche)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">% Enganche</p>
              <p className="text-lg font-bold text-gray-700">
                {venta.porcenganche != null ? `${venta.porcenganche}%` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Plazo</p>
              <p className="text-lg font-bold text-gray-700">
                {venta.plazo != null ? `${venta.plazo} meses` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensualidad</p>
              <p className="text-lg font-bold text-[#504840]">{formatCurrency(venta.mensualidad)}</p>
            </div>
          </div>

          {/* Row 4: Estatus + Vendedor + Comentarios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500 mb-1">Estado</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    getVentaStatusColor(venta.estatus)
                  }`}
                >
                  {getVentaStatusLabel(venta.estatus)}
                </span>
                {(venta.dias_tolerancia ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    <Clock size={12} />
                    {venta.dias_tolerancia} días de tolerancia
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Vendedor</p>
              <p className="text-base font-semibold text-gray-900">{venta.vendedor || '—'}</p>
            </div>
            {venta.comentarios && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Comentarios</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{venta.comentarios}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerta de cancelación por atraso */}
        {venta.estatus !== 'C' && (
          <AlertaCancelacion
            ventaid={venta.ventaid}
            corridasVencidas={corridasVencidas}
          />
        )}

        {/* Panel de devolución (cuando la venta está cancelada) */}
        {venta.estatus === 'C' && devolucion && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-lg font-semibold text-blue-900">Devolución registrada</h3>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                devolucion.estatus === 'C' ? 'bg-green-100 text-green-800' :
                devolucion.estatus === 'E' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-700'
              }`}>
                {devolucion.estatus === 'C' ? 'Completada' : devolucion.estatus === 'E' ? 'En proceso' : 'Pendiente'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Monto a devolver</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(devolucion.monto_total)}</p>
              </div>
              <div>
                <p className="text-gray-500">Motivo</p>
                <p className="font-medium text-gray-800">{devolucion.motivo}</p>
              </div>
            </div>
            {devolucion.parcialidades && devolucion.parcialidades.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-2">Parcialidades</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-blue-200">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Monto</th>
                        <th className="pb-2 pr-4">Fecha programada</th>
                        <th className="pb-2 pr-4">Fecha pagada</th>
                        <th className="pb-2">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devolucion.parcialidades.map((p, i) => (
                        <tr key={p.parcialidadid} className="border-b border-blue-100 last:border-0">
                          <td className="py-2 pr-4 text-gray-600">{i + 1}</td>
                          <td className="py-2 pr-4 font-semibold">{formatCurrency(p.monto)}</td>
                          <td className="py-2 pr-4 text-gray-600">{p.fecha_programada ? formatDate(p.fecha_programada) : '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{p.fecha_pagada ? formatDate(p.fecha_pagada) : '—'}</td>
                          <td className="py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.estatus === 'R' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {p.estatus === 'R' ? 'Realizada' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sin devolución en venta cancelada */}
        {venta.estatus === 'C' && !devolucion && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
            Esta venta fue cancelada sin devolución (el cliente había pagado menos del 20% del precio total).
          </div>
        )}

        {/* Resumen financiero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Precio Total</p>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{formatCurrency(venta.preciolote)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Mensualidad</p>
            <p className="text-xl md:text-2xl font-bold text-[#504840]">{formatCurrency(venta.mensualidad)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Total Pagado</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Saldo Pendiente</p>
            <p className="text-xl md:text-2xl font-bold text-orange-600">{formatCurrency(saldoPendiente)}</p>
          </div>
        </div>

        {/* Convenios */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-8 mb-8">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Convenios</h2>
              <span
                className={`px-2 py-0.5 text-sm font-semibold rounded-full ${
                  conveniosEsteAnio >= 3
                    ? 'bg-red-100 text-red-700'
                    : conveniosEsteAnio === 2
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {conveniosEsteAnio}/3 este año
              </span>
            </div>
            {venta.estatus !== 'C' && canManageConvenios && (
              <Button
                onClick={() => setShowConvenioModal(true)}
                className="inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Nuevo Convenio
              </Button>
            )}
          </div>

          {convenios.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">No hay convenios registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pagos en Atraso</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Meses convenio</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pago mensual objetivo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Motivo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {convenios.map((conv) => (
                    <tr key={conv.convenioid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">#{conv.convenioid}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(conv.fecha)}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {(conv.meses_atraso ?? 0) > 0 ? (
                          <span className="text-orange-600">{conv.meses_atraso}</span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{conv.meses_convenio ?? '—'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-700">
                        {conv.pago_total_mensual_objetivo != null ? formatCurrency(conv.pago_total_mensual_objetivo) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{conv.motivo ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            getConvenioStatusColor(conv.estatus)
                          }`}
                        >
                          {getConvenioStatusLabel(conv.estatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/convenios/${conv.convenioid}`)}
                          className="inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
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

        {/* Corrida Financiera */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Corrida Financiera</h2>
          </div>

          {corridas.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay corrida financiera registrada
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">No. Pago</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha Esperada</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mensualidad</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cargos Extra</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Recargo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total a Pagar</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Saldo Pendiente</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pagos Realizados</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {corridas.slice(corridaPage * CORRIDA_PAGE_SIZE, (corridaPage + 1) * CORRIDA_PAGE_SIZE).map((corrida) => {
                    const totalPagadoCorrida = corrida.pagos
                      ?.filter((p) => p.estatus !== 'C')
                      .reduce((s, p) => s + (p.montopagado || 0), 0) ?? 0

                    // Cargos extra aplicables: activos (no cancelados) cuya fecha de inicio
                    // es anterior o igual a la fecha de esta mensualidad (solo en mensualidades, no enganche)
                    const cargosAplicables = corrida.nopago !== 0
                      ? cargosExtra.filter(
                          (c) => c.estatus !== 'X' && c.fecha && corrida.fecha && c.fecha <= corrida.fecha
                        )
                      : []
                    const totalCargosExtras = cargosAplicables.reduce((s, c) => s + (c.monto || 0), 0)

                    const recargo = (!totalPagadoCorrida && corrida.fecha)
                      ? calcularRecargo(corrida.fecha)
                      : 0

                    const totalAPagar = (corrida.mensualidad || 0) + totalCargosExtras + recargo
                    const isCorrIdaPaid = totalPagadoCorrida >= (corrida.mensualidad || 0)
                    return (
                      <tr key={corrida.corridafinancieraid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {corrida.nopago}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{formatDate(corrida.fecha)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatCurrency(corrida.mensualidad)}
                        </td>
                        {/* Cargos Extra */}
                        <td className="px-6 py-4 text-sm">
                          {cargosAplicables.length > 0 ? (
                            <div className="space-y-0.5">
                              {cargosAplicables.map((c) => (
                                <div key={c.cargoid} className="text-purple-700 font-medium">
                                  +{formatCurrency(c.monto)}
                                  <span className="text-xs text-gray-400 ml-1">({c.concepto})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        {/* Recargo */}
                        <td className="px-6 py-4 text-sm font-semibold">
                          {(() => {
                            if (isCorrIdaPaid || !corrida.fecha) return <span className="text-gray-400">—</span>
                            const r = calcularRecargo(corrida.fecha)
                            return r > 0
                              ? <span className="text-orange-600">{formatCurrency(r)}</span>
                              : <span className="text-gray-400">—</span>
                          })()}
                        </td>
                        {/* Total a Pagar */}
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {isCorrIdaPaid
                            ? <span className="text-green-600">{formatCurrency(corrida.mensualidad)}</span>
                            : <span className={totalCargosExtras > 0 || recargo > 0 ? 'text-purple-800' : ''}>
                                {formatCurrency(totalAPagar)}
                              </span>
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatCurrency(corrida.saldo)}
                        </td>
                        <td className="px-6 py-4">
                          {corrida.pagos && corrida.pagos.length > 0 ? (
                            <div className="space-y-2">
                              {corrida.pagos.map((pago) => (
                                <div key={pago.pagoid} className="flex items-center justify-between text-sm">
                                  <button
                                    type="button"
                                    className="text-blue-600 hover:underline text-left"
                                    onClick={() => navigate(`/admin/pagos/${pago.pagoid}`)}
                                  >
                                    {formatCurrency(pago.montopagado)} · {formatDate(pago.fechapago)}
                                  </button>
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
                        <td className="px-6 py-4">
                          {isCorrIdaPaid ? (
                            <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Pagado
                            </span>
                          ) : venta.estatus !== 'C' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCorridaId(corrida.corridafinancieraid)
                                setShowPagoModal(true)
                              }}
                              className="inline-flex items-center gap-1 text-xs"
                            >
                              <Plus size={12} />
                              Registrar Pago
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación de corrida */}
            {corridas.length > CORRIDA_PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">
                  Mostrando pagos {corridaPage * CORRIDA_PAGE_SIZE + 1}–{Math.min((corridaPage + 1) * CORRIDA_PAGE_SIZE, corridas.length)} de {corridas.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCorridaPage(0)}
                    disabled={corridaPage === 0}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCorridaPage((p) => p - 1)}
                    disabled={corridaPage === 0}
                    className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {Array.from({ length: Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCorridaPage(i)}
                      className={`px-3 py-1 text-xs rounded border ${
                        i === corridaPage
                          ? 'bg-[#eaae4c] border-[#eaae4c] font-bold'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCorridaPage((p) => p + 1)}
                    disabled={corridaPage >= Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1}
                    className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setCorridaPage(Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1)}
                    disabled={corridaPage >= Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* ── Cargos Extra ───────────────────────────────── */}
      {cargosExtra.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mt-8 mb-8">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wrench size={20} className="text-[#504840]" />
              <h2 className="text-xl font-semibold text-gray-900">Cargos Extra</h2>
              <span className="text-sm text-gray-500">
                ({cargosExtra.filter((c) => c.estatus === 'P').length} pendiente
                {cargosExtra.filter((c) => c.estatus === 'P').length !== 1 ? 's' : ''})
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3">Monto</th>
                  <th className="px-6 py-3">Fecha inicio</th>
                  <th className="px-6 py-3">Estatus</th>
                  <th className="px-6 py-3">Fecha de pago</th>
                  {venta?.estatus !== 'C' && <th className="px-6 py-3">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargosExtra.map((cargo) => (
                  <tr key={cargo.cargoid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{cargo.concepto}</td>
                    <td className="px-6 py-4 font-semibold text-[#504840]">{formatCurrency(cargo.monto)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(cargo.fecha)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        cargo.estatus === 'C' ? 'bg-green-100 text-green-800' :
                        cargo.estatus === 'X' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {cargo.estatus === 'C' ? 'Cobrado' : cargo.estatus === 'X' ? 'Cancelado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {cargo.fecha_pago ? formatDate(cargo.fecha_pago) : '—'}
                    </td>
                    {venta?.estatus !== 'C' && (
                      <td className="px-6 py-4">
                        {cargo.estatus === 'P' && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              className="p-1 text-green-600 hover:bg-green-50 inline-flex items-center gap-1 text-xs"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from('cargos_extra')
                                  .update({ estatus: 'C', fecha_pago: new Date().toISOString().split('T')[0] })
                                  .eq('cargoid', cargo.cargoid)
                                if (!error) {
                                  const { data } = await supabase.from('cargos_extra').select('*').eq('loteid', venta?.loteid).order('fecha')
                                  setCargosExtra((data || []) as CargoExtra[])
                                }
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Cobrado
                            </Button>
                            <Button
                              variant="ghost"
                              className="p-1 text-red-500 hover:bg-red-50 inline-flex items-center gap-1 text-xs"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from('cargos_extra')
                                  .update({ estatus: 'X' })
                                  .eq('cargoid', cargo.cargoid)
                                if (!error) {
                                  const { data } = await supabase.from('cargos_extra').select('*').eq('loteid', venta?.loteid).order('fecha')
                                  setCargosExtra((data || []) as CargoExtra[])
                                }
                              }}
                            >
                              <XCircle size={14} />
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Summary row */}
          {cargosExtra.some((c) => c.estatus === 'P') && (
            <div className="px-8 py-4 bg-amber-50 border-t border-amber-100 flex items-center justify-between text-sm">
              <span className="text-amber-800 font-medium">
                Total pendiente de cobro:
              </span>
              <span className="font-bold text-amber-900">
                {formatCurrency(cargosExtra.filter((c) => c.estatus === 'P').reduce((s, c) => s + c.monto, 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Historial de Traspasos ─────────────────────── */}
      {traspasos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6 overflow-hidden">
          <div className="px-8 py-4 flex items-center gap-3 border-b border-gray-100">
            <ArrowLeftRight size={20} className="text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Historial de Traspasos</h2>
            <span className="ml-auto text-sm text-gray-400">{traspasos.length} registro{traspasos.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {traspasos.map((t, idx) => (
              <div key={t.traspasoid} className="px-8 py-5">
                {/* Header: badge + timestamps */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    <ArrowLeftRight size={11} />
                    Traspaso #{idx + 1}
                  </span>
                  <span className="text-xs text-gray-400">
                    Fecha del traspaso: <span className="font-medium text-gray-600">{formatDate(t.fecha)}</span>
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    Registrado el: <span className="font-medium text-gray-600">{formatDateTime(t.created_at)}</span>
                  </span>
                </div>

                {/* Titular change */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="flex-1 min-w-36 bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Titular anterior</p>
                    <p className="text-sm font-semibold text-gray-800">{(t as any).cliente_anterior?.nombre ?? `Cliente #${t.clienteid_anterior}`}</p>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div className="flex-1 min-w-36 bg-indigo-50 rounded p-3">
                    <p className="text-xs text-indigo-500 mb-0.5">Nuevo titular</p>
                    <p className="text-sm font-semibold text-indigo-700">{(t as any).cliente_nuevo?.nombre ?? `Cliente #${t.clienteid_nuevo}`}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-6 text-xs text-gray-500">
                  {(t as any).registrado_por && (
                    <span>Registrado por: <span className="font-medium text-gray-700">{(t as any).registrado_por}</span></span>
                  )}
                  {t.notas && (
                    <span>Notas: <span className="font-medium text-gray-700">{t.notas}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Editar Venta ────────────────────── */}
      <Modal
        isOpen={showEditModal}
        title={`Editar Venta #${venta?.ventaid}`}
        onClose={() => !isSubmitting && setShowEditModal(false)}
        size="xl"
      >
        <VentaForm venta={venta} onSubmit={handleUpdateVenta} isLoading={isSubmitting} />
      </Modal>


      <Modal
        isOpen={showCancelModal}
        title="Cancelar Venta"
        onClose={() => !isSubmitting && setShowCancelModal(false)}
      >
        <div className="space-y-6">
          {/* Warning for existing payments */}
          {totalPagado > 0 && (
            <div className="flex gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Esta venta tiene pagos registrados</p>
                <p className="text-sm text-amber-700 mt-1">
                  Se han registrado pagos por{' '}
                  <span className="font-semibold">{formatCurrency(totalPagado)}</span>.
                  La cancelación <strong>no eliminará</strong> los pagos existentes ni la corrida
                  financiera, pero el lote quedará disponible para una nueva venta.
                </p>
              </div>
            </div>
          )}

          {/* Devolución: aplica si pagó >20% del precio */}
          <div className={`rounded-lg border p-4 ${aplicaDevolucion ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-sm font-semibold mb-2 text-gray-800">Cálculo de devolución (regla del 20%)</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Precio del lote</p>
                <p className="font-semibold">{formatCurrency(venta?.preciolote ?? 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total pagado</p>
                <p className="font-semibold">{formatCurrency(totalPagado)}</p>
              </div>
              <div>
                <p className="text-gray-500">% pagado</p>
                <p className={`font-bold ${aplicaDevolucion ? 'text-blue-700' : 'text-gray-700'}`}>
                  {(porcPagado * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {aplicaDevolucion ? (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-blue-800 text-sm font-medium mb-2">
                  El cliente pagó más del 20% — <strong>se generará una devolución</strong> por{' '}
                  <span className="font-bold">{formatCurrency(montoDevolucion)}</span> (20% del precio).
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-blue-800 whitespace-nowrap">Número de parcialidades:</label>
                  <select
                    value={numParcialidades}
                    onChange={(e) => setNumParcialidades(Number(e.target.value))}
                    className="border border-blue-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    {[1, 2, 3, 4, 6, 12].map((n) => (
                      <option key={n} value={n}>{n} pago{n > 1 ? 's' : ''} de {formatCurrency(montoDevolucion / n)}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                El cliente pagó menos del 20% del precio — <strong>no aplica devolución</strong>.
              </p>
            )}
          </div>

          <p className="text-gray-700">
            ¿Estás seguro de que deseas cancelar la{' '}
            <span className="font-semibold">Venta #{venta?.ventaid}</span>?
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>
              El estatus de la venta cambiará a{' '}
              <span className="font-semibold text-red-600">Cancelada</span>.
            </li>
            <li>
              El lote{' '}
              <span className="font-semibold">
                {venta?.lote?.manzana} – {venta?.lote?.nolote}
              </span>{' '}
              volverá a estar{' '}
              <span className="font-semibold text-green-700">Disponible</span>.
            </li>
            {aplicaDevolucion && (
              <li>
                Se registrará una devolución de{' '}
                <span className="font-semibold text-blue-700">{formatCurrency(montoDevolucion)}</span>{' '}
                en {numParcialidades} parcialidad{numParcialidades > 1 ? 'es' : ''}.
              </li>
            )}
          </ul>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={isSubmitting}
            >
              No, mantener activa
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelVenta}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2"
            >
              <XCircle size={16} />
              {isSubmitting ? 'Cancelando…' : 'Sí, cancelar venta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Registrar Pago ─────────────────────────── */}
      <Modal
        isOpen={showPagoModal}
        title="Registrar Pago"
        onClose={() => { if (!isSubmittingPago) { setShowPagoModal(false); setSelectedCorridaId(null) } }}
        size="xl"
      >
        {selectedCorridaId !== null && (
          <PagoForm
            initialCorridaId={selectedCorridaId}
            diasTolerancia={venta?.dias_tolerancia ?? 0}
            cargosExtra={cargosExtra}
            onSubmit={handleCreatePagoFromCorrida}
            isLoading={isSubmittingPago}
          />
        )}
      </Modal>

      {/* ── Modal: Nuevo Convenio ────────────────────────── */}
      <Modal
        isOpen={showConvenioModal}
        title="Nuevo Convenio"
        onClose={() => !isSubmittingConvenio && setShowConvenioModal(false)}
        size="xl"
      >
        <ConvenioForm
          initialVentaId={id ? parseInt(id) : undefined}
          conveniosEsteAnio={conveniosEsteAnio}
          diasTolerancia={venta?.dias_tolerancia ?? 0}
          onSubmit={handleCreateConvenio}
          isLoading={isSubmittingConvenio}
        />
      </Modal>

      {/* ── Modal: Registrar Traspaso ────────────────────── */}
      <Modal
        isOpen={showTraspasoModal}
        title="Registrar Traspaso"
        onClose={() => !isSubmittingTraspaso && setShowTraspasoModal(false)}
        size="lg"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            El traspaso cambia el titular de la venta. El historial de pagos permanece sin cambios.
          </p>

          {/* Nuevo titular */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nuevo titular <span className="text-red-500">*</span>
            </label>
            <SearchCombobox
              options={traspasoClientes}
              value={traspasoNuevoClienteId}
              onChange={setTraspasoNuevoClienteId}
              placeholder="Buscar cliente..."
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del traspaso</label>
            <input
              type="date"
              value={traspasoFecha}
              onChange={(e) => setTraspasoFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={traspasoNotas}
              onChange={(e) => setTraspasoNotas(e.target.value)}
              rows={3}
              placeholder="Motivo del traspaso..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() => setShowTraspasoModal(false)}
              disabled={isSubmittingTraspaso}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTraspaso}
              disabled={isSubmittingTraspaso || !traspasoNuevoClienteId}
              style={{ backgroundColor: '#eaae4c', color: '#000' }}
            >
              {isSubmittingTraspaso ? 'Registrando…' : 'Confirmar Traspaso'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
