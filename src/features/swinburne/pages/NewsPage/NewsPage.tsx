import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import { fanpageNews } from '../../data/fanpageContent'
import './NewsPage.css'

function NewsPage() {
  return (
    <div className="page">
      <Navbar />
      <main className="main fanpage-list-main">
        <header className="fanpage-list-header">
          <span className="section-eyebrow">Swinburne news</span>
          <h1 className="fanpage-list-title">News</h1>
          <p className="section-lead">
            Updates for guests, students, and staff across Swinburne services
            and the SWINLEARN platform.
          </p>
        </header>

        <section className="fanpage-list-grid" aria-label="News articles">
          {fanpageNews.map((item) => (
            <article className="news-card fanpage-list-card" key={item.title}>
              <div className="news-meta">
                <span className="news-tag">{item.tag}</span>
                <span className="news-date">{item.date}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <div className="news-highlights">
                {item.highlights.map((highlight) => (
                  <span key={highlight}>{highlight}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default NewsPage
