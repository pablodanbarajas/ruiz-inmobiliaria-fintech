import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { invalidateCache } from '@/lib/queryCache'
import { fetchAllByKey } from '@/lib/fetchAllByKey'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { UploadCloud, Download, CheckCircle2, XCircle, AlertTriangle, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Desarrollo, Duenio } from '@/types/database'
import { buildPanteonesClaveBase, formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

const TEMPLATE_COLS = [
  'clavedesarrollo',
  'duenio',
  'coto',
  'manzana',
  'nolote',
  'tipolote',
  'estatus',
  'superficie',
  'preciopormt2',
  'linderonte',
  'colindanciante',
  'linderosur',
  'colindanciasur',
  'linderoote',
  'colindanciaote',
  'linderopte',
  'colindanciapte',
  'comentarios',
  'zona',
  'preciolote',
]

const PANTEONES_PRODUCTS = ['Gaveta', 'Cripta', 'Nicho']
const MAX_CLAVE_LENGTH = 15

interface RowPreview {
  _row: number
  clavedesarrollo: string
  duenio: string
  coto: string
  manzana: string
  nolote: string
  tipolote: string
  estatus: string
  superficie: string
  preciopormt2: string
  linderonte: string
  colindanciante: string
  linderosur: string
  colindanciasur: string
  linderoote: string
  colindanciaote: string
  linderopte: string
  colindanciapte: string
  comentarios: string
  zona: string
  _errors: string[]
  _desarrolloid?: number
  _duenioid?: number
  _preciolote?: number
  _isPanteones: boolean
  _clavelote?: string
}

type UploadStatus = 'idle' | 'parsing' | 'previewing' | 'uploading' | 'done' | 'error'

function cellStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

/** Numbers each valid cemetery space after the highest key already used for its zone and product. */
async function assignPanteonesKeys(rows: RowPreview[]) {
  const pending = rows.filter((row) => row._isPanteones && row._errors.length === 0)
  if (pending.length === 0) return

  const desarrolloIds = [...new Set(pending.map((row) => row._desarrolloid as number))]
  const existing = await fetchAllByKey<{ loteid: number; clavelote: string | null }>(
    (afterKey, pageSize) =>
      supabase
        .from('lote')
        .select('loteid, clavelote')
        .in('desarrolloid', desarrolloIds)
        .gt('loteid', afterKey)
        .order('loteid', { ascending: true })
        .limit(pageSize),
    (lote) => lote.loteid,
  )

  const lastNumberByBase = new Map<string, number>()
  for (const { clavelote } of existing) {
    const match = clavelote?.match(/^(.*)-(\d+)$/)
    if (!match) continue
    lastNumberByBase.set(match[1], Math.max(lastNumberByBase.get(match[1]) ?? 0, Number(match[2])))
  }

  for (const row of pending) {
    const base = buildPanteonesClaveBase(row.clavedesarrollo, row.zona, row.tipolote)
    const nextNumber = (lastNumberByBase.get(base) ?? 0) + 1
    const clave = `${base}-${String(nextNumber).padStart(3, '0')}`
    if (clave.length > MAX_CLAVE_LENGTH) {
      row._errors.push(`La clave ${clave} supera ${MAX_CLAVE_LENGTH} caracteres`)
      continue
    }
    lastNumberByBase.set(base, nextNumber)
    row._clavelote = clave
  }
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const example = [
    'PRU', '', '1', '01', '001', 'Habitacional', 'D', '120', '2500',
    '10', 'Calle San Antonio', '10', 'Lote 15', '12', 'Lote 2', '12', 'Lote 4', '', '', '',
  ]
  const examplePanteones = [
    'VAF', '', '', '', '', 'Gaveta', 'D', '', '',
    '', '', '', '', '', '', '', '', '', 'Centro', '50000',
  ]
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, example, examplePanteones])
  ws['!cols'] = TEMPLATE_COLS.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes')
  XLSX.writeFile(wb, 'plantilla_carga_masiva_lotes.xlsx')
}

