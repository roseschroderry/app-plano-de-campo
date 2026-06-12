import { useState, useCallback } from 'react'

export function useToast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  let timer

  const toast = useCallback((m) => {
    clearTimeout(timer)
    setMsg(m)
    setVisible(true)
    timer = setTimeout(() => setVisible(false), 2600)
  }, [])

  const Toast = () => (
    <div className={`toast ${visible ? 'show' : ''}`}>{msg}</div>
  )

  return { toast, Toast }
}
