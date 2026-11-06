import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PanteonesZonas } from '@/components/PanteonesZonas'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'react-router-dom'

type DesarrolloMapa = {
  nombre: string | null
  tipodesarrollo: { descripcion: string | null } | null
}

export const Mapa = () => {
  const { desarrolloId } = useParams()
  const [panteonesNombre, setPanteonesNombre] = useState<string | null>(null)
  const [checkingType, setCheckingType] = useState(Boolean(desarrolloId))
  const mapPath = desarrolloId === '7'
    ? '/mapas/mirador-5b/index.html'
    : '/mapa-admin/index.html'

  useEffect(() => {
    if (!desarrolloId) return
    let ignore = false

    const checkDevelopmentType = async () => {
      const { data, error } = await supabase
        .from('desarrollo')
        .select('nombre, tipodesarrollo:tipodesarrollo(descripcion)')
        .eq('desarrolloid', Number(desarrolloId))
        .maybeSingle()
      if (ignore) return
      if (error) console.error('Error fetching development type:', error)
      const desarrollo = data as unknown as DesarrolloMapa | null
      const isPanteones = desarrollo?.tipodesarrollo?.descripcion?.toLowerCase().includes('panteon')
      setPanteonesNombre(isPanteones ? desarrollo?.nombre || 'Panteones' : null)
      setCheckingType(false)
    }

    checkDevelopmentType()
    return () => { ignore = true }
  }, [desarrolloId])

  if (checkingType) {
    return <AdminLayout><p className="p-6 text-sm text-gray-500">Cargando mapa…</p></AdminLayout>
  }

  if (panteonesNombre) {
    return (
      <AdminLayout>
        <PanteonesZonas desarrolloId={Number(desarrolloId)} nombre={panteonesNombre} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex flex-col -m-6" style={{ height: 'calc(100vh - 64px)' }}>
        <iframe
          src={mapPath}
          title="Mapa Admin de Lotes"
          className="w-full flex-1 border-0"
          style={{ height: '100%', minHeight: '600px' }}
          allowFullScreen
        />
      </div>
    </AdminLayout>
  )
}
