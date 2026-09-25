

import './App.css';
import NavBar from './components/NavBar';
import Team from './components/Team';
import ServiceDetails from './components/ServiceDetails';
import ContactForm from './components/ContactForm';


function App() {
  return (
    <>
      <NavBar />
      <main>
        <section id="hero" style={{padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(90deg, #e3f2fd 0%, #f5f5f5 100%)'}}>
          <h1 style={{fontSize: '2.8rem', marginBottom: '1rem'}}>Welcome to AVS Seva Technologies Pvt Ltd</h1>
          <p style={{fontSize: '1.3rem', maxWidth: 700, margin: '0 auto 1.5rem'}}>
            Your trusted partner for technology-driven community services and solutions. We empower, support, and uplift organizations through innovative IT programs and dedicated service.
          </p>
          <a href="#contact-form" style={{background: '#1a237e', color: '#fff', padding: '0.8rem 2rem', borderRadius: 8, textDecoration: 'none', fontWeight: 500, fontSize: '1.1rem', boxShadow: '0 2px 8px #1a237e22'}}>Get in Touch</a>
        </section>

        <section id="about" className="section" style={{padding: '3rem 2rem'}}>
          <h2>About Us</h2>
          <p style={{fontSize: '1.1rem', maxWidth: 800, margin: '0 auto 1.5rem'}}>
            AVS Seva Technologies Pvt Ltd is dedicated to providing high-quality technology and community services, focusing on integrity, reliability, and excellence. Our mission is to create positive change and foster growth by connecting people, resources, and opportunities through innovative IT solutions.
          </p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center'}}>
            <div style={{flex: 1, minWidth: 220}}>
              <h3 style={{color: '#1a237e'}}>Our Mission</h3>
              <p>To empower individuals, organizations, and communities through accessible, impactful, and sustainable technology services.</p>
            </div>
            <div style={{flex: 1, minWidth: 220}}>
              <h3 style={{color: '#1a237e'}}>Our Vision</h3>
              <p>To be a leading force in technology-driven community development, recognized for our commitment, compassion, and results.</p>
            </div>
            <div style={{flex: 1, minWidth: 220}}>
              <h3 style={{color: '#1a237e'}}>CEO</h3>
              <p>Amarnath G Rathod</p>
            </div>
          </div>
        </section>

        <section id="services" className="section" style={{padding: '3rem 2rem', background: '#f5f5f5'}}>
          <h2>Our Services</h2>
          <ul style={{fontSize: '1.08rem'}}>
            <li>Consulting and Advisory</li>
            <li>Community Outreach</li>
            <li>Support and Assistance</li>
          </ul>
        </section>

        <ServiceDetails />
        <Team />
        <ContactForm />
        <section id="contact-info" className="section" style={{padding: '2rem', textAlign: 'center'}}>
          <h2>Contact Information</h2>
          <p>Email: <a href="mailto:rathodamar6541@gmail.com">rathodamar6541@gmail.com</a></p>
          <p>Phone: <a href="tel:7899396541">7899396541</a></p>
        </section>
      </main>
    </>
  );
}

export default App
