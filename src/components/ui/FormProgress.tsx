import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export type FormProgressStep = {
  label: string
  description?: string
}

interface FormProgressProps {
  steps: FormProgressStep[]
  currentStep: number
  onStepChange?: (step: number) => void
}

export const FormProgress = ({ steps, currentStep, onStepChange }: FormProgressProps) => (
  <nav aria-label="Progreso del formulario" className="mb-7 rounded-[16px] border border-[#e0e5e7] bg-[#f8f9f9] p-4">
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
      {steps.map((step, index) => {
        const completed = index < currentStep
        const active = index === currentStep
        const canNavigate = !!onStepChange && index <= currentStep

        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-start sm:relative sm:flex-col sm:items-center sm:text-center">
            {index > 0 && (
              <span
                className={cn(
                  'hidden sm:absolute sm:left-0 sm:right-1/2 sm:top-4 sm:block sm:h-px',
                  completed ? 'bg-[#142127]' : 'bg-[#d9e0e2]',
                )}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              disabled={!canNavigate}
              onClick={() => onStepChange?.(index)}
              className={cn(
                'relative z-10 flex items-center gap-3 text-left sm:flex-col sm:gap-2 sm:text-center',
                canNavigate ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  active && 'border-[#142127] bg-[#142127] text-white',
                  completed && 'border-[#142127] bg-[#142127] text-white',
                  !active && !completed && 'border-[#c7d5d9] bg-white text-[#787574]',
                )}
              >
                {completed ? <Check size={14} /> : index + 1}
              </span>
              <span>
                <span className={cn('block text-sm font-semibold', active || completed ? 'text-[#142127]' : 'text-[#787574]')}>
                  {step.label}
                </span>
                {step.description && <span className="mt-0.5 block text-xs text-[#787574]">{step.description}</span>}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'ml-4 mt-4 h-5 w-px sm:hidden',
                  completed ? 'bg-[#142127]' : 'bg-[#d9e0e2]',
                )}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  </nav>
)
