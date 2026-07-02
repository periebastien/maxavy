import { Check } from 'lucide-react'

// Indicateur d'étapes réutilisable (repris du pattern de OnboardingPage, généralisé).
// steps = [{ id:number, label:string }], current = id de l'étape active.
// onStepClick(id) optionnel : rend cliquables les étapes déjà atteintes (id <= current).
export default function StepIndicator({ steps, current, onStepClick }) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, i) => {
        const done = step.id < current
        const active = step.id === current
        const clickable = onStepClick && step.id <= current && !active
        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick(step.id) : undefined}
              className={`flex flex-col items-center gap-1.5 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                ${done ? 'bg-accent text-white' : active ? 'bg-accent text-white ring-4 ring-accent/20' : 'bg-gray-100 text-text-tertiary'}`}>
                {done ? <Check size={16} strokeWidth={2.5} /> : step.id}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-accent' : done ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-5 ${step.id < current ? 'bg-accent' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
