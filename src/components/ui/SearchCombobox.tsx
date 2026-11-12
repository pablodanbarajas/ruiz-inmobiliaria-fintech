import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'

export interface ComboOption {
  value: string
  label: string
  sublabel?: string
}

/**
 * Splits text into comparable words: no accents or case ("ruisenor" finds
 * "RUISEÑOR"), punctuation as a separator, and numbers without leading zeros
 * ("lote 001" finds "Lote 1").
 */
const searchWords = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (/^\d+$/.test(word) ? String(Number(word)) : word))

/**
 * Short numbers must match whole ("5" finds manzana 5, not 15). Longer numbers,
 * such as part of a phone, and words match anywhere, as the search did before.
 */
const matchesWord = (part: string, word: string) =>
  /^\d{1,2}$/.test(word) ? part === word : part.includes(word)

const isNumber = (word: string) => /^\d+$/.test(word)

/** What follows a label such as "Mza": a number or a short code like "CC". */
const isLabelValue = (word: string) => isNumber(word) || word.length <= 3

/**
 * True when every typed word appears in the option. When the option has a
 * label followed by a value ("Mza 5", "Mza CC", "Lote 17"), a typed "mza 5"
 * must find that pair, so it doesn't also bring "Lote 5" of other manzanas.
 * Other words and numbers match on their own ("haci 5 17").
 */
const matchesSearch = (option: string[], words: string[]) => {
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const next = words[i + 1]
    if (!isNumber(word) && next !== undefined && isNumber(next)) {
      const labelsWithNumber = option
        .map((part, j) => ({ part, following: option[j + 1] }))
        .filter(({ part, following }) => matchesWord(part, word) && following !== undefined && isLabelValue(following))
      if (labelsWithNumber.length > 0) {
        if (!labelsWithNumber.some(({ following }) => matchesWord(following, next))) return false
        i++
        continue
      }
    }
    if (!option.some((part) => matchesWord(part, word))) return false
  }
  return true
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

  // Each typed word must appear somewhere in the option, in any order, so
  // "hacienda mza 5" finds "HACIENDA RUISEÑOR · Mza 5 Lote 1".
  const words = searchWords(inputText)
  const matches = words.length
    ? options.filter((o) => {
        return matchesSearch(searchWords(`${o.label} ${o.sublabel ?? ''}`), words)
      })
    : options
  const filtered = matches.slice(0, maxVisible)
  const totalMatches = matches.length

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
          className={`w-full rounded-full px-4 py-2 pr-16 border bg-white tracking-[-0.014em] focus:outline-none focus:ring-2 focus:ring-[#fffa56] disabled:bg-gray-100 disabled:cursor-not-allowed ${
            error ? 'border-red-400' : 'border-[#ebebeb]'
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
        <ul className="absolute z-50 mt-1 w-full bg-white border border-[#ebebeb] rounded-[14px] shadow-[var(--shadow-elevated)] max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">Sin resultados</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`flex items-start gap-2 px-4 py-2.5 cursor-pointer hover:bg-[#f2f4f5] transition-colors ${
                  opt.value === value ? 'bg-[#f2f4f5]' : ''
                }`}
              >
                <Check
                  size={14}
                  className={`mt-0.5 flex-shrink-0 ${
                    opt.value === value ? 'text-[#142127]' : 'text-transparent'
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
        <p className="text-xs text-[#16a34a] mt-1 truncate flex items-center gap-1">
          <Check size={11} />
          {selectedLabel}
        </p>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
