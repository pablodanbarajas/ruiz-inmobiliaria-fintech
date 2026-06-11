import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Upload, Download, Trash2, CheckCircle, Circle, FileText, Loader2 } from 'lucide-react'

// Bucket name — create it in Supabase Dashboard > Storage before using this feature.
// Set it as private; RLS policy: allow ALL for (auth.jwt() ->> 'role') = 'admin'
const BUCKET = 'documentos-clientes'

const TIPOS_DOCUMENTO = [
  { key: 'ine-pasaporte',              label: 'INE o Pasaporte',                required: true  },
  { key: 'curp',                       label: 'CURP',                           required: true  },
  { key: 'acta-nacimiento',            label: 'Acta de Nacimiento',             required: true  },
  { key: 'comprobante-domicilio',      label: 'Comprobante de Domicilio',       required: true  },
  { key: 'acta-matrimonio',            label: 'Acta de Matrimonio',             required: false },
  { key: 'identificacion-beneficiario',label: 'Identificación del Beneficiario',required: false },
] as const

type TipoKey = typeof TIPOS_DOCUMENTO[number]['key']

interface StoredFile {
  name: string
  path: string
  size: number
  created_at: string
}

interface FilesByTipo {
  [tipo: string]: StoredFile[]
}

interface ClienteDocumentosProps {
  clienteid: number
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ClienteDocumentos = ({ clienteid }: ClienteDocumentosProps) => {
  const [filesByTipo, setFilesByTipo] = useState<FilesByTipo>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeUploadTipo, setActiveUploadTipo] = useState<TipoKey | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocumentos = async () => {
    setLoading(true)
    try {
      const result: FilesByTipo = {}
      await Promise.all(
        TIPOS_DOCUMENTO.map(async (tipo) => {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(`${clienteid}/${tipo.key}`, {
              sortBy: { column: 'created_at', order: 'asc' },
            })

          if (!error && data) {
            type FileMetadata = { size?: number; [key: string]: unknown }
            result[tipo.key] = data
              .filter((f) => f.name !== '.emptyFolderPlaceholder')
              .map((f) => ({
                name: f.name,
                path: `${clienteid}/${tipo.key}/${f.name}`,
                size: ((f.metadata as FileMetadata | null)?.size ?? 0) as number,
                created_at: f.created_at ?? '',
              }))
          } else {
            result[tipo.key] = []
          }
        })
      )
      setFilesByTipo(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocumentos()
  }, [clienteid])

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && activeUploadTipo) {
      uploadFile(activeUploadTipo, file)
    }
    e.target.value = ''
  }

  const uploadFile = async (tipo: TipoKey, file: File) => {
    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      alert('Formato no permitido. Sube PDF, JPG, PNG o WEBP.')
      return
    }
    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB.')
      return
    }

    setUploading(tipo)
    try {
      const ext = file.name.split('.').pop()
      const safeName = `${Date.now()}.${ext}`
      const path = `${clienteid}/${tipo}/${safeName}`

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })

      if (error) throw error
      await fetchDocumentos()
    } catch (err: any) {
      alert(`Error al subir el archivo: ${err.message}`)
    } finally {
      setUploading(null)
      setActiveUploadTipo(null)
    }
  }

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 120)

    if (error || !data) {
      alert('No se pudo generar el enlace. Verifica los permisos del bucket.')
      return
    }

    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = name
    a.target = '_blank'
    a.click()
  }

  const handleDelete = async (path: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    setDeleting(path)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) throw error
      await fetchDocumentos()
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const totalCount = TIPOS_DOCUMENTO.length
  const completedCount = TIPOS_DOCUMENTO.filter(
    (t) => (filesByTipo[t.key]?.length ?? 0) > 0
  ).length
  const requiredTotal = TIPOS_DOCUMENTO.filter((t) => t.required).length
  const requiredDone = TIPOS_DOCUMENTO.filter(
    (t) => t.required && (filesByTipo[t.key]?.length ?? 0) > 0
  ).length
  const pct = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expediente Documental</h2>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{completedCount}/{totalCount}</span> documentos cargados
            {' · '}
            <span className={requiredDone < requiredTotal ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
              {requiredDone}/{requiredTotal} requeridos
            </span>
          </p>
        </div>
        <div className="w-28 text-right">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#22c55e' : '#eaae4c',
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct}%</p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelected}
      />

      {loading ? (
        <div className="px-8 py-10 text-center text-gray-400">
          <Loader2 className="inline-block animate-spin mb-2" size={22} />
          <p className="text-sm">Cargando documentos...</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {TIPOS_DOCUMENTO.map((tipo) => {
            const files = filesByTipo[tipo.key] ?? []
            const hasFiles = files.length > 0
            const isUploading = uploading === tipo.key

            return (
              <li key={tipo.key} className="px-8 py-5 flex items-start gap-4">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {hasFiles ? (
                    <CheckCircle size={20} className="text-green-500" />
                  ) : (
                    <Circle
                      size={20}
                      className={tipo.required ? 'text-red-300' : 'text-gray-300'}
                    />
                  )}
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-gray-800">{tipo.label}</span>
                    {tipo.required && (
                      <span className="text-xs font-medium text-red-500">requerido</span>
                    )}
                  </div>

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="space-y-1">
                      {files.map((f) => (
                        <div
                          key={f.path}
                          className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-1.5"
                        >
                          <FileText size={13} className="flex-shrink-0 text-gray-400" />
                          <span className="truncate flex-1 text-xs">{f.name}</span>
                          {f.size > 0 && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatBytes(f.size)}
                            </span>
                          )}
                          <button
                            title="Ver / Descargar"
                            onClick={() => handleDownload(f.path, f.name)}
                            className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            title="Eliminar"
                            disabled={deleting === f.path}
                            onClick={() => handleDelete(f.path, f.name)}
                            className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                          >
                            {deleting === f.path ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => {
                    setActiveUploadTipo(tipo.key as TipoKey)
                    fileInputRef.current?.click()
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      {hasFiles ? 'Agregar' : 'Subir'}
                    </>
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
