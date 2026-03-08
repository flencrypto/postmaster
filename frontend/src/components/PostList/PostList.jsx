import { useState, useEffect, useCallback } from 'react'
import { listPosts, approvePost, publishNow } from '../../services/api.js'
import './PostList.css'

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'badge-draft' },
  scheduled: { label: 'Scheduled', className: 'badge-scheduled' },
  published: { label: 'Published', className: 'badge-published' },
  failed:    { label: 'Failed',    className: 'badge-failed' },
}

function truncate(text, max = 150) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function PostList() {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [actionStates, setActionStates] = useState({}) // { [id]: 'approving' | 'publishing' }

  const fetchPosts = useCallback(async (pageNum, append = false) => {
    try {
      const res = await listPosts(pageNum, 10)
      const data = res.data
      const newPosts = Array.isArray(data) ? data : (data.posts || data.data || [])
      const total = data.total ?? data.count ?? null

      setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts))

      if (total !== null) {
        setHasMore(pageNum * 10 < total)
      } else {
        setHasMore(newPosts.length === 10)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load posts.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPosts(1, false).finally(() => setLoading(false))
  }, [fetchPosts])

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    await fetchPosts(nextPage, true)
    setPage(nextPage)
    setLoadingMore(false)
  }

  const setAction = (id, state) =>
    setActionStates((prev) => ({ ...prev, [id]: state }))

  const handleApprove = async (id) => {
    setAction(id, 'approving')
    try {
      const res = await approvePost(id)
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...res.data } : p)))
    } catch (err) {
      setError(err.response?.data?.message || 'Approve failed.')
    } finally {
      setAction(id, null)
    }
  }

  const handlePublish = async (id) => {
    setAction(id, 'publishing')
    try {
      const res = await publishNow(id)
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...res.data } : p)))
    } catch (err) {
      setError(err.response?.data?.message || 'Publish failed.')
    } finally {
      setAction(id, null)
    }
  }

  return (
    <div className="post-list">
      <div className="post-list-header">
        <h2>📋 Posts</h2>
        <p className="post-list-subtitle">Your scheduled, draft, and published content</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="post-list-empty">
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <p>Loading posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="post-list-empty">
          <span className="empty-icon">✨</span>
          <p>No posts yet. Start by composing your first post! ✨</p>
        </div>
      ) : (
        <>
          <div className="post-items">
            {posts.map((post) => {
              const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft
              const isActing = actionStates[post.id]

              return (
                <div key={post.id} className="post-item card">
                  <div className="post-item-top">
                    <span className={`badge ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    {post.imageUrls && post.imageUrls.length > 0 && (
                      <span className="post-image-badge">
                        🖼️ {post.imageUrls.length}
                      </span>
                    )}
                    {post.videoEnabled && post.videoUrl && (
                      <span className="post-video-badge">🎬 Video</span>
                    )}
                    <span className="post-item-time">
                      {post.status === 'published'
                        ? `Published ${formatDate(post.publishedAt)}`
                        : post.scheduledAt
                        ? `Scheduled ${formatDate(post.scheduledAt)}`
                        : 'Unscheduled'}
                    </span>
                  </div>

                  <p className="post-item-text">
                    {truncate(post.postText || '')}
                  </p>

                  <div className="post-item-actions">
                    {(post.status === 'draft') && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!!isActing}
                        onClick={() => handleApprove(post.id)}
                      >
                        {isActing === 'approving' ? (
                          <><span className="spinner" />Approving…</>
                        ) : (
                          '✅ Approve'
                        )}
                      </button>
                    )}
                    {(post.status === 'draft' || post.status === 'scheduled') && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!!isActing}
                        onClick={() => handlePublish(post.id)}
                      >
                        {isActing === 'publishing' ? (
                          <><span className="spinner" />Publishing…</>
                        ) : (
                          '🚀 Publish Now'
                        )}
                      </button>
                    )}
                    {post.status === 'failed' && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!!isActing}
                        onClick={() => handlePublish(post.id)}
                      >
                        {isActing === 'publishing' ? (
                          <><span className="spinner" />Retrying…</>
                        ) : (
                          '🔄 Retry'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="post-list-footer">
              <button
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <><span className="spinner" />Loading…</>
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
