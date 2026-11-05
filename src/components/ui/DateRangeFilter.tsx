import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/utils/cn'

type DateRange = {
  from: string
  to: string
}

type DateRangeFilterProps = DateRange & {
  onApply: (range: DateRange) => void
}

type Preset = {
  label: string
  getRange: () => DateRange
}

const toInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfDay = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const subtractDays = (days: number) => {
  const date = startOfDay()
  date.setDate(date.getDate() - days)
  return date
}

const getMonthRange = (offset = 0): DateRange => {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: toInputDate(from), to: toInputDate(to) }
}

const presets: Preset[] = [
  { label: 'Hoy', getRange: () => ({ from: toInputDate(startOfDay()), to: toInputDate(startOfDay()) }) },
  { label: 'Ayer', getRange: () => ({ from: toInputDate(subtractDays(1)), to: toInputDate(subtractDays(1)) }) },
  { label: 'Últimos 7 días', getRange: () => ({ from: toInputDate(subtractDays(6)), to: toInputDate(startOfDay()) }) },
  { label: 'Últimos 30 días', getRange: () => ({ from: toInputDate(subtractDays(29)), to: toInputDate(startOfDay()) }) },
  { label: 'Este mes', getRange: () => getMonthRange() },
  { label: 'Mes anterior', getRange: () => getMonthRange(-1) },
]

const formatRange = (from: string, to: string) => {
  if (!from && !to) return 'Todas las fechas'
  if (from === to) return from.split('-').reverse().join('/')
  return `${from.split('-').reverse().join('/')} - ${to.split('-').reverse().join('/')}`
}

export const DateRangeFilter = ({ from, to, onApply }: DateRangeFilterProps) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>({ from, to })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft({ from, to })
  }, [from, to])

  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const apply = () => {
    if (draft.from && draft.to && draft.from > draft.to) {
      onApply({ from: draft.to, to: draft.from })
    } else {
      onApply(draft)
    }
    setOpen(false)
  }

  const clear = () => {
    const emptyRange = { from: '', to: '' }
    setDraft(emptyRange)
    onApply(emptyRange)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-black">Fecha de pago</label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border bg-white px-3 text-left text-sm transition-colors',
          open ? 'border-[#142127] ring-2 ring-[#fffa56]' : 'border-[#ebebeb] hover:border-[#c7d5d9]',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-2 truncate text-[#42484b]">
          <Calendar size={16} className="shrink-0 text-[#63696c]" />
          <span className="truncate">{formatRange(from, to)}</span>
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-[#63696c] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filtro de rango de fechas"
          className="absolute right-0 z-30 mt-2 flex w-[min(92vw,580px)] overflow-hidden rounded-[16px] border border-[#e0e5e7] bg-white shadow-[0_12px_35px_rgba(20,33,39,0.16)]"
        >
          <div className="hidden w-44 shrink-0 border-r border-[#ebebeb] bg-[#f8f9f9] p-2 sm:block">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#787574]">Periodos</p>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDraft(preset.getRange())}
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm text-[#42484b] hover:bg-[#e9edef]"
              >
                {preset.label}
                <ChevronRight size={14} className="text-[#a0a6a8]" />
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1 p-4">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="text-xs font-semibold text-[#63696c]">
                Desde
                <input
                  type="date"
                  value={draft.from}
                  onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                  className="mt-1 h-10 w-full rounded-[10px] border border-[#d9e0e2] bg-white px-3 text-sm text-[#131416] outline-none focus:border-[#142127] focus:ring-2 focus:ring-[#fffa56]"
                />
              </label>
              <span className="hidden pb-3 text-[#787574] sm:block">→</span>
              <label className="text-xs font-semibold text-[#63696c]">
                Hasta
                <input
                  type="date"
                  value={draft.to}
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                  className="mt-1 h-10 w-full rounded-[10px] border border-[#d9e0e2] bg-white px-3 text-sm text-[#131416] outline-none focus:border-[#142127] focus:ring-2 focus:ring-[#fffa56]"
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-[#ebebeb] pt-3">
              <button type="button" onClick={clear} className="flex items-center gap-1 text-sm text-[#63696c] hover:text-[#142127]">
                <X size={14} /> Limpiar
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] px-3 py-2 text-sm text-[#63696c] hover:bg-[#f2f4f5]">
                  Cancelar
                </button>
                <button type="button" onClick={apply} className="rounded-[9px] bg-[#142127] px-4 py-2 text-sm font-medium text-white hover:bg-[#263c44]">
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
