import { AdminLayout } from '@/components/layout/AdminLayout'
import { useParams } from 'react-router-dom'

export const Mapa = () => {
  const { desarrolloId } = useParams()
  const mapPath = desarrolloId === '7'
    ? '/mapas/mirador-5b/index.html'
    : '/mapa-admin/index.html'

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
