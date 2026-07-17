import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Lote, Desarrollo } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

export interface ApartadoExternoFormData {
  // Cliente
  clienteId: number | null      // null = crear nuevo
  clienteNombre: string
  clienteTelefono: string
  clienteEmail: string
  clienteRfc: string            // opcional
  clienteCurp: string           // opcional
  // Apartado
  loteid: number
  fecha: string
  comentarios: string
}

interface ApartadoExternoFormProps {
  onSubmit: (data: ApartadoExternoFormData) => Promise<void>
  isLoading?: boolean
}

type LoteWithDesarrollo = Lote & { desarrollo?: Desarrollo }

export const ApartadoExternoForm = ({
  onSubmit,
  isLoading = false,
}: ApartadoExternoFormProps) => {
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState<'cliente' | 'apartado'>('cliente')

  // ── Cliente fields ────────────────────────────────────────
  const [usarClienteExistente, setUsarClienteExistente] = useState(false)
  const [clienteExistenteId, setClienteExistenteId] = useState('')
  const [clientesExistentes, setClientesExistentes] = useState<
    { clienteid: number; nombre: string | null; telefonocelular: string | null; rfc: string | null }[]
  >([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteRfc, setClienteRfc] = useState('')
  const [clienteCurp, setClienteCurp] = useState('')

  // ── Apartado fields ───────────────────────────────────────
  const [lotes, setLotes] = useState<LoteWithDesarrollo[]>([])
  const [loteid, setLoteid] = useState('')
  const [fecha, setFecha] = useState(today)
  const [comentarios, setComentarios] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Load catalogues ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Available lots
      const { data: lotesData } = await supabase
        .from('lote')
        .select('loteid, desarrolloid, manzana, nolote, clavelote, superficie, preciolote, estatus, desarrollo:desarrollo(*)')
        .eq('estatus', 'D')
        .order('desarrolloid')

      let filtered = (lotesData || []) as unknown as LoteWithDesarrollo[]
      if (DEMO_DESARROLLOIDS.length > 0) {
        filtered = filtered.filter((l) => DEMO_DESARROLLOIDS.includes(l.desarrolloid ?? 0))
      }
      setLotes(filtered)

      // Existing clients for "usar existente"
      let allClientes: typeof clientesExistentes = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      while (hasMore) {
        const { data } = await supabase
          .from('cliente')
          .select('clienteid, nombre, telefonocelular, rfc')
          .order('nombre')
          .range(page * pageSize, (page + 1) * pageSize - 1)
        if (!data || data.length === 0) { hasMore = false } else {
          allClientes = [...allClientes, ...(data as typeof allClientes)]
          page++
          if (data.length < pageSize) hasMore = false
        }
      }
      setClientesExistentes(allClientes)
    }
    load()
  }, [])

  const loteOptions: ComboOption[] = lotes.map((l) => ({
    value: l.loteid.toString(),
    label: `${l.desarrollo?.nombre ?? '?'} · Mza ${l.manzana} Lote ${l.nolote}`,
    sublabel: [
      l.superficie ? `${l.superficie} m²` : '',
      l.preciolote ? formatCurrency(l.preciolote) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }))

  const clienteOptions: ComboOption[] = clientesExistentes.map((c) => ({
    value: c.clienteid.toString(),
    label: c.nombre ?? `Cliente #${c.clienteid}`,
    sublabel: [c.telefonocelular, c.rfc].filter(Boolean).join(' · '),
  }))

  // ── Validation ────────────────────────────────────────────
  const validateCliente = () => {
    const errs: Record<string, string> = {}
    if (usarClienteExistente) {
      if (!clienteExistenteId) errs.clienteExistenteId = 'Seleccione un cliente'
    } else {
      if (!clienteNombre.trim()) errs.clienteNombre = 'Nombre requerido'
      if (!clienteTelefono.trim()) errs.clienteTelefono = 'Teléfono requerido'
      if (clienteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmail.trim())) {
        errs.clienteEmail = 'Email inválido'
      }
      if (
        clienteRfc.trim() &&
        !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}$/i.test(clienteRfc.trim())
      ) {
        errs.clienteRfc = 'RFC inválido (ej: XAXX000101000)'
      }
      if (
        clienteCurp.trim() &&
        !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/i.test(clienteCurp.trim())
      ) {
        errs.clienteCurp = 'CURP inválido (18 caracteres)'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateApartado = () => {
    const errs: Record<string, string> = {}
    if (!loteid) errs.loteid = 'Lote requerido'
    if (!fecha) errs.fecha = 'Fecha requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Navigation ────────────────────────────────────────────
  const handleNextStep = () => {
    if (validateCliente()) setStep('apartado')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateApartado()) return

    const data: ApartadoExternoFormData = {
      clienteId: usarClienteExistente ? parseInt(clienteExistenteId) : null,
      clienteNombre: usarClienteExistente
        ? (clientesExistentes.find((c) => c.clienteid.toString() === clienteExistenteId)?.nombre ?? '')
        : clienteNombre.trim(),
      clienteTelefono,
      clienteEmail,
      clienteRfc,
      clienteCurp,
      loteid: parseInt(loteid),
      fecha,
      comentarios,
    }
    await onSubmit(data)
  }

  const sectionClass = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'

  // ── Render ────────────────────────────────────────────────
  if (step === 'cliente') {
    return (
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#eaae4c] text-black font-bold text-sm">1</span>
          <span className="text-sm font-semibold text-gray-700">Datos del Cliente</span>
          <span className="text-gray-300 mx-1">→</span>
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-400 font-bold text-sm">2</span>
          <span className="text-sm text-gray-400">Apartado</span>
        </div>

        {/* Toggle nuevo vs existente */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setUsarClienteExistente(false); setErrors({}) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              !usarClienteExistente
                ? 'bg-[#eaae4c] border-[#eaae4c] text-black'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Nuevo cliente
          </button>
          <button
            type="button"
            onClick={() => { setUsarClienteExistente(true); setErrors({}) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              usarClienteExistente
                ? 'bg-[#eaae4c] border-[#eaae4c] text-black'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Cliente existente
          </button>
        </div>

        {usarClienteExistente ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar cliente *
            </label>
            <SearchCombobox
              options={clienteOptions}
              value={clienteExistenteId}
              onChange={setClienteExistenteId}
              placeholder="Buscar por nombre, teléfono o RFC…"
              error={errors.clienteExistenteId}
            />
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className={sectionClass}>Información del cliente</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo *
                </label>
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={clienteNombre}
                  onChange={(e) => { setClienteNombre(e.target.value); if (errors.clienteNombre) setErrors({...errors, clienteNombre: ''}) }}
                />
                {errors.clienteNombre && (
                  <p className="text-red-500 text-xs mt-1">{errors.clienteNombre}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono celular *
                </label>
                <Input
                  type="tel"
                  placeholder="10 dígitos"
                  value={clienteTelefono}
                  onChange={(e) => { setClienteTelefono(e.target.value); if (errors.clienteTelefono) setErrors({...errors, clienteTelefono: ''}) }}
                />
                {errors.clienteTelefono && (
                  <p className="text-red-500 text-xs mt-1">{errors.clienteTelefono}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com (opcional)"
                  value={clienteEmail}
                  onChange={(e) => { setClienteEmail(e.target.value); if (errors.clienteEmail) setErrors({...errors, clienteEmail: ''}) }}
                />
                {errors.clienteEmail && (
                  <p className="text-red-500 text-xs mt-1">{errors.clienteEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RFC{' '}
                  <span className="font-normal text-gray-400 text-xs">(puede completarse después)</span>
                </label>
                <Input
                  type="text"
                  placeholder="XAXX000101000 (opcional)"
                  value={clienteRfc}
                  onChange={(e) => { setClienteRfc(e.target.value.toUpperCase()); if (errors.clienteRfc) setErrors({...errors, clienteRfc: ''}) }}
                  maxLength={13}
                />
                {errors.clienteRfc && (
                  <p className="text-red-500 text-xs mt-1">{errors.clienteRfc}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CURP{' '}
                  <span className="font-normal text-gray-400 text-xs">(puede completarse después)</span>
                </label>
                <Input
                  type="text"
                  placeholder="18 caracteres (opcional)"
                  value={clienteCurp}
                  onChange={(e) => { setClienteCurp(e.target.value.toUpperCase()); if (errors.clienteCurp) setErrors({...errors, clienteCurp: ''}) }}
                  maxLength={18}
                />
                {errors.clienteCurp && (
                  <p className="text-red-500 text-xs mt-1">{errors.clienteCurp}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={handleNextStep}>
            Siguiente → Apartado
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: Apartado
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-500 font-bold text-sm">1</span>
        <span className="text-sm text-gray-400">Datos del Cliente</span>
        <span className="text-gray-300 mx-1">→</span>
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#eaae4c] text-black font-bold text-sm">2</span>
        <span className="text-sm font-semibold text-gray-700">Apartado</span>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <p className={sectionClass}>Selección de lote</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lote disponible *
          </label>
          <SearchCombobox
            options={loteOptions}
            value={loteid}
            onChange={setLoteid}
            placeholder="Buscar por desarrollo, manzana, lote…"
            error={errors.loteid}
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <p className={sectionClass}>Datos del apartado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del apartado *
            </label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Notas u observaciones del apartado (opcional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => { setStep('cliente'); setErrors({}) }}
          disabled={isLoading}
        >
          ← Atrás
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Registrar Apartado'}
        </Button>
      </div>
    </form>
  )
}
