import { useState } from 'react'
import './SwinlearnPage.css'

function SwinlearnPage() {
  const [showHistory, setShowHistory] = useState(true)
  const [showFiles, setShowFiles] = useState(true)

  return (
    <section className="workspace-page swinlearn-workspace">
      <header className="workspace-page-header">
        <span className="workspace-eyebrow">Workspace chatbot</span>
        <h1 className="workspace-page-title">SWINLEARN</h1>
        <p className="workspace-page-subtitle">
          Ask for study help, course summaries, deadline planning, and revision
          guidance from the workspace assistant.
        </p>
      </header>

      <div className="swinlearn-layout">
        {showHistory && (
          <aside className="chat-sidebar history-sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">
                <span>History</span>
              </div>
              <button
                className="icon-btn panel-btn"
                type="button"
                onClick={() => setShowHistory(false)}
                aria-label="Hide history"
              >
                &lt;
              </button>
            </div>
            <div className="sidebar-content empty-state">
              <p>Your past prompts will appear here.</p>
            </div>
          </aside>
        )}

        <section className="chat-main" aria-label="SWINLEARN chat">
          <header className="chat-header">
            <div className="chat-header-left">
              {!showHistory && (
                <button
                  className="icon-btn panel-btn"
                  type="button"
                  onClick={() => setShowHistory(true)}
                  aria-label="Show history"
                >
                  &gt;
                </button>
              )}
              <div className="swin-badge">SWINLEARN</div>
              <span className="subtitle">AI study tutor</span>
            </div>
            <div className="chat-header-right">
              <button className="clear-btn" type="button">
                Clear
              </button>
              {!showFiles && (
                <button
                  className="icon-btn panel-btn"
                  type="button"
                  onClick={() => setShowFiles(true)}
                  aria-label="Show files"
                >
                  &lt;
                </button>
              )}
            </div>
          </header>

          <div className="chat-messages-container">
            <div className="chat-empty-state">
              <div className="chat-empty-icon">AI</div>
              <h2>Ask me anything about your courses.</h2>
              <p>Try: "Summarize week 4 of COS10009" or "Explain eigenvalues simply".</p>
            </div>
          </div>

          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Ask SWINLEARN about any of your courses..."
                className="chat-input"
              />
              <button className="send-btn" type="button">
                Send
              </button>
            </div>
          </div>
        </section>

        {showFiles && (
          <aside className="chat-sidebar export-sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">
                <span>Files</span>
              </div>
              <button
                className="icon-btn panel-btn"
                type="button"
                onClick={() => setShowFiles(false)}
                aria-label="Hide files"
              >
                &gt;
              </button>
            </div>
            <div className="sidebar-content empty-state">
              <p>Exported explanations and study notes will appear here.</p>
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}

export default SwinlearnPage