export const CargaMasivaLotes = () => {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [duenios, setDuenios] = useState<Duenio[]>([])
  const [rows, setRows] = useState<RowPreview[]>([])
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [uploadResults, setUploadResults] = useState<{ ok: number; failed: number }>({ ok: 0, failed: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [panteonesTypeIds, setPanteonesTypeIds] = useState<number[]>([])

  useEffect(() => {
    let devQuery = supabase.from('desarrollo').select('desarrolloid, nombre, clavedesarrollo, tipodesarrolloid').order('nombre')
    if (DEMO_DESARROLLOIDS.length > 0) {
      devQuery = devQuery.in('desarrolloid', DEMO_DESARROLLOIDS)
    }
    Promise.all([
      devQuery,
      supabase.from('duenio').select('duenioid, nombre').order('nombre'),
      supabase.from('tipodesarrollo').select('tipodesarrolloid').ilike('descripcion', '%panteon%'),
    ]).then(([{ data: devData }, { data: duenData }, { data: typeData }]) => {
      setDesarrollos((devData || []) as Desarrollo[])
      setDuenios((duenData || []) as Duenio[])
      setPanteonesTypeIds((typeData || []).map((type) => type.tipodesarrolloid))
    })
  }, [])

  const parseFile = (file: File) => {
    if (!file) return
    setFileName(file.name)
    setStatus('parsing')
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (raw.length < 2) { setStatus('error'); return }

        const headerRowIdx = raw.findIndex((r) =>
          r.some((c) => ['clavedesarrollo', 'desarrollo', 'clave'].includes(String(c).toLowerCase().trim()))
        )
        if (headerRowIdx < 0) { setStatus('error'); return }

        const headers = (raw[headerRowIdx] as unknown[]).map((h) => String(h).toLowerCase().trim())

        const aliases: Record<string, string> = {
          clavedesarrollo: 'desarrollo',
          linderoote: 'linderoeste',
          colindanciaote: 'colindanciaeste',
          linderopte: 'linderooeste',
          colindanciapte: 'colindanciaoeste',
        }
        const col = (name: string): number => {
          const idx = headers.indexOf(name)
          if (idx >= 0) return idx
          return aliases[name] ? headers.indexOf(aliases[name]) : -1
        }

        const parsed: RowPreview[] = []
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const r = raw[i] as unknown[]
          const get = (name: string) => { const idx = col(name); return idx >= 0 ? cellStr(r[idx]) : '' }

          const clave = get('clavedesarrollo')
          const manzana = get('manzana')
          const nolote = get('nolote')
          const superficieStr = get('superficie')
          const precioMtStr = get('preciopormt2')
          const estatus = get('estatus').toUpperCase() || 'D'
          const zona = get('zona')
          const precioTotalStr = get('preciolote')

          if (!clave && !manzana && !nolote && !zona) continue

          const dev = desarrollos.find(
            (d) => d.clavedesarrollo?.toUpperCase().trim() === clave.toUpperCase()
          )
          const isPanteones = panteonesTypeIds.includes(dev?.tipodesarrolloid || 0)
          const tipoLoteRaw = get('tipolote')
          const productoPanteones = PANTEONES_PRODUCTS.find(
            (producto) => producto.toLowerCase() === tipoLoteRaw.toLowerCase()
          )

          const errors: string[] = []
          if (!clave) errors.push('clavedesarrollo requerida')
          if (isPanteones) {
            if (!zona) errors.push('Zona requerida')
            if (!productoPanteones) errors.push('Tipo debe ser Gaveta, Cripta o Nicho')
            if (!(Number(precioTotalStr) > 0)) errors.push('Precio inválido')
          } else {
            if (!manzana) errors.push('Manzana requerida')
            if (!nolote) errors.push('No. Lote requerido')
            if (!superficieStr || isNaN(Number(superficieStr))) errors.push('Superficie inválida')
            if (!precioMtStr || isNaN(Number(precioMtStr))) errors.push('Precio/m² inválido')
          }
          if (!['D', 'B', 'N', 'A', 'V'].includes(estatus)) errors.push('Estatus inválido (D/B/N)')
          if (clave && !dev) errors.push(`Clave "${clave}" no encontrada`)

          const duenioNombre = get('duenio')
          const duenio = duenioNombre
            ? duenios.find((d) => d.nombre?.toLowerCase().trim() === duenioNombre.toLowerCase())
            : undefined

          const superficie = parseFloat(superficieStr) || 0
          const precioMt = parseFloat(precioMtStr) || 0

          parsed.push({
            _row: i + 1,
            clavedesarrollo: clave,
            duenio: duenioNombre,
            coto: get('coto'),
            manzana,
            nolote,
            tipolote: isPanteones ? productoPanteones ?? tipoLoteRaw : tipoLoteRaw || 'Habitacional',
            estatus,
            superficie: superficieStr,
            preciopormt2: precioMtStr,
            linderonte: get('linderonte'),
            colindanciante: get('colindanciante'),
            linderosur: get('linderosur'),
            colindanciasur: get('colindanciasur'),
            linderoote: get('linderoote'),
            colindanciaote: get('colindanciaote'),
            linderopte: get('linderopte'),
            colindanciapte: get('colindanciapte'),
            comentarios: get('comentarios'),
            zona,
            _errors: errors,
            _desarrolloid: dev?.desarrolloid,
            _duenioid: duenio?.duenioid,
            _preciolote: isPanteones ? Number(precioTotalStr) : parseFloat((superficie * precioMt).toFixed(2)),
            _isPanteones: isPanteones,
          })
        }
        await assignPanteonesKeys(parsed)
        setRows(parsed)
        setStatus('previewing')
      } catch {
        setStatus('error')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }

  const handleUpload = async () => {
    const validRows = rows.filter((r) => r._errors.length === 0)
    if (validRows.length === 0) return
    setStatus('uploading')
    let ok = 0
    let failed = 0
    const BATCH = 50
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map((r) => ({
        desarrolloid: r._desarrolloid ?? null,
        duenioid: r._duenioid ?? null,
        coto: r.coto || null,
        manzana: r.manzana || null,
        nolote: r.nolote || null,
        ...(r._isPanteones ? { zona: r.zona, clavelote: r._clavelote } : {}),
        tipolote: r.tipolote || 'Habitacional',
        estatus: r.estatus || 'D',
        superficie: r.superficie ? parseFloat(r.superficie) : null,
        preciopormt2: r.preciopormt2 ? parseFloat(r.preciopormt2) : null,
        preciolote: r._preciolote ?? null,
        linderonte: r.linderonte ? parseFloat(r.linderonte) : null,
        colindanciante: r.colindanciante || null,
        linderosur: r.linderosur ? parseFloat(r.linderosur) : null,
        colindanciasur: r.colindanciasur || null,
        linderoote: r.linderoote ? parseFloat(r.linderoote) : null,
        colindanciaote: r.colindanciaote || null,
        linderopte: r.linderopte ? parseFloat(r.linderopte) : null,
        colindanciapte: r.colindanciapte || null,
        comentarios: r.comentarios || null,
      }))
      const { error } = await supabase.from('lote').insert(batch)
      if (error) { failed += batch.length } else { ok += batch.length }
    }
    invalidateCache('lotes:')
    setUploadResults({ ok, failed })
    setStatus('done')
  }

  const reset = () => {
    setRows([]); setStatus('idle'); setFileName('')
    setUploadResults({ ok: 0, failed: 0 })
    if (inputRef.current) inputRef.current.value = ''
  }

  const validCount = rows.filter((r) => r._errors.length === 0).length
  const errorCount = rows.filter((r) => r._errors.length > 0).length

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/lotes')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carga Masiva de Lotes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Importa lotes desde un archivo Excel (.xlsx)</p>
          </div>
        </div>

        {(status === 'idle' || status === 'parsing' || status === 'error') && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-blue-800 text-sm">Paso 1 — Descarga la plantilla</p>
                <p className="text-blue-600 text-xs mt-0.5">
                  Usa la clave corta del desarrollo (ej: PRU, PUB). En terrenos el precio total se calcula: Superficie × Precio/m². En Panteones cada fila es un espacio y su clave se genera sola.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
                <Download size={15} className="mr-1.5" />
                Descargar plantilla
              </Button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Columnas de la plantilla</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  { col: 'clavedesarrollo', req: true,  desc: 'Clave del desarrollo (PRU, PUB…)' },
                  { col: 'manzana',         req: true,  desc: 'Terrenos: número o clave de manzana' },
                  { col: 'nolote',          req: true,  desc: 'Terrenos: número del lote' },
                  { col: 'superficie',      req: true,  desc: 'Terrenos: metros cuadrados' },
                  { col: 'preciopormt2',    req: true,  desc: 'Terrenos: precio/m², el total se calcula' },
                  { col: 'zona',            req: true,  desc: 'Panteones: zona o sección' },
                  { col: 'preciolote',      req: true,  desc: 'Panteones: precio del espacio' },
                  { col: 'duenio',          req: false, desc: 'Nombre del dueño (opcional)' },
                  { col: 'coto',            req: false, desc: 'Coto (opcional)' },
                  { col: 'tipolote',        req: false, desc: 'Habitacional, Comercial… Panteones (obligatorio): Gaveta, Cripta o Nicho' },
                  { col: 'estatus',         req: false, desc: 'D=Disponible B=Bloqueado N=No disp.' },
                  { col: 'linderonte/sur/ote/pte', req: false, desc: 'Linderos en metros' },
                  { col: 'colindanciante/sur/ote/pte', req: false, desc: 'Descripción de colindancias' },
                  { col: 'comentarios',     req: false, desc: 'Notas (opcional)' },
                ].map((c) => (
                  <div key={c.col} className="bg-white rounded border border-gray-200 p-2">
                    <span className={`text-xs font-bold ${c.req ? 'text-[#16a34a]' : 'text-gray-500'}`}>
                      {c.col}{c.req ? ' *' : ''}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {desarrollos.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Claves de desarrollo disponibles</p>
                <div className="flex flex-wrap gap-2">
                  {desarrollos.map((d) => (
                    <span key={d.desarrolloid} className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono text-gray-700">
                      <strong>{d.clavedesarrollo}</strong> — {d.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Paso 2 — Sube tu archivo</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-[#16a34a] bg-yellow-50' : 'border-gray-300 hover:border-[#16a34a] hover:bg-gray-50'
                }`}
              >
                <UploadCloud size={36} className="mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-700">
                  Arrastra tu archivo aquí o <span className="text-[#16a34a]">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Solo archivos .xlsx</p>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              {status === 'error' && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <XCircle size={15} />
                  No se pudo leer el archivo. Verifica que sea un .xlsx válido con la columna "clavedesarrollo".
                </p>
              )}
              {status === 'parsing' && (
                <p className="text-gray-500 text-sm mt-2 animate-pulse">Procesando archivo…</p>
              )}
            </div>
          </div>
        )}

        {status === 'previewing' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                <CheckCircle2 size={16} />
                {validCount} lote{validCount !== 1 ? 's' : ''} válido{validCount !== 1 ? 's' : ''}
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                  <XCircle size={16} />
                  {errorCount} fila{errorCount !== 1 ? 's' : ''} con error
                </div>
              )}
              <span className="text-sm text-gray-400">{fileName}</span>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto">
                Cargar otro archivo
              </button>
            </div>

            {errorCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Las filas con error <strong>no se importarán</strong>. Corrígelas y vuelve a subir, o continúa solo con las válidas.</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Fila','Clave','Dueño','Coto','Zona','Mza','Lote','Clave de lote','Tipo','Est.','Sup. m²','Precio/m²','Precio Total','Errores'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const hasError = row._errors.length > 0
                    return (
                      <tr key={row._row} className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{row._row}</td>
                        <td className={`px-3 py-2 font-mono font-bold ${!row._desarrolloid ? 'text-red-600' : 'text-indigo-600'}`}>
                          {row.clavedesarrollo || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.duenio || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.coto || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.zona || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.manzana || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.nolote || '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{row._clavelote || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.tipolote}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                            row.estatus === 'D' ? 'bg-green-100 text-green-700' :
                            row.estatus === 'B' ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'
                          }`}>{row.estatus || 'D'}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{row.superficie || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {row.preciopormt2 ? `$${parseFloat(row.preciopormt2).toLocaleString('es-MX')}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">
                          {row._preciolote ? formatCurrency(row._preciolote) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <ul className="text-red-600 space-y-0.5">
                              {row._errors.map((e, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <XCircle size={11} className="shrink-0 mt-0.5" />{e}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <CheckCircle2 size={14} className="text-green-500" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={reset}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={validCount === 0}>
                Importar {validCount} lote{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {status === 'uploading' && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="h-10 w-10 border-4 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Importando lotes…</p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center py-16 gap-5 text-center">
            <CheckCircle2 size={52} className="text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Importación completada</h2>
              <p className="text-gray-500 mt-1">
                <span className="text-green-600 font-semibold">
                  {uploadResults.ok} lote{uploadResults.ok !== 1 ? 's' : ''} importado{uploadResults.ok !== 1 ? 's' : ''}
                </span>
                {uploadResults.failed > 0 && (
                  <> · <span className="text-red-600 font-semibold">
                    {uploadResults.failed} fallido{uploadResults.failed !== 1 ? 's' : ''}
                  </span></>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={reset}>Nueva importación</Button>
              <Button onClick={() => navigate('/admin/lotes')}>Ver Lotes</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
