import { CheckCircle2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function ToastHost() {
  const { toast } = useApp()
  if (!toast) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <div className="tb-fade-up pointer-events-auto flex items-center gap-2 rounded-full bg-tb-ink px-4 py-2.5 text-sm font-semibold text-white shadow-tb-float">
        <CheckCircle2 size={16} className="text-tb-teal-400" />
        {toast}
      </div>
    </div>
  )
}
