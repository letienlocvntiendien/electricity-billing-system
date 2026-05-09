import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const toastVariants = cva(
  [
    'group relative flex items-start gap-3 w-full max-w-sm rounded-lg border border-l-4 bg-card p-4',
    'shadow-lg shadow-black/40',
    'data-[state=open]:animate-toast-in',
    'data-[state=closed]:animate-toast-out',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform duration-200',
    'data-[swipe=end]:animate-toast-out',
  ],
  {
    variants: {
      variant: {
        success: 'border-l-emerald-500 border-border',
        error:   'border-l-destructive  border-border',
        warning: 'border-l-amber-400    border-border',
        info:    'border-l-blue-400     border-border',
      },
    },
    defaultVariants: { variant: 'info' },
  }
)

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

const iconMap: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2  className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />,
  error:   <AlertCircle   className="h-4 w-4 text-destructive  flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400    flex-shrink-0 mt-0.5" />,
  info:    <Info          className="h-4 w-4 text-blue-400     flex-shrink-0 mt-0.5" />,
}

interface ToastProps extends VariantProps<typeof toastVariants> {
  item: ToastItem
  onOpenChange: (open: boolean) => void
}

export function Toast({ item, onOpenChange }: ToastProps) {
  return (
    <ToastPrimitive.Root
      open
      duration={item.duration ?? 4000}
      onOpenChange={onOpenChange}
      className={cn(toastVariants({ variant: item.variant }))}
    >
      <ToastPrimitive.Title className="sr-only">{item.variant}</ToastPrimitive.Title>
      {iconMap[item.variant]}
      <ToastPrimitive.Description className="flex-1 text-sm leading-snug text-foreground">
        {item.message}
      </ToastPrimitive.Description>
      <ToastPrimitive.Close
        className="flex-shrink-0 rounded-sm p-0.5 opacity-50 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
        aria-label="Đóng"
      >
        <X className="h-3.5 w-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}

interface ToasterProps {
  toasts: ToastItem[]
  onOpenChange: (id: string, open: boolean) => void
}

export function Toaster({ toasts, onOpenChange }: ToasterProps) {
  return (
    <>
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onOpenChange={(open) => onOpenChange(item.id, open)} />
      ))}
      <ToastPrimitive.Viewport
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 w-[360px] max-w-[calc(100vw-2rem)] outline-none"
      />
    </>
  )
}
