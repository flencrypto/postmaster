import { useState, useCallback } from 'react'
import { generateContent, createAndSchedulePost } from '../../services/api.js'
import './PostComposer.css'

const TEMPLATE_OPTIONS = [
  { value: 'basic_insight', label: '📊 Daily Insight / Hot Take' },
  { value: 'question_poll', label: '❓ Question / Poll (High Reply Driver)' },
  { value: 'short_thread', label: '🧵 Short Thread (4-8 Posts)' },
  { value: 'shoutout', label: '🙌 Community Shoutout' },
  { value: 'personal', label: '👤 Behind-the-Scenes / Personal' },
  { value: 'sarcastic_hot_take', label: '🔥 Sarcastic Hot Take' },
  { value: 'sarcastic_question', label: '😈 Sarcastic Question / Poll' },
  { value: 'sarcastic_thread', label: '💀 Sarcastic Roast Thread' },
  { value: 'sarcastic_shoutout', label: '🙄 Backhanded Sarcastic Shoutout' },
  { value: 'sarcastic_personal', label: '😤 Sarcastic Insider Rant' },
]

const STYLE_OPTIONS = [
  { value: 'professional', label: 'Professional B2B' },
  { value: 'conversational', label: 'Conversational Tech-Expert' },
  { value: 'hot_take', label: 'Hot-Take Edgy' },
  { value: 'technical', label: 'Technical Deep-Dive' },
  { value: 'optimistic', label: 'Optimistic Green-Tech' },
]

const IMAGE_STYLE_OPTIONS = [
  { value: 'realistic_renders', label: 'Realistic Renders' },
  { value: 'infographics', label: 'Infographics / Charts' },
  { value: 'site_photos', label: 'Site Photos' },
  { value: 'mixed', label: 'Mixed' },
]

const DEFAULT_FORM = {
  subject: '',
  grokTaskTime: '',
  templateType: 'basic_insight',
  style: 'professional',
  maxPosts: 5,
  postWindow: 'morning',
  extendedThreads: false,
  autoPollChance: 30,
  hashtagPool: '',
  imageStyle: 'realistic_renders',
}

