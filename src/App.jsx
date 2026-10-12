import './App.css';
import NavBar from './components/NavBar';
import Team from './components/Team';
import ServiceDetails from './components/ServiceDetails';
import ContactForm from './components/ContactForm';
import WhatsappLead from './components/WhatsappLead';

const stats = [
  { value: '24/7', label: 'Support mindset' },
  { value: '100%', label: 'Community-first approach' },
];

const serviceHighlights = ['Consulting and Advisory', 'Community Outreach', 'Support and Assistance'];

function App() {
  return (
    <>
      <NavBar />
      <main>
        <section id="hero" className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow">Empowering communities through technology</span>
            <h1>Transform ideas into meaningful action.</h1>
            <p>
              AVS Seva Technologies Pvt Ltd brings together innovation, compassion, and practical
              solutions to strengthen people, organizations, and communities.
            </p>

            <div className="hero-actions">
              <a href="#free-review" className="primary-button">Free website review</a>
              <a href="#contact-form" className="secondary-button">Get in Touch</a>
            </div>

            <div className="hero-stats">
              {stats.map((stat) => (
                <div className="stat-card" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-label="Brand showcase panel">
            <div className="glass-panel main-panel">
              <span className="panel-label">Innovation for change</span>
              <h3>Community-first digital solutions</h3>
              <ul>
                <li>Technology strategy that feels personal</li>
                <li>Action-driven support for real-world problems</li>
                <li>Long-term growth with integrity and care</li>
              </ul>
            </div>
            <div className="floating-badge">Trusted by communities</div>
          </div>
        </section>

        <section id="about" className="section about-section">
          <div className="section-heading">
            <span className="section-kicker">About</span>
            <h2>Driven by purpose, powered by people.</h2>
          </div>
          <p className="section-intro">
            AVS Seva Technologies Pvt Ltd is dedicated to providing high-quality technology and
            community services with a focus on integrity, reliability, and excellence. We connect
            resources, opportunities, and people through practical and impactful IT solutions.
          </p>
          <div className="info-grid">
            <div className="info-card">
              <h3>Our Mission</h3>
              <p>
                To empower individuals, organizations, and communities through accessible, impactful,
                and sustainable technology services.
              </p>
            </div>
            <div className="info-card">
              <h3>Our Vision</h3>
              <p>
                To be a leading force in technology-driven community development, recognized for our
                commitment, compassion, and results.
              </p>
            </div>
            <div className="info-card">
              <h3>Leadership</h3>
              <p>Amarnath G Rathod</p>
            </div>
          </div>
        </section>

        <section id="services" className="section services-overview">
          <div className="section-heading">
            <span className="section-kicker">Services</span>
            <h2>Solutions built for real impact.</h2>
          </div>
          <div className="service-grid">
            {serviceHighlights.map((service, index) => (
              <div className="service-tile" key={service}>
                <span className="tile-number">0{index + 1}</span>
                <h3>{service}</h3>
              </div>
            ))}
          </div>
        </section>

        <ServiceDetails />
        <Team />
        <WhatsappLead />
        <ContactForm />

        <section id="contact-info" className="section contact-info">
          <h2>Contact Information</h2>
          <p>
            Email: <a href="mailto:rathodamar6541@gmail.com">rathodamar6541@gmail.com</a>
          </p>
          <p>
            Phone: <a href="tel:7899396541">7899396541</a>
          </p>
        </section>
      </main>
    </>
  );
}

export default App;
