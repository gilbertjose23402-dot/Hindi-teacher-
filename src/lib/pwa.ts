import { useSyncExternalStore } from 'react'

/**
 * App updates never reload the page by themselves (that used to restart
 * conversations). When a new version is downloaded, Home offers "Update";
 * otherwise it applies the next time the app is fully closed and reopened.
 */
let applyUpdate: (() => void) | null = null
const listeners = new Set<() => void>()

export function markUpdateReady(apply: () => void): void {
  applyUpdate = apply
  listeners.forEach((l) => l())
}

export function useUpdateReady(): (() => void) | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => applyUpdate,
  )
}
