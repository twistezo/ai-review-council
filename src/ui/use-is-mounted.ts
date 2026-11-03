import { useEffect, useRef } from 'react'

// An async check that finishes after its step was left must not act on the wizard.
export const useIsMounted = (): (() => boolean) => {
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  return () => isMounted.current
}
