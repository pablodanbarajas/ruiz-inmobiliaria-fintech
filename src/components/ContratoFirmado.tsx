import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Upload, FileText, Trash2, Eye, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Bucket: create in Supabase Dashboard → Storage → New Bucket
// Name: "contratos-firmados", Private
// RLS: allow all operations for authenticated users with admin role
const BUCKET = 'contratos-firmados'

interface ArchivoContrato {
  name: string
  path: string
  size: number
  created_at: string
}

interface ContratoFirmadoProps {
  ventaid: number
}

const formatBytes = (b: number) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export const ContratoFirmado = ({ ventaid }: ContratoFirmadoProps) => {
  const [archivos, setArchivos] = useState<ArchivoContrato[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchArchivos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(`${ventaid}`, { sortBy: { column: 'created_at', order: 'desc' } })

      if (error) throw error
      type FileMeta = { size?: number; [k: string]: unknown }
      setArchivos(
        (data ?? [])
          .filter((f) => f.name !== '.emptyFolderPlaceholder')
          .map((f) => ({
            name: f.name,
            path: `${ventaid}/${f.name}`,
            size: ((f.metadata as FileMeta | null)?.size ?? 0) as number,
            created_at: f.created_at ?? '',
          }))
      )
    } catch {
      // bucket may not exist yet — show empty state
      setArchivos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchArchivos() }, [ventaid])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      alert('Formato no permitido. Sube PDF, JPG, PNG o WEBP.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('El archivo supera el límite de 20 MB.')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const safeName = `contrato-firmado-${timestamp}.${ext}`
      const path = `${ventaid}/${safeName}`

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })

      if (error) throw error
      await fetchArchivos()
    } catch (err: any) {
      alert(`Error al subir el archivo: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleView = async (archivo: ArchivoContrato) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(archivo.path, 300) // 5 min signed URL

    if (error || !data) {
      alert('No se pudo generar el enlace. Verifica los permisos del bucket.')
      return
    }

    const isPdf = archivo.name.toLowerCase().endsWith('.pdf')
    const isImg = /\.(jpe?g|png|webp)$/i.test(archivo.name)

    setPreviewUrl(data.signedUrl)
    setPreviewName(archivo.name)
    setPreviewType(isPdf ? 'pdf' : isImg ? 'image' : null)

    // For non-previewable types, open directly
    if (!isPdf && !isImg) {
      window.open(data.signedUrl, '_blank')
      setPreviewUrl(null)
    }
  }

  const handleDelete = async (archivo: ArchivoContrato) => {
    if (!confirm(`¿Eliminar "${archivo.name}"?`)) return
    setDeleting(archivo.path)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([archivo.path])
      if (error) throw error
      if (previewUrl && previewName === archivo.name) setPreviewUrl(null)
      await fetchArchivos()
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden mt-8 mb-8">
      {/* Header */}
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-[#504840]" />
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Contrato Firmado</h2>
            {archivos.length > 0 && (
              <p className="text-sm text-green-600 mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={13} />
                {archivos.length} archivo{archivos.length > 1 ? 's' : ''} cargado{archivos.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2"
          >
            {uploading ? (
              <><Loader2 size={15} className="animate-spin" /> Subiendo...</>
            ) : (
              <><Upload size={15} /> Subir Contrato Firmado</>
            )}
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="px-4 md:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : archivos.length === 0 ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg py-12 flex flex-col items-center gap-3 cursor-pointer hover:border-[#eaae4c] hover:bg-[#fdfaf3] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="text-gray-300" />
            <p className="text-sm text-gray-400">No hay contrato firmado. Haz clic para subir uno.</p>
            <p className="text-xs text-gray-300">PDF, JPG, PNG o WEBP · máx. 20 MB</p>
          </div>
        ) : (
          <div className="space-y-2">
            {archivos.map((archivo) => (
              <div
                key={archivo.path}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={20} className="text-[#504840] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{archivo.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(archivo.size)}
                      {archivo.created_at && (
                        <> · {new Date(archivo.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(archivo)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  >
                    <Eye size={15} />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(archivo)}
                    disabled={deleting === archivo.path}
                    className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                  >
                    {deleting === archivo.path
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{ width: '90vw', maxWidth: 960, height: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-gray-700 truncate">{previewName}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-[#504840] text-white rounded-md hover:bg-[#3d3630] transition-colors"
                >
                  Abrir en nueva pestaña
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none px-2"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="w-full" style={{ height: 'calc(100% - 53px)' }}>
              {previewType === 'pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={previewName}
                />
              ) : previewType === 'image' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900 overflow-auto p-4">
                  <img
                    src={previewUrl}
                    alt={previewName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
