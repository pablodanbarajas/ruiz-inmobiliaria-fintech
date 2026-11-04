import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl' | '2xl'
}

const sizeClass = {
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
}

export const Modal = ({ isOpen, title, onClose, children, size = 'md' }: ModalProps) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142127]/55 p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-[20px] border border-[#ebebeb] shadow-[var(--shadow-elevated)] ${sizeClass[size]} w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e0e5e7] sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-[#142127]" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#63696c] hover:bg-[#fffde1] hover:text-[#142127] rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
