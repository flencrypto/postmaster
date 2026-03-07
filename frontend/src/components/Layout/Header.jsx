import './Header.css'

export default function Header({ user, activeTab, setActiveTab, onLogout }) {
  const avatarFallback = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="header">
      <div className="header-inner">
        {/* Brand */}
        <div className="header-brand">
          <span className="header-logo">⚡</span>
          <span className="header-title">ThreadOptimizer</span>
        </div>

        {/* Navigation tabs */}
        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'compose' ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab('compose')}
          >
            ✏️ Compose
          </button>
          <button
            className={`nav-tab ${activeTab === 'posts' ? 'nav-tab--active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            📋 Posts
          </button>
        </nav>

        {/* User area */}
        <div className="header-user">
          {user?.profilePic ? (
            <img
              className="user-avatar"
              src={user.profilePic}
              alt={user.username || 'Avatar'}
            />
          ) : (
            <div className="user-avatar user-avatar--fallback">
              {avatarFallback}
            </div>
          )}
          {user?.username && (
            <span className="user-name">@{user.username}</span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
