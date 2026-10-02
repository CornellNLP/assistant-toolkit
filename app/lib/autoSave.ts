'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

// Saves `delay` ms after `value` stops changing, as long as `shouldSave` holds.
// Pass the in-flight save as part of `shouldSave` so edits made during a save
// get their own save once it finishes.
export function useAutoSave(
  value: unknown,
  shouldSave: boolean,
  save: () => Promise<unknown>,
  delay = 2500,
) {
  const ref = useRef(save)
  useLayoutEffect(() => { ref.current = save })
  useEffect(() => {
    if (!shouldSave) return
    const timer = setTimeout(() => { ref.current() }, delay)
    return () => clearTimeout(timer)
  }, [value, shouldSave, delay])
}
