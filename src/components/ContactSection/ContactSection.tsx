function ContactSection() {
  return (
    <section className="contact-section scroll-section" id="contact-us">
      <div className="section-header">
        <p className="section-eyebrow">Contact us</p>
        <h2 className="section-title">We are here to help.</h2>
        <p className="section-lead">
          Reach the SwinLearn support team for platform questions, access, or
          feedback.
        </p>
      </div>
      <div className="contact-grid">
        <div className="contact-card">
          <h3>Reach our team</h3>
          <p>We reply within 1 business day.</p>
          <ul className="contact-list">
            <li className="contact-item">
              <span className="contact-label">Email</span>
              <span className="contact-value">support@swinlearn.edu.au</span>
            </li>
            <li className="contact-item">
              <span className="contact-label">Phone</span>
              <span className="contact-value">+61 3 9214 0000</span>
            </li>
            <li className="contact-item">
              <span className="contact-label">Office hours</span>
              <span className="contact-value">Mon to Fri · 9:00 AM to 5:00 PM</span>
            </li>
          </ul>
        </div>
        <form className="contact-form">
          <label className="form-field">
            <span>Name</span>
            <input type="text" placeholder="Your full name" />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" placeholder="you@swinburne.edu.au" />
          </label>
          <label className="form-field">
            <span>Message</span>
            <textarea placeholder="Tell us how we can help" />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Send message
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default ContactSection
