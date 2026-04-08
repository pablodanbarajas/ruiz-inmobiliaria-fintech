import { AdminLayout } from '@/components/layout/AdminLayout'

export const Mapa = () => {
  return (
    <AdminLayout>
      <div className="flex flex-col -m-6" style={{ height: 'calc(100vh - 64px)' }}>
        <iframe
          src="/mapa-admin/index.html"
          title="Mapa Admin de Lotes"
          className="w-full flex-1 border-0"
          style={{ height: '100%', minHeight: '600px' }}
          allowFullScreen
        />
      </div>
    </AdminLayout>
  )
}