export default function PostComposer() {
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [preview, setPreview] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleGenerate = async () => {
    if (!formData.subject.trim()) {
      setError('Please enter a subject / topic before generating.')
      return
    }
    setError('')
    setPreview(null)
    setIsGenerating(true)
    try {
      const res = await generateContent({
        subject: formData.subject,
        style: formData.style,
        templateType: formData.templateType,
      })
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate content. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSchedule = async () => {
    if (!formData.subject.trim()) {
      setError('Please enter a subject / topic.')
      return
    }
    setError('')
    setSuccess('')
    setIsScheduling(true)
    try {
      const payload = {
        ...formData,
        generatedContent: preview || null,
      }
      const res = await createAndSchedulePost(payload)
      const scheduledAt = res.data?.scheduled_at
        ? new Date(res.data.scheduled_at).toLocaleString()
        : 'the next available window'
      setSuccess(`Post scheduled for ${scheduledAt}!`)
      setPreview(null)
      setFormData(DEFAULT_FORM)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule post. Please try again.')
    } finally {
      setIsScheduling(false)
    }
  }

  const isThreadTemplate = formData.templateType.includes('thread')

  return (
    <div className="composer">
      <div className="composer-header">
        <h2>✏️ Compose Post</h2>
        <p className="composer-subtitle">Configure your content and let Grok do the heavy lifting</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="form-grid">
        {/* ---- Subject ---- */}
        <div className="form-group form-group--full">
          <label className="form-label">Subject / Topic *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Latest trends in liquid cooling for AI data centers 2026"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
          />
        </div>

        {/* ---- Template Type ---- */}
        <div className="form-group">
          <label className="form-label">Template Type</label>
          <select
            className="form-select"
            value={formData.templateType}
            onChange={(e) => handleChange('templateType', e.target.value)}
          >
            {TEMPLATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ---- Style / Tone ---- */}
        <div className="form-group">
          <label className="form-label">Style / Tone</label>
          <select
            className="form-select"
            value={formData.style}
            onChange={(e) => handleChange('style', e.target.value)}
          >
            {STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ---- Grok Task Time ---- */}
        <div className="form-group">
          <label className="form-label">Grok Task Time</label>
          <input
            type="datetime-local"
            className="form-input"
            value={formData.grokTaskTime}
            onChange={(e) => handleChange('grokTaskTime', e.target.value)}
          />
        </div>

        {/* ---- Image Style ---- */}
        <div className="form-group">
          <label className="form-label">Image Style</label>
          <select
            className="form-select"
            value={formData.imageStyle}
            onChange={(e) => handleChange('imageStyle', e.target.value)}
          >
            {IMAGE_STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ---- Max Posts slider ---- */}
        <div className="form-group form-group--full">
          <label className="form-label">
            MAX Posts per 24h
            <span className="slider-value">{formData.maxPosts}</span>
            {formData.maxPosts > 7 && (
              <span className="warning-badge">⚠️ High frequency</span>
            )}
          </label>
          <div className="slider-container">
            <span className="slider-min">1</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={formData.maxPosts}
              onChange={(e) => handleChange('maxPosts', Number(e.target.value))}
              className="slider"
            />
            <span className="slider-max">10</span>
          </div>
        </div>

        {/* ---- Post Window ---- */}
        <div className="form-group form-group--full">
          <label className="form-label">Post Window</label>
          <div className="radio-group">
            {[
              { value: 'morning', label: '🌅 Morning (8–11 AM GMT)' },
              { value: 'afternoon', label: '🌆 Afternoon (4–7 PM GMT)' },
              { value: 'now', label: '⚡ Post Now' },
            ].map((opt) => (
              <label key={opt.value} className="radio-label">
                <input
                  type="radio"
                  name="postWindow"
                  value={opt.value}
                  checked={formData.postWindow === opt.value}
                  onChange={() => handleChange('postWindow', opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* ---- Auto-Poll chance ---- */}
        <div className="form-group form-group--full">
          <label className="form-label">
            Auto-Poll Chance
            <span className="slider-value">{formData.autoPollChance}%</span>
          </label>
          <div className="slider-container">
            <span className="slider-min">0%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={formData.autoPollChance}
              onChange={(e) => handleChange('autoPollChance', Number(e.target.value))}
              className="slider"
            />
            <span className="slider-max">100%</span>
          </div>
        </div>

        {/* ---- Hashtag Pool ---- */}
        <div className="form-group form-group--full">
          <label className="form-label">Hashtag Pool (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            placeholder="#DataCentres, #AIInfra, #Hyperscale"
            value={formData.hashtagPool}
            onChange={(e) => handleChange('hashtagPool', e.target.value)}
          />
        </div>

        {/* ---- Extended Threads checkbox ---- */}
        <div className="form-group form-group--full">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.extendedThreads}
              onChange={(e) => handleChange('extendedThreads', e.target.checked)}
            />
            <span className="checkbox-custom" />
            Enable follow-up thread posts (4–12h apart)
          </label>
        </div>
      </div>

      {/* ---- Generate Preview ---- */}
      <div className="preview-section">
        <button
          className="btn generate-btn btn-lg"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><span className="spinner" />Generating…</>
          ) : (
            <>✨ Generate Preview</>
          )}
        </button>

        {preview && (
          <div className="preview-card card">
            <div className="preview-header">
              <span className="preview-title">Generated Content</span>
              {preview.thread_potential && (
                <span className="badge badge-scheduled">🧵 Thread Potential</span>
              )}
            </div>

            <blockquote className="preview-text">
              {preview.text || preview.content || 'No text returned.'}
            </blockquote>

            {isThreadTemplate && preview.thread_posts && preview.thread_posts.length > 0 && (
              <div className="thread-posts-list">
                <p className="thread-posts-label">Thread Posts:</p>
                {preview.thread_posts.map((post, i) => (
                  <div key={i} className="thread-post-item">
                    <span className="thread-post-num">{i + 1}</span>
                    <span>{post}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.image_suggestions && preview.image_suggestions.length > 0 && (
              <div className="preview-meta">
                <p className="preview-meta-label">🖼️ Image Suggestions:</p>
                <ul className="preview-list">
                  {preview.image_suggestions.map((img, i) => (
                    <li key={i}>{img}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.poll_options && preview.poll_options.length > 0 && (
              <div className="preview-meta">
                <p className="preview-meta-label">📊 Poll Options:</p>
                <ul className="preview-list preview-list--poll">
                  {preview.poll_options.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.followup_ideas && preview.followup_ideas.length > 0 && (
              <div className="preview-meta">
                <p className="preview-meta-label">💡 Follow-up Ideas:</p>
                <ul className="preview-list">
                  {preview.followup_ideas.map((idea, i) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Schedule button ---- */}
      <div className="composer-actions">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSchedule}
          disabled={isScheduling}
        >
          {isScheduling ? (
            <><span className="spinner" />Scheduling…</>
          ) : (
            <>📅 Schedule Post</>
          )}
        </button>
      </div>
    </div>
  )
}
