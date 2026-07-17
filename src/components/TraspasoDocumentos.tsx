import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Upload, FileText, Trash2, Eye, Loader2, X, Image } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Reuses the existing 'contratos-firmados' bucket.
// Documents are stored under: traspasos/{traspasoid}/filename
const BUCKET = 'contratos-firmados'

interface Archivo {
  name: string
  path: string
  size: number
  created_at: string
}

interface TraspasoDocumentosProps {
  traspasoid: number
}

const formatBytes = (b: number) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const isImage = (name: string) => /\.(jpg|jpeg|png|webp)$/i.test(name)

export const TraspasoDocumentos = ({ traspasoid }: TraspasoDocumentosProps) => {
  const folder = `traspasos/${traspasoid}`
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewIsImage, setPreviewIsImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchArchivos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })
      if (error) throw error
      type FileMeta = { size?: number; [k: string]: unknown }
      setArchivos(
        (data ?? [])
          .filter((f) => f.name !== '.emptyFolderPlaceholder')
          .map((f) => ({
            name: f.name,
            path: `${folder}/${f.name}`,
            size: ((f.metadata as FileMeta | null)?.size ?? 0) as number,
            created_at: f.created_at ?? '',
          }))
      )
    } catch {
      setArchivos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchArchivos() }, [traspasoid])

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
      const safeName = `doc-traspaso-${timestamp}.${ext}`
      const path = `${folder}/${safeName}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (error) throw error
      await fetchArchivos()
    } catch (err: any) {
      alert(`Error al subir el archivo: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handlePreview = async (archivo: Archivo) => {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(archivo.path, 300)
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl)
      setPreviewName(archivo.name)
      setPreviewIsImage(isImage(archivo.name))
    }
  }

  const handleDelete = async (archivo: Archivo) => {
    if (!confirm(`¿Eliminar "${archivo.name}"?`)) return
    setDeleting(archivo.path)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([archivo.path])
      if (error) throw error
      await fetchArchivos()
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Upload size={14} className="mr-1.5" />
          )}
          {uploading ? 'Subiendo…' : 'Subir documento'}
        </Button>
        <span className="text-xs text-gray-400">PDF, JPG, PNG o WEBP · máx. 20 MB</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* File list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          Cargando documentos…
        </div>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-2">
          Sin documentos. Sube los documentos sellados del traspaso.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {archivos.map((archivo) => (
            <li
              key={archivo.path}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isImage(archivo.name) ? (
                  <Image size={16} className="text-blue-400 shrink-0" />
                ) : (
                  <FileText size={16} className="text-red-400 shrink-0" />
                )}
                <span className="text-sm text-gray-700 truncate">{archivo.name}</span>
                {archivo.size > 0 && (
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(archivo.size)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handlePreview(archivo)}
                  className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors"
                  title="Ver documento"
                >
                  <Eye size={15} />
                </button>
                <button
                  onClick={() => handleDelete(archivo)}
                  disabled={deleting === archivo.path}
                  className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50"
                  title="Eliminar"
                >
                  {deleting === archivo.path ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 truncate">{previewName}</span>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-gray-400 hover:text-gray-600 ml-3"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {previewIsImage ? (
                <img src={previewUrl} alt={previewName} className="max-w-full h-auto mx-auto rounded" />
              ) : (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded" title={previewName} />
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Abrir en nueva pestaña
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
