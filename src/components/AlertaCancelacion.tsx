/**
 * AlertaCancelacion — flujo de avisos por atraso (3.6 de la minuta)
 *
 * Etapas:
 *  0  ≥ 3 corridas vencidas, sin avisos        → Riesgo / botón "Registrar Aviso 1"
 *  1  Aviso 1 enviado, < 5 días                 → Esperando (cuenta regresiva)
 *  2  Aviso 1 enviado ≥ 5 días, sin Aviso 2    → botón "Registrar Aviso 2"
 *  3  Aviso 2 enviado, < 5 días                 → Esperando (cuenta regresiva)
 *  4  Aviso 2 enviado ≥ 5 días                  → "Documento de cancelación listo" (sin cancelar aún)
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AlertTriangle, Clock, CheckCircle2, XCircle, FileWarning } from 'lucide-react'
import type { AvisoCancelacion } from '@/types/database'
import { formatDate } from '@/utils/helpers'

const DIAS_ENTRE_AVISOS = 5

interface AlertaCancelacionProps {
  ventaid: number
  corridasVencidas: number
  /** Llamado después de registrar un aviso (para refetch en el padre si se desea) */
  onAvisoRegistrado?: () => void
}

const diffDays = (from: string): number => {
  const start = new Date(from)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000)
}

