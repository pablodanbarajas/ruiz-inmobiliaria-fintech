import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'

export interface ComboOption {
  value: string
  label: string
  sublabel?: string
}

interface SearchComboboxProps {
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  maxVisible?: number
}

export const SearchCombobox = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  disabled = false,
  error,
  maxVisible = 80,
}: SearchComboboxProps) => {
  const [inputText, setInputText] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync display text when value changes externally (e.g. edit mode pre-fill)
  useEffect(() => {
    if (value) {
      const found = options.find((o) => o.value === value)
      if (found) setInputText(found.label)
    } else {
      setInputText('')
    }
  }, [value, options])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (value) {
          const found = options.find((o) => o.value === value)
          setInputText(found?.label ?? '')
        } else {
          setInputText('')
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value, options])

  const filtered = options
    .filter((o) => {
      if (!inputText) return true
      const s = inputText.toLowerCase()
      return o.label.toLowerCase().includes(s) || o.sublabel?.toLowerCase().includes(s)
    })
    .slice(0, maxVisible)

  const totalMatches = options.filter((o) => {
    if (!inputText) return true
    const s = inputText.toLowerCase()
    return o.label.toLowerCase().includes(s) || o.sublabel?.toLowerCase().includes(s)
  }).length

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''

  const handleSelect = (opt: ComboOption) => {
    onChange(opt.value)
    setInputText(opt.label)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setInputText('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputText}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setInputText(e.target.value)
            setOpen(true)
            if (!e.target.value) onChange('')
          }}
          className={`w-full px-3 py-2 pr-16 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] disabled:bg-gray-100 disabled:cursor-not-allowed ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-700 p-0.5"
            >
              <X size={14} />
            </button>
          )}
          <ChevronsUpDown size={15} className="text-gray-400 pointer-events-none" />
        </div>
      </div>

      {open && !disabled && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">Sin resultados</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`flex items-start gap-2 px-4 py-2.5 cursor-pointer hover:bg-[#fdf6e3] transition-colors ${
                  opt.value === value ? 'bg-[#fdf6e3]' : ''
                }`}
              >
                <Check
                  size={14}
                  className={`mt-0.5 flex-shrink-0 ${
                    opt.value === value ? 'text-[#eaae4c]' : 'text-transparent'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{opt.label}</p>
                  {opt.sublabel && (
                    <p className="text-xs text-gray-500 truncate">{opt.sublabel}</p>
                  )}
                </div>
              </li>
            ))
          )}
          {totalMatches > maxVisible && (
            <li className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              Sigue escribiendo para ver más resultados…
            </li>
          )}
        </ul>
      )}

      {value && selectedLabel && inputText !== selectedLabel && !open && (
        <p className="text-xs text-[#eaae4c] mt-1 truncate flex items-center gap-1">
          <Check size={11} />
          {selectedLabel}
        </p>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
