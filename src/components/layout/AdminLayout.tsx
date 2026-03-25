import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { supabase } from '@/lib/supabaseClient'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Refresh the session silently on every admin page mount so the JWT
  // always has a fresh role claim — avoids RLS WITH CHECK failures.
  useEffect(() => {
    supabase.auth.refreshSession().catch(() => {})
  }, [])

  return (
    <div className="flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-w-0">
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 bg-[#f8f8f8] p-4 lg:p-6 pt-20 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  )
}
