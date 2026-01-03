import './Testimonials.css';

const testimonials = [
  {
    name: 'Priya Sharma',
    feedback: 'AVS Seva helped us organize a wonderful community event. Their dedication is unmatched!',
    image: 'https://randomuser.me/api/portraits/women/68.jpg'
  },
  {
    name: 'Vikram Patel',
    feedback: 'Professional and reliable team. Highly recommend their services!',
    image: 'https://randomuser.me/api/portraits/men/71.jpg'
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="section testimonials-section">
      <h2>Testimonials</h2>
      <div className="testimonials-list">
        {testimonials.map((t, idx) => (
          <div className="testimonial" key={idx}>
            <img src={t.image} alt={t.name} className="testimonial-photo" />
            <blockquote>"{t.feedback}"</blockquote>
            <p className="testimonial-name">- {t.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
