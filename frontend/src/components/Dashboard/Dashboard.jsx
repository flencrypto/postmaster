import Header from '../Layout/Header.jsx'
import PostComposer from '../PostComposer/PostComposer.jsx'
import PostList from '../PostList/PostList.jsx'

export default function Dashboard({ user, activeTab, setActiveTab, onLogout }) {
  return (
    <>
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
      />
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {activeTab === 'compose' ? (
          <PostComposer />
        ) : (
          <PostList />
        )}
      </main>
    </>
  )
}
