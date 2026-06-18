import { fanpageNews } from '../../data/fanpageContent'

function NewsSection() {
  const featuredNews = fanpageNews[0]

  return (
    <section className="news-section scroll-section" id="news">
      <div className="section-header">
        <p className="section-eyebrow">News</p>
        <h2 className="section-title">{featuredNews.title}</h2>
        <p className="section-lead">
          Latest updates from Swinburne, campus services, and the SWINLEARN
          student workspace.
        </p>
      </div>
      <article className="news-card">
        <div className="news-meta">
          <span className="news-tag">{featuredNews.tag}</span>
          <span className="news-date">{featuredNews.date}</span>
        </div>
        <h3>{featuredNews.title}</h3>
        <p>{featuredNews.summary}</p>
        <div className="news-highlights">
          {featuredNews.highlights.map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </div>
      </article>
    </section>
  )
}

export default NewsSection
