import { useState, useEffect, useRef } from 'react'

export default function LoginButton({ onLogin }) {
  const [isConnecting, setIsConnecting] = useState(false)
  const popupRef = useRef(null)
  const listenerRef = useRef(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        window.removeEventListener('message', listenerRef.current)
      }
    }
  }, [])

  const openLoginPopup = () => {
    if (isConnecting) return
    setIsConnecting(true)

    const width = 520
    const height = 640
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    const features = `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`

    popupRef.current = window.open('/api/auth/threads', 'threads_oauth', features)

    // Remove any previous listener
    if (listenerRef.current) {
      window.removeEventListener('message', listenerRef.current)
    }

    const handleMessage = (event) => {
      // Only trust messages from our own origin
      if (event.origin !== window.location.origin) return

      const { type, token, user } = event.data || {}
      if (type === 'oauth_success' && token) {
        window.removeEventListener('message', handleMessage)
        listenerRef.current = null

        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close()
        }

        onLogin(token, user || null)
        setIsConnecting(false)
      }

      if (type === 'oauth_error') {
        window.removeEventListener('message', handleMessage)
        listenerRef.current = null
        setIsConnecting(false)
      }
    }

    listenerRef.current = handleMessage
    window.addEventListener('message', handleMessage)

    // Poll for popup closure so we can reset state if user closes it manually
    const pollTimer = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(pollTimer)
        if (listenerRef.current) {
          window.removeEventListener('message', listenerRef.current)
          listenerRef.current = null
        }
        setIsConnecting(false)
      }
    }, 500)
  }

  return (
    <button
      className="btn btn-primary btn-lg"
      style={{ width: '100%' }}
      onClick={openLoginPopup}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <span className="spinner" />
          Connecting…
        </>
      ) : (
        <>
          <span>🧵</span>
          Connect with Threads
        </>
      )}
    </button>
  )
}
