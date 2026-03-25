import { Menu } from 'lucide-react'

interface HeaderProps {
  onMenuToggle?: () => void
}

export const Header = ({ onMenuToggle }: HeaderProps) => {
  return (
    <header className="fixed top-0 right-0 left-0 h-16 bg-[#f8f8f8] border-b border-[#504840] px-4 flex items-center justify-between lg:left-64 z-20">
      {/* Hamburger — only visible on mobile */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 bg-[#eaae4c] text-black rounded cursor-pointer flex-shrink-0"
        aria-label="Abrir menú"
      >
        <Menu size={24} />
      </button>
      <div className="flex-1" />
    </header>
  )
}
