import { Sidebar } from './Sidebar'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
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