export const AlertaCancelacion = ({
  ventaid,
  corridasVencidas,
  onAvisoRegistrado,
}: AlertaCancelacionProps) => {
  const [avisos, setAvisos] = useState<AvisoCancelacion[]>([])
  const [loading, setLoading] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [notas, setNotas] = useState('')
  const [showNotasInput, setShowNotasInput] = useState<string | null>(null) // tipo de aviso siendo registrado

  const fetchAvisos = async () => {
    const { data } = await supabase
      .from('avisos_cancelacion')
      .select('*')
      .eq('ventaid', ventaid)
      .order('fecha_envio', { ascending: true })
    setAvisos((data as AvisoCancelacion[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (corridasVencidas >= 3) fetchAvisos()
    else setLoading(false)
  }, [ventaid, corridasVencidas])

  if (corridasVencidas < 3 || loading) return null

  // ── Compute current stage ──────────────────────────────────────
  const aviso1 = avisos.find((a) => a.tipo === 'AVISO1')
  const aviso2 = avisos.find((a) => a.tipo === 'AVISO2')
  const documento = avisos.find((a) => a.tipo === 'DOCUMENTO')

  let stage = 0
  if (aviso1) {
    const dias1 = diffDays(aviso1.fecha_envio)
    if (dias1 < DIAS_ENTRE_AVISOS) stage = 1
    else if (!aviso2) stage = 2
    else {
      const dias2 = diffDays(aviso2.fecha_envio)
      if (dias2 < DIAS_ENTRE_AVISOS) stage = 3
      else stage = 4
    }
  }

  const registrarAviso = async (tipo: 'AVISO1' | 'AVISO2' | 'DOCUMENTO') => {
    try {
      setRegistrando(true)
      const { error } = await supabase.from('avisos_cancelacion').insert({
        ventaid,
        tipo,
        fecha_envio: new Date().toISOString().split('T')[0],
        notas: notas.trim() || null,
      })
      if (error) throw error
      setNotas('')
      setShowNotasInput(null)
      await fetchAvisos()
      onAvisoRegistrado?.()
    } catch (err: any) {
      alert(`Error al registrar aviso: ${err.message}`)
    } finally {
      setRegistrando(false)
    }
  }

  // ── Stage UI config ────────────────────────────────────────────
  const stages = [
    {
      // Stage 0: sin avisos
      bg: 'bg-red-50 border-red-400',
      icon: <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />,
      title: `Riesgo de cancelación — ${corridasVencidas} pagos vencidos sin registrar`,
      body: `Esta venta acumula ${corridasVencidas} mensualidades vencidas. Según el proceso, corresponde enviar el Aviso 1 de cancelación al cliente.`,
      actionLabel: 'Registrar envío de Aviso 1',
      actionTipo: 'AVISO1' as const,
      actionColor: 'bg-red-600 hover:bg-red-700 text-white',
    },
    {
      // Stage 1: aviso 1 enviado, < 5 días
      bg: 'bg-amber-50 border-amber-400',
      icon: <Clock size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />,
      title: 'Aviso 1 enviado — esperando respuesta',
      body: `Aviso 1 registrado el ${formatDate(aviso1?.fecha_envio ?? '')}. Quedan ${DIAS_ENTRE_AVISOS - diffDays(aviso1?.fecha_envio ?? '')} día(s) para el siguiente paso. Si no hay respuesta del cliente, se habilitará el Aviso 2.`,
      actionLabel: null,
      actionTipo: null,
      actionColor: '',
    },
    {
      // Stage 2: aviso 1 ≥ 5 días, sin aviso 2
      bg: 'bg-red-50 border-red-500',
      icon: <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />,
      title: `Han pasado ${diffDays(aviso1?.fecha_envio ?? '')} días desde el Aviso 1 — sin respuesta del cliente`,
      body: `El cliente no respondió al Aviso 1 (enviado el ${formatDate(aviso1?.fecha_envio ?? '')}). Corresponde enviar el Aviso 2 como segunda notificación.`,
      actionLabel: 'Registrar envío de Aviso 2',
      actionTipo: 'AVISO2' as const,
      actionColor: 'bg-red-600 hover:bg-red-700 text-white',
    },
    {
      // Stage 3: aviso 2 enviado, < 5 días
      bg: 'bg-amber-50 border-amber-400',
      icon: <Clock size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />,
      title: 'Aviso 2 enviado — periodo final de respuesta',
      body: `Aviso 2 registrado el ${formatDate(aviso2?.fecha_envio ?? '')}. Quedan ${DIAS_ENTRE_AVISOS - diffDays(aviso2?.fecha_envio ?? '')} día(s). Si no hay respuesta, se habilitará el documento de cancelación.`,
      actionLabel: null,
      actionTipo: null,
      actionColor: '',
    },
    {
      // Stage 4: aviso 2 ≥ 5 días
      bg: 'bg-gray-900 border-gray-700',
      icon: <FileWarning size={22} className="text-red-400 flex-shrink-0 mt-0.5" />,
      title: 'Proceso de cancelación completo — sin respuesta del cliente',
      body: documento
        ? `Documento de cancelación registrado el ${formatDate(documento.fecha_envio)}.`
        : `Han pasado los plazos del Aviso 1 y Aviso 2 sin respuesta. Registra el envío del documento formal de cancelación. La cancelación en el sistema se realizará cuando Gema lo confirme.`,
      actionLabel: documento ? null : 'Registrar envío de documento de cancelación',
      actionTipo: documento ? null : ('DOCUMENTO' as const),
      actionColor: 'bg-gray-600 hover:bg-gray-500 text-white',
    },
  ]

  const current = stages[stage]
  const isDocumentoCancelacion = stage === 4

  return (
    <div className={`border-2 rounded-xl p-5 mb-6 ${current.bg}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {current.icon}
        <div className="flex-1">
          <p className={`font-bold text-base ${isDocumentoCancelacion ? 'text-white' : 'text-gray-900'}`}>
            {current.title}
          </p>
          <p className={`text-sm mt-1 ${isDocumentoCancelacion ? 'text-gray-300' : 'text-gray-700'}`}>
            {current.body}
          </p>
        </div>
      </div>

      {/* Timeline de avisos enviados */}
      {avisos.length > 0 && (
        <div className={`mt-3 pt-3 border-t ${isDocumentoCancelacion ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs font-semibold mb-2 ${isDocumentoCancelacion ? 'text-gray-400' : 'text-gray-500'}`}>
            Historial de avisos registrados:
          </p>
          <div className="flex flex-wrap gap-3">
            {avisos.map((a) => (
              <div
                key={a.avisoid}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  a.tipo === 'AVISO1'
                    ? 'bg-amber-100 text-amber-800'
                    : a.tipo === 'AVISO2'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <CheckCircle2 size={12} />
                {a.tipo === 'AVISO1' ? 'Aviso 1' : a.tipo === 'AVISO2' ? 'Aviso 2' : 'Documento cancelación'} — {formatDate(a.fecha_envio)}
                {a.notas && <span className="font-normal opacity-70">· {a.notas}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action button */}
      {current.actionLabel && current.actionTipo && (
        <div className="mt-4">
          {showNotasInput === current.actionTipo ? (
            <div className="space-y-2">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
                rows={2}
                placeholder="Notas opcionales (canal de envío, nombre de quien lo recibió...)"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${current.actionColor} disabled:opacity-50`}
                  onClick={() => registrarAviso(current.actionTipo!)}
                  disabled={registrando}
                >
                  {registrando ? 'Guardando...' : `Confirmar — ${current.actionLabel}`}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
                  onClick={() => { setShowNotasInput(null); setNotas('') }}
                  disabled={registrando}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${current.actionColor}`}
              onClick={() => setShowNotasInput(current.actionTipo!)}
            >
              {current.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Stage 4 + documento ya registrado */}
      {stage === 4 && documento && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-400 font-semibold">
          <XCircle size={16} />
          Pendiente de cancelación formal en el sistema
        </div>
      )}
    </div>
  )
}
