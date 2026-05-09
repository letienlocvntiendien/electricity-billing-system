import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { Toaster } from '@/components/ui/toast'
import type { ToastItem, ToastVariant } from '@/components/ui/toast'

interface ToastContextValue {
  success: (message: string, duration?: number) => void
  error:   (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info:    (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((variant: ToastVariant, message: string, duration?: number) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant, duration }])
  }, [])

  const dismiss = useCallback((id: string, open: boolean) => {
    if (!open) {
      // Wait for exit animation (220ms) before removing DOM node
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
    }
  }, [])

  const value = useMemo(() => ({
    success: (m: string, d?: number) => add('success', m, d),
    error:   (m: string, d?: number) => add('error',   m, d),
    warning: (m: string, d?: number) => add('warning', m, d),
    info:    (m: string, d?: number) => add('info',    m, d),
  }), [add])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <Toaster toasts={toasts} onOpenChange={dismiss} />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
