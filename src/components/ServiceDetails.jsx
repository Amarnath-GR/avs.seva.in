import './ServiceDetails.css';

const services = [
  {
    title: 'Consulting and Advisory',
    description: 'Expert guidance for community projects, organizational growth, and social initiatives.'
  },
  {
    title: 'Community Outreach',
    description: 'Programs and events to engage, educate, and empower the local community.'
  },
  {
    title: 'Support and Assistance',
    description: 'Personalized support for individuals and groups in need, including helplines and resources.'
  }
];

export default function ServiceDetails() {
  return (
    <section id="detailed-services" className="section services-section">
      <h2>Service Details</h2>
      <div className="services-list">
        {services.map((s, idx) => (
          <div className="service-card" key={idx}>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
