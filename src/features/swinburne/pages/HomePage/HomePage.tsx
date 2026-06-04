import Navbar from '../../components/Navbar/Navbar'
import Hero from '../../components/Hero/Hero'
import FeatureGrid from '../../components/FeatureGrid/FeatureGrid'
import AboutSection from '../../components/AboutSection/AboutSection'
import NewsSection from '../../components/NewsSection/NewsSection'
import EventsSection from '../../components/EventsSection/EventsSection'
import ContactSection from '../../components/ContactSection/ContactSection'
import Footer from '../../components/Footer/Footer'

function HomePage() {
  return (
    <div className="page">
      <Navbar />
      <main className="main">
        <Hero />
        <FeatureGrid />
        <AboutSection />
        <NewsSection />
        <EventsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}

export default HomePage
