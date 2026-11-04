import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export const ChartCard = ({ title, subtitle, children, action, className = '' }: ChartCardProps) => (
  <section className={`rounded-[20px] border border-[#ebebeb] bg-white p-5 shadow-[var(--shadow-soft)] ${className}`}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-[-0.014em] text-[#142127]">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-[#787574]">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
)
