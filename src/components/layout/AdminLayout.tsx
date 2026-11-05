import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { supabase } from '@/lib/supabaseClient'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      try {
        localStorage.setItem('admin-sidebar-collapsed', String(next))
      } catch {
        // Sidebar preference is optional and should not block navigation.
      }
      return next
    })
  }

  // Refresh the session silently on every admin page mount so the JWT
  // always has a fresh role claim — avoids RLS WITH CHECK failures.
  useEffect(() => {
    supabase.auth.refreshSession().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#f2f4f5]">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleSidebar}
      />
      <div className={`flex min-h-screen flex-col ml-0 min-w-0 transition-[margin] duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 bg-[#f2f4f5] p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}
