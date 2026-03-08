import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard/Dashboard.jsx'
import LoginButton from './components/Auth/LoginButton.jsx'
import { getProfile } from './services/api.js'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('compose')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle OAuth callback — token arrives as query param
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('auth_token', token)
      // Remove token from URL without triggering a full reload
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      getProfile()
        .then((res) => {
          setUser(res.data)
          setIsLoggedIn(true)
        })
        .catch(() => {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = (token, userData) => {
    localStorage.setItem('auth_token', token)
    if (userData) localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
  }

  if (loading) {
    return (
      <div className="login-page">
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="logo">⚡</div>
          <h1>ThreadOptimizer</h1>
          <p>AI-powered Threads content for DC / AI infrastructure niches</p>
          <ul className="login-features">
            <li><span>🤖</span><span>Grok-powered content generation</span></li>
            <li><span>📅</span><span>Smart scheduling with optimal windows</span></li>
            <li><span>🧵</span><span>Thread templates &amp; poll automation</span></li>
            <li><span>📊</span><span>Engagement-optimised copywriting</span></li>
          </ul>
          <LoginButton onLogin={handleLogin} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Dashboard
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />
    </div>
  )
}
