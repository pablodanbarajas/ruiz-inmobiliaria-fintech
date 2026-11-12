import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { invalidateCache } from '@/lib/queryCache'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { VentaForm } from '@/components/forms/VentaForm'
import type { VentaFormData } from '@/components/forms/VentaForm'
import { PagoForm } from '@/components/forms/PagoForm'
import {
  getPagoAplicado,
  validarSaldoFavorDisponible,
  fetchSaldoFavorDisponible,
  cerrarSaldoFavor,
  esDecisionYaRegistrada,
  ROLES_DECIDEN_SALDO_FAVOR,
  QUIEN_DECIDE_SALDO_FAVOR,
} from '@/utils/pagos'
import { SaldoFavorCierrePanel, SaldoFavorDecisionFields } from '@/components/SaldoFavorCierre'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { ConvenioForm } from '@/components/forms/ConvenioForm'
import type { ConvenioFormData } from '@/components/forms/ConvenioForm'
import { ContratoFirmado } from '@/components/ContratoFirmado'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit2, XCircle, AlertTriangle, Plus, Eye, Clock, ArrowLeftRight } from 'lucide-react'
import type { Venta, Cliente, Lote, CorridaFinanciera, Pago, Desarrollo, Convenio, Devolucion, DevolucionParcialidad, CargoExtra, Traspaso, SaldoFavorDecision } from '@/types/database'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import { useAuth } from '@/context/AuthContext'
import { syncExpiredConvenios } from '@/services/convenios'
import { DetailSkeleton } from '@/components/ui/Skeleton'
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
  const { role } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [venta, setVenta] = useState<VentaWithDetails | null>(null)
  const [corridas, setCorridas] = useState<CorridaWithPagos[]>([])
  const [corridaPage, setCorridaPage] = useState(0)
  const CORRIDA_PAGE_SIZE = 10
  const [isFichaExpanded, setIsFichaExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showFormalizarModal, setShowFormalizarModal] = useState(false)
  const [formalizarData, setFormalizarData] = useState({ plazo: '100', fechaprimeramensualidad: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [selectedCorridaId, setSelectedCorridaId] = useState<number | null>(null)
  const [isSubmittingPago, setIsSubmittingPago] = useState(false)
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [conveniosEsteAnio, setConveniosEsteAnio] = useState(0)
  const [isConveniosExpanded, setIsConveniosExpanded] = useState(false)
  const [showConvenioModal, setShowConvenioModal] = useState(false)
  const [isSubmittingConvenio, setIsSubmittingConvenio] = useState(false)
  const [numParcialidades, setNumParcialidades] = useState(3)
  const [showInitialPaymentModal, setShowInitialPaymentModal] = useState(false)
  const [initialPaymentType, setInitialPaymentType] = useState<'apartado' | 'enganche' | null>(null)
  const [initialPaymentAmount, setInitialPaymentAmount] = useState('')
  const [initialPaymentDate, setInitialPaymentDate] = useState(today)
  const [initialPaymentReference, setInitialPaymentReference] = useState('')
  const [initialPaymentComment, setInitialPaymentComment] = useState('')
  const [initialPaymentError, setInitialPaymentError] = useState<string | null>(null)
  const [isSubmittingInitialPayment, setIsSubmittingInitialPayment] = useState(false)
  // A cancelled sale can have the 20% refund and the saldo a favor refund at once.
  const [devoluciones, setDevoluciones] = useState<(Devolucion & { parcialidades?: DevolucionParcialidad[] })[]>([])
  // Cancel dialog: the sale's saldo a favor (null while loading) and the decision about it.
  const [saldoCancelacion, setSaldoCancelacion] = useState<number | null>(null)
  const [decisionSaldo, setDecisionSaldo] = useState<SaldoFavorDecision | null>(null)
  const [notaSaldo, setNotaSaldo] = useState('')
  const [errorSaldoCancelacion, setErrorSaldoCancelacion] = useState(false)
  // Blocks a second click on "cancelar" before the disabled button re-renders.
  const cancelandoRef = useRef(false)
  const [cargosExtra, setCargosExtra] = useState<CargoExtra[]>([])
  const [traspasos, setTraspasos] = useState<(Traspaso & { cliente_anterior?: { nombre: string | null }; cliente_nuevo?: { nombre: string | null } })[]>([])
  const [showTraspasoModal, setShowTraspasoModal] = useState(false)
  const [isSubmittingTraspaso, setIsSubmittingTraspaso] = useState(false)
  const [traspasoNuevoClienteId, setTraspasoNuevoClienteId] = useState('')
  const [traspasoFecha, setTraspasoFecha] = useState('')
  const [traspasoNotas, setTraspasoNotas] = useState('')
  const [traspasoClientes, setTraspasoClientes] = useState<ComboOption[]>([])
  const canManageConvenios = role === 'admin'
  const canManagePayments = role === 'admin' || role === 'finanzas'
  const puedeDecidirSaldo = !!role && (ROLES_DECIDEN_SALDO_FAVOR as readonly string[]).includes(role)

  const reloadDevoluciones = async () => {
    if (!id) return
    const { data } = await supabase
      .from('devoluciones')
      .select('*, parcialidades:devolucion_parcialidades(*)')
      .eq('ventaid', id)
      .order('devolucionid', { ascending: true })
    setDevoluciones((data || []) as (Devolucion & { parcialidades?: DevolucionParcialidad[] })[])
  }

  // Load the sale's saldo a favor when the cancel dialog opens.
  useEffect(() => {
    if (!showCancelModal || !venta?.ventaid) return
    let cancelado = false
    setSaldoCancelacion(null)
    setDecisionSaldo(null)
    setNotaSaldo('')
    setErrorSaldoCancelacion(false)
    fetchSaldoFavorDisponible(venta.ventaid)
      .then((saldo) => { if (!cancelado) setSaldoCancelacion(saldo) })
      .catch(() => {
        // Don't block cancelling: the sale's detail shows the pending saldo afterwards.
        if (!cancelado) { setSaldoCancelacion(0); setErrorSaldoCancelacion(true) }
      })
    return () => { cancelado = true }
  }, [showCancelModal, venta?.ventaid])

  const parseCurrencyValue = (value: string | number | null | undefined) => {
    if (value == null || value === '') return 0
    const parsed = Number(String(value).replace(/[$,\s]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const getFallbackPrecio = () => {
    if (!venta) return 0
    if ((venta.preciolote ?? 0) > 0) return venta.preciolote ?? 0
    return venta.lote?.preciolote ?? 0
  }

  const getFallbackEngancheTotal = () => {
    if (!venta) return 0
    if ((venta.enganche ?? 0) > 0) return venta.enganche ?? 0
    return parseCurrencyValue(venta.lote?.desarrollo?.enganche)
  }

  const openInitialPaymentModal = (type: 'apartado' | 'enganche') => {
    if (!venta) return
    const engancheTotal = getFallbackEngancheTotal()
    const apartadoPagado = venta.monto_apartado_pagado ?? 0
    const defaultAmount = type === 'apartado'
      ? (venta.lote?.desarrollo?.montominimoapartado ? parseCurrencyValue(venta.lote.desarrollo.montominimoapartado) : 0)
      : Math.max(0, engancheTotal - apartadoPagado)

    setInitialPaymentType(type)
    setInitialPaymentAmount(defaultAmount > 0 ? String(defaultAmount) : '')
    setInitialPaymentDate(today)
    setInitialPaymentReference('')
    setInitialPaymentComment('')
    setInitialPaymentError(null)
    setShowInitialPaymentModal(true)
  }

  const handleSubmitInitialPayment = async () => {
    if (!venta || !initialPaymentType) return

    const amount = parseFloat(initialPaymentAmount)
    if (!amount || amount <= 0) {
      setInitialPaymentError('Ingresa un monto válido')
      return
    }

    try {
      setIsSubmittingInitialPayment(true)
      setInitialPaymentError(null)

      const paymentDate = initialPaymentDate || today
      const ventaTag = `Venta ${venta.ventaid}`
      const rawReference = initialPaymentReference.trim() || `Pago ${initialPaymentType === 'apartado' ? 'de apartado' : 'de enganche'} · ${ventaTag}`
      const paymentReference = rawReference.includes(ventaTag) ? rawReference : `${rawReference} · ${ventaTag}`
      const baseComment = initialPaymentComment.trim() || `Registro de ${initialPaymentType === 'apartado' ? 'apartado' : 'enganche'} desde administración · ${ventaTag}`
      const paymentComment = baseComment.includes(ventaTag) ? baseComment : `${baseComment} · ${ventaTag}`

      const updates: Record<string, any> = {}
      if (initialPaymentType === 'apartado') {
        updates.estatus = 'E'
        updates.monto_apartado_pagado = amount
        if ((venta.enganche ?? 0) <= 0) {
          const fallbackEnganche = getFallbackEngancheTotal()
          if (fallbackEnganche > 0) updates.enganche = fallbackEnganche
        }
        if ((venta.preciolote ?? 0) <= 0) {
          const fallbackPrecio = getFallbackPrecio()
          if (fallbackPrecio > 0) updates.preciolote = fallbackPrecio
        }
        const fechaLimite = new Date()
        fechaLimite.setDate(fechaLimite.getDate() + 15)
        updates.fecha_limite_enganche = fechaLimite.toISOString().split('T')[0]
      } else {
        const apartadoPagado = venta.monto_apartado_pagado ?? 0
        const engancheTotal = (venta.enganche ?? 0) > 0
          ? (venta.enganche ?? 0)
          : Math.max(0, amount + apartadoPagado)
        const precioActual = (venta.preciolote ?? 0) > 0 ? (venta.preciolote ?? 0) : getFallbackPrecio()
        updates.estatus = 'A'
        updates.fechaenganche = paymentDate
        updates.fechacontrato = venta.fechacontrato || paymentDate
        if (engancheTotal > 0) updates.enganche = engancheTotal
        if (precioActual > 0) updates.preciolote = precioActual
        if (engancheTotal > 0 && precioActual > 0) {
          updates.porcenganche = parseFloat(((engancheTotal / precioActual) * 100).toFixed(2))
        }
      }

      const { error: ventaError } = await supabase
        .from('venta')
        .update(updates)
        .eq('ventaid', venta.ventaid)
      if (ventaError) throw ventaError

      const pagoPayload = {
        corridafinancieraid: null,
        fechapago: paymentDate,
        montopagado: amount,
        formapago: 1,
        estatus: 'P',
        referencia: paymentReference,
        comentario: paymentComment,
      }

      let insertResult = await supabase.from('pagos').insert(pagoPayload)
      if (insertResult.error && /corridafinancieraid/i.test(insertResult.error.message || '')) {
        insertResult = await supabase.from('pagos').insert({
          fechapago: paymentDate,
          montopagado: amount,
          formapago: 1,
          estatus: 'P',
          referencia: paymentReference,
          comentario: paymentComment,
        })
      }
      if (insertResult.error) throw insertResult.error

      setShowInitialPaymentModal(false)
      setInitialPaymentType(null)
      setInitialPaymentAmount('')
      setInitialPaymentDate(today)
      setInitialPaymentReference('')
      setInitialPaymentComment('')

      const { data: ventaData } = await supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .eq('ventaid', id)
        .single()
      setVenta(ventaData as VentaWithDetails)
    } catch (err: any) {
      console.error('Error registrando pago inicial:', err)
      setInitialPaymentError(err.message || 'No se pudo registrar el pago inicial')
    } finally {
      setIsSubmittingInitialPayment(false)
    }
  }

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

        // Fetch devoluciones (cancelled sales)
        await reloadDevoluciones()

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

  // ── Formalizar venta (generar corrida para ventas del portal) ────────────
  const handleFormalizar = async () => {
    const plazo = parseInt(formalizarData.plazo)
    const fechaPrimera = formalizarData.fechaprimeramensualidad
    if (!plazo || plazo <= 0) { alert('Ingresa el plazo en meses'); return }
    if (!fechaPrimera) { alert('Ingresa la fecha de primera mensualidad'); return }

    try {
      setIsSubmitting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión activa')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(`${supabaseUrl}/functions/v1/formalize-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ ventaid: Number(id), plazo, fechaprimeramensualidad: fechaPrimera }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error al formalizar')

      setShowFormalizarModal(false)
      window.location.reload()
    } catch (err: any) {
      alert(`Error al formalizar: ${err.message}`)
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
      const usuarioid = null // FK fk_venta_usuario references legacy usuario table, not auth.users
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
    if (!venta || cancelandoRef.current) return
    cancelandoRef.current = true
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
        } else {
          invalidateCache('lotes:')
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
        }
      }

      // 3b. What happens to the saldo a favor. The sale is already cancelled, so a
      // failure here only leaves the decision pending in the sale's detail.
      if (decisionSaldo && venta.ventaid) {
        try {
          await cerrarSaldoFavor(venta.ventaid, decisionSaldo, notaSaldo)
        } catch (saldoErr) {
          // Already recorded (e.g. by a second click): nothing to report.
          if (!esDecisionYaRegistrada(saldoErr)) {
            const mensaje = saldoErr instanceof Error ? saldoErr.message : String(saldoErr)
            alert(`La venta se canceló, pero no se registró la decisión del saldo a favor: ${mensaje}. Puedes decidirla desde el detalle de la venta.`)
          }
        }
      }

      setShowCancelModal(false)

      // 4. Cancelar suscripción en Quentli si existe
      if (venta.quentli_subscription_id) {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const accessToken = sessionData.session?.access_token
          if (accessToken) {
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-quentli`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                  action: 'cancel',
                  subscriptionId: venta.quentli_subscription_id,
                }),
              },
            )
          }
        } catch (qErr) {
          console.warn('No se pudo cancelar suscripción en Quentli (no bloquea):', qErr)
        }
      }

      // 5. Cancelar invoices de corridas pendientes en Quentli
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (accessToken) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-quentli`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ action: 'cancelInvoices', ventaid: venta.ventaid }),
            },
          )
        }
      } catch (qErr) {
        console.warn('No se pudieron cancelar invoices en Quentli (no bloquea):', qErr)
      }

      // Refetch
      const { data: ventaData } = await supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .eq('ventaid', id)
        .single()
      setVenta(ventaData as VentaWithDetails)
      await reloadDevoluciones()
      // Fetch cargos extra for this lote
      const { data: cargosData } = await supabase
        .from('cargos_extra')
        .select('*')
        .eq('loteid', ventaData.loteid)
        .order('fecha', { ascending: true })
      setCargosExtra((cargosData || []) as CargoExtra[])
    } catch (err: any) {
      console.error('Error cancelling venta:', err)
      alert(`Error al cancelar la venta: ${err.message}`)
    } finally {
      cancelandoRef.current = false
      setIsSubmitting(false)
    }
  }

  // ── Create pago from corrida row ───────────────────────────
  const handleCreatePagoFromCorrida = async (data: PagoFormData) => {
    try {
      setIsSubmittingPago(true)

      // Checked again here: the balance may have changed since the form loaded it.
      await validarSaldoFavorDisponible(data.corridafinancieraid, Number(data.saldo_favor_aplicado ?? 0))

      const payload = {
        corridafinancieraid: data.corridafinancieraid,
        fechapago: data.fechapago,
        montopagado: data.montopagado,
        servicios_extra: data.servicios_extra,
        saldo_favor_aplicado: data.saldo_favor_aplicado,
        formapago: data.formapago,
        cuenta_bancaria_id: data.cuenta_bancaria_id,
        estatus: data.estatus,
        referencia: data.referencia,
        comentario: data.comentario,
        recargo: data.recargo,
        cobrador: data.cobrador,
      }

      let insertResult = await supabase.from('pagos').insert(payload)

      if (
        insertResult.error &&
        data.saldo_favor_aplicado === 0 &&
        /servicios_extra|cuenta_bancaria_id/i.test(insertResult.error.message || '')
      ) {
        const fallbackComentario = [
          data.comentario,
          data.servicios_extra > 0 ? `[Abono a saldo a favor: ${data.servicios_extra}]` : null,
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
      // Invalidate financial caches so Dashboard and Tesorería reflect new payment
      invalidateCache('dashboard:')
      invalidateCache('pagos:')

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
        <DetailSkeleton />
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
    (sum, c) => sum + (c.pagos?.filter((p) => p.estatus !== 'C').reduce((ps, p) => ps + getPagoAplicado(p), 0) || 0),
    0
  )
  const precioVenta = getFallbackPrecio()
  const engancheVenta = getFallbackEngancheTotal()
  const saldoPendiente = precioVenta - totalPagado
  
  // Calcular cargos extra totales aplicables
  const totalCargosExtras = corridas.reduce((sum, corrida) => {
    // Cargos extra aplicables: no cancelados por error (estatus != 'X') y fecha <= fecha de corrida (solo en mensualidades)
    const cargosAplicables = corrida.nopago !== 0
      ? cargosExtra.filter((c) => c.estatus !== 'X' && c.fecha && corrida.fecha && c.fecha <= corrida.fecha
          && (!c.fecha_fin || c.fecha_fin >= corrida.fecha))
      : []
    return sum + cargosAplicables.reduce((s, c) => s + (c.monto || 0), 0)
  }, 0)
  
  // Calcular recargos totales
  const totalRecargos = corridas.reduce((sum, corrida) => {
    const totalPagadoCorrida = corrida.pagos
      ?.filter((p) => p.estatus !== 'C')
      .reduce((s, p) => s + getPagoAplicado(p), 0) ?? 0
    const recargo = (!totalPagadoCorrida && corrida.fecha)
      ? calcularRecargo(corrida.fecha)
      : 0
    return sum + recargo
  }, 0)
  
  const totalAPagar = saldoPendiente + totalCargosExtras + totalRecargos
  const porcPagado = precioVenta > 0 ? totalPagado / precioVenta : 0
  const aplicaDevolucion = porcPagado > 0.20
  const montoDevolucion = precioVenta * 0.20
  const isExternalVenta = Boolean(venta.vendedor_user_id || venta.vendedor)

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-4">

          {/* Action buttons (only when active) */}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2"
            >
              <Edit2 size={16} />
              Editar
            </Button>
            {isExternalVenta && canManagePayments && venta.estatus === 'P' && (
              <Button
                variant="outline"
                onClick={() => openInitialPaymentModal('apartado')}
                className="inline-flex items-center gap-2"
              >
                Registrar pago de apartado
              </Button>
            )}
            {isExternalVenta && canManagePayments && venta.estatus === 'E' && (
              <Button
                variant="outline"
                onClick={() => openInitialPaymentModal('enganche')}
                className="inline-flex items-center gap-2"
              >
                Registrar pago de enganche
              </Button>
            )}
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
            {(venta.estatus === 'A' || venta.estatus === 'E') && (
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/ventas/${id}/contrato`)}
                className="inline-flex items-center gap-2"
              >
                Generar Contrato
              </Button>
            )}
          </div>
        </div>

        {/* Banner: reserva pendiente de pago de apartado */}
        {venta.estatus === 'P' && (
          <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <span className="text-amber-500 mt-0.5">⏳</span>
            <div>
              <p className="font-semibold">Reserva activa — pendiente pago de apartado</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {venta.fecha_reserva && `Reserva realizada el ${new Date(venta.fecha_reserva).toLocaleString('es-MX')}.`}
              </p>
            </div>
          </div>
        )}

        {/* Banner: enganche pagado, admin debe formalizar */}
        {venta.estatus === 'A' && corridas.length === 0 && (
          <div className="mb-4 flex items-start justify-between gap-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            <div className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✅</span>
              <div>
                <p className="font-semibold">Enganche pagado — pendiente formalización</p>
                <p className="text-xs text-green-600 mt-0.5">
                  El cliente pagó el enganche desde el portal. Define el plazo y la primera mensualidad para activar el plan de pagos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFormalizarModal(true)}
              className="flex-shrink-0 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Formalizar venta
            </button>
          </div>
        )}

        {/* Banner: pendiente pago de enganche */}
        {venta.estatus === 'E' && (
          <div className="mb-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <span className="text-blue-500 mt-0.5">📋</span>
            <div>
              <p className="font-semibold">Pendiente pago de enganche</p>
              <p className="text-xs text-blue-600 mt-0.5">
                El apartado ya quedó registrado. Falta capturar el pago de enganche para avanzar al proceso de formalización.
                {venta.fecha_limite_enganche && ` Fecha límite de enganche: ${new Date(venta.fecha_limite_enganche + 'T12:00:00').toLocaleDateString('es-MX')}.`}
              </p>
            </div>
          </div>
        )}

        {/* Venta Details */}
        <div className="bg-white rounded-[20px] border border-[#e0e5e7] p-4 md:p-8 mb-8">
          <button
            type="button"
            onClick={() => setIsFichaExpanded((expanded) => !expanded)}
            aria-expanded={isFichaExpanded}
            className="w-full flex items-center justify-between gap-4 text-left"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#63696c]">Ficha de venta</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#142127]">Venta #{venta.ventaid}</h1>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-[#e0e5e7] px-3 py-2 text-sm font-semibold text-[#142127]">
              {isFichaExpanded ? 'Contraer' : 'Ver información'}
              {isFichaExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {isFichaExpanded && (
          <div className="mt-6">
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
              <p className="text-lg font-bold text-blue-600">{formatCurrency(precioVenta)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Enganche</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(engancheVenta)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">% Enganche</p>
              <p className="text-lg font-bold text-gray-700">
                {venta.porcenganche != null
                  ? `${venta.porcenganche}%`
                  : (precioVenta > 0 && engancheVenta > 0 ? `${((engancheVenta / precioVenta) * 100).toFixed(2)}%` : '-')}
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
          )}
        </div>

        {/* Alerta de cancelación por atraso */}
        {/* Saldo a favor de la venta cancelada: decisión tomada o pendiente */}
        {venta.estatus === 'C' && venta.ventaid && (
          <SaldoFavorCierrePanel ventaid={venta.ventaid} puedeDecidir={puedeDecidirSaldo} onDecidido={reloadDevoluciones} />
        )}

        {/* Panel de devoluciones (cuando la venta está cancelada) */}
        {venta.estatus === 'C' && devoluciones.map((devolucion) => (
          <div key={devolucion.devolucionid} className="bg-blue-50 border border-blue-200 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-lg font-semibold text-blue-900">Devolución registrada #{devolucion.devolucionid}</h3>
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
        ))}

        {/* Sin devolución del 20% en venta cancelada (la del saldo a favor es aparte) */}
        {venta.estatus === 'C' && !devoluciones.some((d) => d.motivo !== 'Reembolso de saldo a favor') && (
          <div className="bg-[#f7f8f8] border border-[#e0e5e7] rounded-[14px] p-4 mb-6 text-sm text-gray-600">
            Esta venta fue cancelada sin devolución (el cliente había pagado menos del 20% del precio total).
          </div>
        )}

        {/* Resumen financiero */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Precio Total</p>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{formatCurrency(precioVenta)}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Total Pagado</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Deuda del Lote</p>
            <p className="text-xl md:text-2xl font-bold text-orange-600">{formatCurrency(saldoPendiente)}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Cargos Extra</p>
            <p className={`text-xl md:text-2xl font-bold ${totalCargosExtras > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
              {formatCurrency(totalCargosExtras)}
            </p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Recargos</p>
            <p className={`text-xl md:text-2xl font-bold ${totalRecargos > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
              {formatCurrency(totalRecargos)}
            </p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] p-4 md:p-6">
            <p className="text-sm text-gray-500 mb-2">Total Adeudado</p>
            <p className="text-xl md:text-2xl font-bold text-red-600">{formatCurrency(totalAPagar)}</p>
          </div>
        </div>

        {/* Modal de pago inicial */}
        <Modal
          isOpen={showInitialPaymentModal}
          onClose={() => !isSubmittingInitialPayment && setShowInitialPaymentModal(false)}
          title={initialPaymentType === 'apartado' ? 'Registrar pago de apartado' : 'Registrar pago de enganche'}
        >
          <div className="space-y-4">
            {initialPaymentError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {initialPaymentError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialPaymentAmount}
                onChange={(e) => setInitialPaymentAmount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de pago *</label>
              <input
                type="date"
                value={initialPaymentDate}
                onChange={(e) => setInitialPaymentDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Referencia</label>
              <input
                type="text"
                value={initialPaymentReference}
                onChange={(e) => setInitialPaymentReference(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Comentario</label>
              <textarea
                value={initialPaymentComment}
                onChange={(e) => setInitialPaymentComment(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a] resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setShowInitialPaymentModal(false)} disabled={isSubmittingInitialPayment}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitInitialPayment} disabled={isSubmittingInitialPayment}>
                {isSubmittingInitialPayment ? 'Guardando…' : 'Registrar pago'}
              </Button>
            </div>
          </div>
        </Modal>

        <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)]">
          {/* Contrato Firmado */}
          <ContratoFirmado ventaid={venta.ventaid} compact />

          {/* Convenios */}
          <div className="bg-white rounded-[20px] border border-[#e0e5e7] overflow-hidden">
          <div className="px-4 md:px-6 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base md:text-lg font-bold text-gray-900">Convenios</h2>
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
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
            <div className="flex items-center gap-2">
              {venta.estatus !== 'C' && canManageConvenios && (
                <Button size="sm" onClick={() => setShowConvenioModal(true)} className="inline-flex items-center gap-2">
                  <Plus size={14} />
                  Nuevo convenio
                </Button>
              )}
              {convenios.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConveniosExpanded((expanded) => !expanded)}
                  className="inline-flex items-center gap-1"
                >
                  {isConveniosExpanded ? 'Ocultar' : 'Ver historial'}
                  {isConveniosExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
              )}
            </div>
          </div>

          {!isConveniosExpanded && (
            <div className="px-4 md:px-6 py-3">
              {convenios.length === 0 ? (
                <p className="text-sm text-gray-500">No hay convenios registrados.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                  <span><strong className="text-gray-900">{convenios.length}</strong> convenio{convenios.length !== 1 ? 's' : ''} registrado{convenios.length !== 1 ? 's' : ''}</span>
                  <span>Último: <strong className="text-gray-900">{formatDate(convenios[0].fecha)}</strong></span>
                  <span className="text-gray-500">{getConvenioStatusLabel(convenios[0].estatus)}</span>
                </div>
              )}
            </div>
          )}

          {isConveniosExpanded && convenios.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-gray-500">No hay convenios registrados</div>
          ) : isConveniosExpanded ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#142127] border-b border-[#142127]">
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
                      <td className="px-6 py-4 text-sm font-semibold">{(conv.meses_atraso ?? 0) > 0 ? <span className="text-orange-600">{conv.meses_atraso}</span> : <span className="text-gray-500">0</span>}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{conv.meses_convenio ?? '—'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-700">{conv.pago_total_mensual_objetivo != null ? formatCurrency(conv.pago_total_mensual_objetivo) : '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{conv.motivo ?? '—'}</td>
                      <td className="px-6 py-4"><span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getConvenioStatusColor(conv.estatus)}`}>{getConvenioStatusLabel(conv.estatus)}</span></td>
                      <td className="px-6 py-4"><Button variant="ghost" size="sm" onClick={() => navigate(`/admin/convenios/${conv.convenioid}`)} className="inline-flex items-center gap-1"><Eye size={14} />Ver</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          </div>
        </div>

        {/* Corrida Financiera */}
        <div className="bg-white rounded-[20px] border border-[#e0e5e7] overflow-hidden">
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
                <thead className="bg-[#142127] border-b border-[#142127]">
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
                      .reduce((s, p) => s + getPagoAplicado(p), 0) ?? 0

                    // Cargos extra aplicables: activos (no cancelados) cuya fecha de inicio
                    // es anterior o igual a la fecha de esta mensualidad (solo en mensualidades, no enganche)
                    const cargosAplicables = corrida.nopago !== 0
                      ? cargosExtra.filter(
                          (c) => c.estatus !== 'X' && c.fecha && corrida.fecha && c.fecha <= corrida.fecha
                            && (!c.fecha_fin || c.fecha_fin >= corrida.fecha)
                        )
                      : []
                    const totalCargosExtras = cargosAplicables.reduce((s, c) => s + (c.monto || 0), 0)

                    // Recargo requerido: si ya hubo pagos, usar el máximo recargo registrado en ellos
                    // (el recargo crece hasta que se liquida todo, incluyendo el mismo recargo).
                    // Si aún no hay pagos, calcular en tiempo real desde la fecha de vencimiento.
                    const pagosCorrida = corrida.pagos?.filter(p => p.estatus !== 'C') ?? []
                    const maxStoredRecargo = pagosCorrida.reduce((max, p) => Math.max(max, p.recargo ?? 0), 0)
                    const recargoRequired = pagosCorrida.length > 0
                      ? maxStoredRecargo
                      : (corrida.nopago !== 0 && corrida.fecha
                          ? calcularRecargo(corrida.fecha, today, venta.dias_tolerancia ?? 0)
                          : 0)

                    const basePagable = (corrida.mensualidad || 0) + totalCargosExtras
                    const totalAPagar = basePagable + recargoRequired
                    const isCorrIdaPaid = totalPagadoCorrida >= totalAPagar
                    // For display: show the recargo requirement (pending or paid)
                    const recargo = recargoRequired
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
                          {recargo > 0
                            ? <span className="text-orange-600">{formatCurrency(recargo)}</span>
                            : <span className="text-gray-400">—</span>
                          }
                        </td>
                        {/* Total a Pagar */}
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                          {isCorrIdaPaid
                            ? <span className="text-green-600">{formatCurrency(totalPagadoCorrida)}</span>
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
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e0e5e7] bg-[#f7f8f8] px-4 py-4 md:px-6">
                <span className="text-sm text-[#63696c]">
                  Mostrando pagos {corridaPage * CORRIDA_PAGE_SIZE + 1}–{Math.min((corridaPage + 1) * CORRIDA_PAGE_SIZE, corridas.length)} de {corridas.length}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Primera página"
                    onClick={() => setCorridaPage(0)}
                    disabled={corridaPage === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e0e5e7] bg-white text-sm text-[#63696c] shadow-sm transition hover:border-[#142127] hover:text-[#142127] disabled:pointer-events-none disabled:opacity-35"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    aria-label="Página anterior"
                    onClick={() => setCorridaPage((p) => p - 1)}
                    disabled={corridaPage === 0}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-[#e0e5e7] bg-white px-3 text-xs font-semibold text-[#63696c] shadow-sm transition hover:border-[#142127] hover:text-[#142127] disabled:pointer-events-none disabled:opacity-35"
                  >
                    <ChevronLeft size={14} />
                    Anterior
                  </button>
                  {Array.from({ length: Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) }, (_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setCorridaPage(i)}
                      aria-label={`Página ${i + 1}`}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2.5 text-xs font-semibold shadow-sm transition ${
                        i === corridaPage
                          ? 'border-[#142127] bg-[#142127] text-white'
                          : 'border-[#e0e5e7] bg-white text-[#63696c] hover:border-[#142127] hover:text-[#142127]'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Página siguiente"
                    onClick={() => setCorridaPage((p) => p + 1)}
                    disabled={corridaPage >= Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-[#e0e5e7] bg-white px-3 text-xs font-semibold text-[#63696c] shadow-sm transition hover:border-[#142127] hover:text-[#142127] disabled:pointer-events-none disabled:opacity-35"
                  >
                    Siguiente
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Última página"
                    onClick={() => setCorridaPage(Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1)}
                    disabled={corridaPage >= Math.ceil(corridas.length / CORRIDA_PAGE_SIZE) - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e0e5e7] bg-white text-sm text-[#63696c] shadow-sm transition hover:border-[#142127] hover:text-[#142127] disabled:pointer-events-none disabled:opacity-35"
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

      {/* ── Modal: Formalizar Venta (portal) ────────── */}
      {showFormalizarModal && (
        <Modal isOpen={showFormalizarModal} title="Formalizar Venta" onClose={() => !isSubmitting && setShowFormalizarModal(false)}>
          <div className="space-y-4 p-1">
            <p className="text-sm text-gray-600">
              Define los términos del plan de pagos. La mensualidad se calculará automáticamente.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-gray-500">Precio lote</p><p className="font-bold text-blue-600">{formatCurrency(precioVenta)}</p></div>
              <div><p className="text-gray-500">Enganche pagado</p><p className="font-bold text-green-600">{formatCurrency(engancheVenta)}</p></div>
              <div><p className="text-gray-500">Saldo a financiar</p><p className="font-bold text-orange-600">{formatCurrency(precioVenta - engancheVenta)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plazo (meses) *</label>
                <input
                  type="number" min="1" step="1"
                  value={formalizarData.plazo}
                  onChange={(e) => setFormalizarData({ ...formalizarData, plazo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha 1ª Mensualidad *</label>
                <input
                  type="date"
                  value={formalizarData.fechaprimeramensualidad}
                  onChange={(e) => setFormalizarData({ ...formalizarData, fechaprimeramensualidad: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            {formalizarData.plazo && parseInt(formalizarData.plazo) > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                <span className="font-semibold">Mensualidad calculada: </span>
                {formatCurrency((precioVenta - engancheVenta) / parseInt(formalizarData.plazo))} / mes
                {' · '}{formalizarData.plazo} meses
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowFormalizarModal(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleFormalizar} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Generando corrida...' : 'Generar corrida financiera'}
              </Button>
            </div>
          </div>
        </Modal>
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

          {/* Saldo a favor: who can decide must decide before cancelling */}
          {errorSaldoCancelacion && (
            <p className="text-sm text-amber-800">
              No se pudo revisar el saldo a favor. Si la venta tiene saldo, se decidirá después desde su detalle.
            </p>
          )}
          {saldoCancelacion === null ? (
            <p className="text-sm text-gray-500">Revisando el saldo a favor de la venta…</p>
          ) : saldoCancelacion > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              {puedeDecidirSaldo ? (
                <SaldoFavorDecisionFields
                  monto={saldoCancelacion}
                  decision={decisionSaldo}
                  nota={notaSaldo}
                  onChange={(d, n) => { setDecisionSaldo(d); setNotaSaldo(n) }}
                  disabled={isSubmitting}
                />
              ) : (
                <p className="text-sm text-amber-900">
                  Esta venta tiene {formatCurrency(saldoCancelacion)} de saldo a favor. La decisión sobre ese saldo la toma {QUIEN_DECIDE_SALDO_FAVOR} después de cancelar.
                </p>
              )}
            </div>
          )}

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
              disabled={
                isSubmitting ||
                saldoCancelacion === null ||
                (puedeDecidirSaldo && saldoCancelacion > 0 && decisionSaldo === null)
              }
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a] resize-none"
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
            >
              {isSubmittingTraspaso ? 'Registrando…' : 'Confirmar Traspaso'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
