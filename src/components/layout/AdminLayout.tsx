import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  // Refresh the session silently on every admin page mount so the JWT
  // always has a fresh role claim — avoids RLS WITH CHECK failures.
  useEffect(() => {
    supabase.auth.refreshSession().catch(() => {})
  }, [])

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 lg:ml-64">
        <main className="flex-1 bg-[#f8f8f8] p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
