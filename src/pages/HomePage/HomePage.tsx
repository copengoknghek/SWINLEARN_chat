import Navbar from '../../components/Navbar/Navbar'
import Hero from '../../components/Hero/Hero'
import FeatureGrid from '../../components/FeatureGrid/FeatureGrid'

function HomePage() {
  return (
    <div className="page">
      <Navbar />
      <main className="main">
        <Hero />
        <FeatureGrid />
      </main>
    </div>
  )
}

export default HomePage
