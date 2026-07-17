import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { UploadCloud, Download, CheckCircle2, XCircle, AlertTriangle, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Desarrollo, Duenio } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'

// ── Template columns (same order as Excel template) ──────────────────────
const TEMPLATE_COLS = [
  'clavedesarrollo',  // clave del desarrollo ej: PRU, PUB (requerido)
  'duenio',           // nombre del dueño (opcional)
  'coto',             // coto (opcional)
  'manzana',          // manzana (requerido)
  'nolote',           // número de lote (requerido)
  'tipolote',         // Habitacional / Comercial / etc.
  'estatus',          // D=Disponible, B=Bloqueado, N=No disponible
  'superficie',       // m² (requerido)
  'preciopormt2',     // precio por m² (requerido) — precio total = superficie × preciopormt2
  'linderonte',       // Lindero Norte (m)
  'colindanciante',   // Colindancia Norte
  'linderosur',       // Lindero Sur (m)
  'colindanciasur',   // Colindancia Sur
  'linderoote',       // Lindero Este (m)
  'colindanciaote',   // Colindancia Este
  'linderopte',       // Lindero Oeste (m)
  'colindanciapte',   // Colindancia Oeste
  'comentarios',      // observaciones (opcional)
]

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
  _errors: string[]
  _desarrolloid?: number
  _duenioid?: number
  _preciolote?: number
}

type UploadStatus = 'idle' | 'parsing' | 'previewing' | 'uploading' | 'done' | 'error'

function cellStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const headers = TEMPLATE_COLS
  const example = [
    'PRU',          // clavedesarrollo
    '',             // duenio
    '1',            // coto
    '01',           // manzana
    '001',          // nolote
    'Habitacional', // tipolote
    'D',            // estatus
    '120',          // superficie
    '2500',         // preciopormt2
    '10',           // linderonte
    'Calle San Antonio', // colindanciante
    '10',           // linderosur
    'Lote 15',      // colindanciasur
    '12',           // linderoote
    'Lote 2',       // colindanciaote
    '12',           // linderopte
    'Lote 4',       // colindanciapte
    '',             // comentarios
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
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

  useEffect(() => {
    Promise.all([
      supabase.from('desarrollo').select('desarrolloid, nombre, clavedesarrollo').order('nombre'),
      supabase.from('duenio').select('duenioid, nombre').order('nombre'),
    ]).then(([{ data: devData }, { data: duenData }]) => {
      setDesarrollos((devData || []) as Desarrollo[])
      setDuenios((duenData || []) as Duenio[])
    })
  }, [])

  // ── Parse Excel ─────────────────────────────────────────────────
  const parseFile = (file: File) => {
    if (!file) return
    setFileName(file.name)
    setStatus('parsing')
    const reader = new FileReader()
    reader.onload = (e) => {
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

        const headers = (raw[headerRowIdx] as unknown[]).map((h) =>
          String(h).toLowerCase().trim()
        )
        const col = (name: string) => {
          const idx = headers.indexOf(name)
          // fallback aliases
          if (idx < 0 && name === 'clavedesarrollo') return headers.indexOf('desarrollo')
          if (idx < 0 && name === 'linderoote') return headers.indexOf('linderoeste')
          if (idx < 0 && name === 'colindanciaote') return headers.indexOf('colindanciaeste')
          if (idx < 0 && name === 'linderopte') return headers.indexOf('linderooeste')
          if (idx < 0 && name === 'colindanciapte') return headers.indexOf('colindanciaoeste')
          return idx
        }

        const parsed: RowPreview[] = []
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const r = raw[i] as unknown[]
          const get = (name: string) => {
            const idx = col(name)
            return idx >= 0 ? cellStr(r[idx]) : ''
          }

          const clave = get('clavedesarrollo')
          const manzana = get('manzana')
          const nolote = get('nolote')
          const superficieStr = get('superficie')
          const precioMtStr = get('preciopormt2')
          const estatus = get('estatus').toUpperCase() || 'D'

          if (!clave && !manzana && !nolote) continue

          const errors: string[] = []
          if (!clave) errors.push('clavedesarrollo requerida')
          if (!manzana) errors.push('Manzana requerida')
          if (!nolote) errors.push('No. Lote requerido')
          if (!superficieStr || isNaN(Number(superficieStr))) errors.push('Superficie inválida')
          if (!precioMtStr || isNaN(Number(precioMtStr))) errors.push('Precio/m² inválido')
          if (!['D', 'B', 'N', 'A', 'V'].includes(estatus)) errors.push('Estatus inválido (D/B/N)')

          const dev = desarrollos.find(
            (d) => d.clavedesarrollo?.toUpperCase().trim() === clave.toUpperCase()
          )
          if (clave && !dev) errors.push(`Clave "${clave}" no encontrada`)

          const duenioNombre = get('duenio')
          const duenio = duenioNombre
            ? duenios.find((d) => d.nombre?.toLowerCase().trim() === duenioNombre.toLowerCase())
            : undefined

          const superficie = parseFloat(superficieStr) || 0
          const precioMt = parseFloat(precioMtStr) || 0
          const preciolote = parseFloat((superficie * precioMt).toFixed(2))

          parsed.push({
            _row: i + 1,
            clavedesarrollo: clave,
            duenio: duenioNombre,
            coto: get('coto'),
            manzana,
            nolote,
            tipolote: get('tipolote') || 'Habitacional',
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
            _errors: errors,
            _desarrolloid: dev?.desarrolloid,
            _duenioid: duenio?.duenioid,
            _preciolote: preciolote,
          })
        }

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

  // ── Upload ─────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    const validRows = rows.filter((r) => r._errors.length === 0)
    if (validRows.length === 0) return
    setStatus('uploading')
    let ok = 0; let failed = 0
    const BATCH = 50
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map((r) => ({
        desarrolloid: r._desarrolloid ?? null,
        duenioid: r._duenioid ?? null,
        coto: r.coto || null,
        manzana: r.manzana,
        nolote: r.nolote,
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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/lotes')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carga Masiva de Lotes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Importa lotes desde un archivo Excel (.xlsx)</p>
          </div>
        </div>

        {/* Step 1 */}
        {(status === 'idle' || status === 'parsing' || status === 'error') && (
          <div className="space-y-5">
            {/* Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-blue-800 text-sm">Paso 1 — Descarga la plantilla</p>
                <p className="text-blue-600 text-xs mt-0.5">
                  La columna <strong>clavedesarrollo</strong> usa la clave corta del desarrollo (ej: PRU, PUB).
                  El precio total se calcula automáticamente: Superficie × Precio/m².
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
                <Download size={15} className="mr-1.5" />
                Descargar plantilla
              </Button>
            </div>

            {/* Columns reference */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Columnas de la plantilla</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  { col: 'clavedesarrollo', req: true,  desc: 'Clave del desarrollo (PRU, PUB…)' },
                  { col: 'manzana',         req: true,  desc: 'Número o clave de manzana' },
                  { col: 'nolote',          req: true,  desc: 'Número del lote' },
                  { col: 'superficie',      req: true,  desc: 'Metros cuadrados' },
                  { col: 'preciopormt2',    req: true,  desc: 'Precio/m² — precio total se calcula' },
                  { col: 'duenio',          req: false, desc: 'Nombre del dueño (opcional)' },
                  { col: 'coto',            req: false, desc: 'Coto (opcional)' },
                  { col: 'tipolote',        req: false, desc: 'Habitacional, Comercial…' },
                  { col: 'estatus',         req: false, desc: 'D=Disponible, B=Bloqueado, N=No disp.' },
                  { col: 'linderonte/sur/ote/pte', req: false, desc: 'Linderos en metros' },
                  { col: 'colindanciante/sur/ote/pte', req: false, desc: 'Descripción de colindancias' },
                  { col: 'comentarios',     req: false, desc: 'Notas (opcional)' },
                ].map((c) => (
                  <div key={c.col} className="bg-white rounded border border-gray-200 p-2">
                    <span className={`text-xs font-bold ${c.req ? 'text-[#eaae4c]' : 'text-gray-500'}`}>
                      {c.col}{c.req ? ' *' : ''}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desarrollos disponibles */}
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

            {/* Upload area */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Paso 2 — Sube tu archivo</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-[#eaae4c] bg-yellow-50' : 'border-gray-300 hover:border-[#eaae4c] hover:bg-gray-50'
                }`}
              >
                <UploadCloud size={36} className="mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-700">
                  Arrastra tu archivo aquí o <span className="text-[#eaae4c]">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Solo archivos .xlsx</p>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              {status === 'error' && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <XCircle size={15} />
                  No se pudo leer el archivo. Verifica que sea un .xlsx válido con encabezados correctos.
                </p>
              )}
              {status === 'parsing' && (
                <p className="text-gray-500 text-sm mt-2 animate-pulse">Procesando archivo…</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
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
                <span>Las filas con error <strong>no se importarán</strong>. Corrige el archivo y vuelve a subir, o continúa solo con las filas válidas.</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Fila','Clave Desarro.','Dueño','Coto','Mza','Lote','Tipo','Est.','Sup. m²','Precio/m²','Precio Total','Errores'].map((h) => (
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
                        <td className="px-3 py-2 text-gray-700">{row.manzana || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{row.nolote || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600">{row.tipolote}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                            row.estatus === 'D' ? 'bg-green-100 text-green-700' :
                            row.estatus === 'B' ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'
                          }`}>{row.estatus || 'D'}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {row.superficie || <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {row.preciopormt2 ? `$${parseFloat(row.preciopormt2).toLocaleString('es-MX')}` : <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">
                          {row._preciolote ? formatCurrency(row._preciolote) : <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <ul className="text-red-600 space-y-0.5">
                              {row._errors.map((e, i) => (
                                <li key={i} className="flex items-start gap-1">
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
            <div className="h-10 w-10 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Importando lotes…</p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center py-16 gap-5 text-center">
            <CheckCircle2 size={52} className="text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Importación completada</h2>
              <p className="text-gray-500 mt-1">
                <span className="text-green-600 font-semibold">{uploadResults.ok} lote{uploadResults.ok !== 1 ? 's' : ''} importado{uploadResults.ok !== 1 ? 's' : ''}</span>
                {uploadResults.failed > 0 && (
                  <> · <span className="text-red-600 font-semibold">{uploadResults.failed} fallido{uploadResults.failed !== 1 ? 's' : ''}</span></>
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

// ── Template columns ──────────────────────────────────────────────────────────
const TEMPLATE_COLS = [
  'desarrollo',       // nombre del desarrollo (requerido)
  'coto',             // coto (opcional)
  'manzana',          // manzana (requerido)
  'nolote',           // número de lote (requerido)
  'tipolote',         // tipo: Habitacional / Comercial / etc.
  'superficie',       // m² (requerido, número)
  'preciopormt2',     // precio por m² (opcional, número)
  'preciolote',       // precio total (requerido, número)
  'estatus',          // D=Disponible, B=Bloqueado, N=No disponible (default D)
  'comentarios',      // observaciones (opcional)
]

interface RowPreview {
  _row: number
  desarrollo: string
  coto: string
  manzana: string
  nolote: string
  tipolote: string
  superficie: string
  preciopormt2: string
  preciolote: string
  estatus: string
  comentarios: string
  _errors: string[]
  _desarrolloid?: number
}

type UploadStatus = 'idle' | 'parsing' | 'previewing' | 'uploading' | 'done' | 'error'

// ── Helper ────────────────────────────────────────────────────────────────────
function cellStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const headers = TEMPLATE_COLS
  const example = [
    'Desarrollo de Prueba', // desarrollo
    '1',                    // coto
    '01',                   // manzana
    '001',                  // nolote
    'Habitacional',         // tipolote
    '120',                  // superficie
    '2500',                 // preciopormt2
    '300000',               // preciolote
    'D',                    // estatus
    '',                     // comentarios
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])

  // Column widths
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }))

  // Header style hint (SheetJS CE doesn't support styling but adds the sheet)
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes')
  XLSX.writeFile(wb, 'plantilla_carga_masiva_lotes.xlsx')
}

export const CargaMasivaLotes = () => {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [rows, setRows] = useState<RowPreview[]>([])
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [uploadResults, setUploadResults] = useState<{ ok: number; failed: number }>({ ok: 0, failed: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    supabase.from('desarrollo').select('desarrolloid, nombre').order('nombre').then(({ data }) => {
      setDesarrollos((data || []) as Desarrollo[])
    })
  }, [])

  // ── Parse Excel ─────────────────────────────────────────────────────────────
  const parseFile = (file: File) => {
    if (!file) return
    setFileName(file.name)
    setStatus('parsing')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (raw.length < 2) {
          setStatus('error')
          return
        }

        // Find header row (first row that contains 'desarrollo')
        const headerRowIdx = raw.findIndex((r) =>
          r.some((c) => String(c).toLowerCase().trim() === 'desarrollo')
        )
        if (headerRowIdx < 0) {
          setStatus('error')
          return
        }

        const headers = (raw[headerRowIdx] as unknown[]).map((h) =>
          String(h).toLowerCase().trim()
        )

        const col = (name: string) => headers.indexOf(name)

        const parsed: RowPreview[] = []
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const r = raw[i] as unknown[]
          const get = (name: string) => cellStr(r[col(name)])

          const desarrolloNombre = get('desarrollo')
          const manzana = get('manzana')
          const nolote = get('nolote')
          const superficieStr = get('superficie')
          const precioStr = get('preciolote')
          const estatus = get('estatus').toUpperCase() || 'D'

          // Skip fully empty rows
          if (!desarrolloNombre && !manzana && !nolote) continue

          const errors: string[] = []
          if (!desarrolloNombre) errors.push('Desarrollo requerido')
          if (!manzana) errors.push('Manzana requerida')
          if (!nolote) errors.push('No. Lote requerido')
          if (!superficieStr || isNaN(Number(superficieStr))) errors.push('Superficie inválida')
          if (!precioStr || isNaN(Number(precioStr))) errors.push('Precio del lote inválido')
          if (!['D', 'B', 'N', 'A', 'V'].includes(estatus)) errors.push('Estatus inválido (D/B/N)')

          // Match desarrollo
          const dev = desarrollos.find(
            (d) => d.nombre?.toLowerCase().trim() === desarrolloNombre.toLowerCase().trim()
          )
          if (desarrolloNombre && !dev) errors.push(`Desarrollo "${desarrolloNombre}" no encontrado`)

          parsed.push({
            _row: i + 1,
            desarrollo: desarrolloNombre,
            coto: get('coto'),
            manzana,
            nolote,
            tipolote: get('tipolote') || 'Habitacional',
            superficie: superficieStr,
            preciopormt2: get('preciopormt2'),
            preciolote: precioStr,
            estatus,
            comentarios: get('comentarios'),
            _errors: errors,
            _desarrolloid: dev?.desarrolloid,
          })
        }

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

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    const validRows = rows.filter((r) => r._errors.length === 0)
    if (validRows.length === 0) return

    setStatus('uploading')
    let ok = 0
    let failed = 0

    // Batch in groups of 50
    const BATCH = 50
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map((r) => ({
        desarrolloid: r._desarrolloid,
        coto: r.coto || null,
        manzana: r.manzana,
        nolote: r.nolote,
        tipolote: r.tipolote || 'Habitacional',
        superficie: r.superficie ? parseFloat(r.superficie) : null,
        preciopormt2: r.preciopormt2 ? parseFloat(r.preciopormt2) : null,
        preciolote: parseFloat(r.preciolote),
        estatus: r.estatus || 'D',
        comentarios: r.comentarios || null,
      }))

      const { error } = await supabase.from('lote').insert(batch)
      if (error) {
        failed += batch.length
      } else {
        ok += batch.length
      }
    }

    setUploadResults({ ok, failed })
    setStatus('done')
  }

  const reset = () => {
    setRows([])
    setStatus('idle')
    setFileName('')
    setUploadResults({ ok: 0, failed: 0 })
    if (inputRef.current) inputRef.current.value = ''
  }

  const validCount = rows.filter((r) => r._errors.length === 0).length
  const errorCount = rows.filter((r) => r._errors.length > 0).length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin/lotes')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carga Masiva de Lotes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Importa lotes desde un archivo Excel (.xlsx)
            </p>
          </div>
        </div>

        {/* Step 1: Download template + upload */}
        {(status === 'idle' || status === 'parsing' || status === 'error') && (
          <div className="space-y-5">
            {/* Template download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-blue-800 text-sm">Paso 1 — Descarga la plantilla</p>
                <p className="text-blue-600 text-xs mt-0.5">
                  Llena la plantilla con los datos de tus lotes. Las columnas marcadas con * son obligatorias.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
                <Download size={15} className="mr-1.5" />
                Descargar plantilla
              </Button>
            </div>

            {/* Columns reference */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Columnas de la plantilla
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  { col: 'desarrollo', req: true, desc: 'Nombre exacto del desarrollo' },
                  { col: 'manzana', req: true, desc: 'Número o clave de manzana' },
                  { col: 'nolote', req: true, desc: 'Número del lote' },
                  { col: 'superficie', req: true, desc: 'Metros cuadrados (número)' },
                  { col: 'preciolote', req: true, desc: 'Precio total en MXN' },
                  { col: 'coto', req: false, desc: 'Coto (opcional)' },
                  { col: 'tipolote', req: false, desc: 'Habitacional, Comercial…' },
                  { col: 'preciopormt2', req: false, desc: 'Precio/m² (se calcula si vacío)' },
                  { col: 'estatus', req: false, desc: 'D=Disponible, B=Bloqueado, N=No disponible' },
                  { col: 'comentarios', req: false, desc: 'Notas (opcional)' },
                ].map((c) => (
                  <div key={c.col} className="bg-white rounded border border-gray-200 p-2">
                    <span className={`text-xs font-bold ${c.req ? 'text-[#eaae4c]' : 'text-gray-500'}`}>
                      {c.col}{c.req ? ' *' : ''}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload area */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Paso 2 — Sube tu archivo</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#eaae4c] bg-yellow-50'
                    : 'border-gray-300 hover:border-[#eaae4c] hover:bg-gray-50'
                }`}
              >
                <UploadCloud size={36} className="mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-700">
                  Arrastra tu archivo aquí o <span className="text-[#eaae4c]">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Solo archivos .xlsx</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {status === 'error' && (
                <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                  <XCircle size={15} />
                  No se pudo leer el archivo. Verifica que sea un .xlsx válido con encabezados correctos.
                </p>
              )}
              {status === 'parsing' && (
                <p className="text-gray-500 text-sm mt-2 animate-pulse">Procesando archivo…</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {status === 'previewing' && (
          <div className="space-y-5">
            {/* Summary */}
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
                <span>
                  Las filas con error <strong>no se importarán</strong>. Corrige el archivo y vuelve a subir, o continúa solo con las filas válidas.
                </span>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Fila</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Desarrollo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Coto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Manzana</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Lote</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Superficie m²</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Precio/m²</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Precio Lote</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">Estatus</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const hasError = row._errors.length > 0
                    return (
                      <tr
                        key={row._row}
                        className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-3 py-2 text-gray-400">{row._row}</td>
                        <td className={`px-3 py-2 ${!row._desarrolloid ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                          {row.desarrollo || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.coto || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.manzana || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{row.nolote || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600">{row.tipolote}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {row.superficie || <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {row.preciopormt2 ? formatCurrency(parseFloat(row.preciopormt2)) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">
                          {row.preciolote ? formatCurrency(parseFloat(row.preciolote)) : <span className="text-red-500">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                            row.estatus === 'D' ? 'bg-green-100 text-green-700' :
                            row.estatus === 'B' ? 'bg-gray-200 text-gray-600' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {row.estatus || 'D'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <ul className="text-red-600 space-y-0.5">
                              {row._errors.map((e, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <XCircle size={11} className="shrink-0 mt-0.5" />
                                  {e}
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

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={reset}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={validCount === 0}
              >
                Importar {validCount} lote{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {status === 'uploading' && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="h-10 w-10 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Importando lotes…</p>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div className="flex flex-col items-center py-16 gap-5 text-center">
            <CheckCircle2 size={52} className="text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Importación completada</h2>
              <p className="text-gray-500 mt-1">
                <span className="text-green-600 font-semibold">{uploadResults.ok} lote{uploadResults.ok !== 1 ? 's' : ''} importado{uploadResults.ok !== 1 ? 's' : ''}</span>
                {uploadResults.failed > 0 && (
                  <> · <span className="text-red-600 font-semibold">{uploadResults.failed} fallido{uploadResults.failed !== 1 ? 's' : ''}</span></>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={reset}>
                Nueva importación
              </Button>
              <Button onClick={() => navigate('/admin/lotes')}>
                Ver Lotes
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
