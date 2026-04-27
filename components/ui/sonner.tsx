"use client"

import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Por encima de diálogos (z-50) y del valor por defecto de Sonner en CSS. */
const TOAST_Z_INDEX = 999_999_999

function SonnerToaster({ style: styleProp, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          ...styleProp,
          zIndex: TOAST_Z_INDEX,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

const subscribeToNothing = () => () => {}

/**
 * Monta los toasts en `document.body` para que `position: fixed` y el z-index
 * no queden atrapados por ancestros con transform/stacking (p. ej. layout flex).
 */
const Toaster = (props: ToasterProps) => {
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
  if (!isClient) {
    return null
  }
  return createPortal(<SonnerToaster {...props} />, document.body)
}

export { Toaster }
