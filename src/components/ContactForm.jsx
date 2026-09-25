import { useState } from 'react';
import './ContactForm.css';

const initialForm = { name: '', email: '', message: '' };

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'contact',
          name: form.name,
          email: form.email,
          message: form.message,
        }).toString(),
      });

      if (!response.ok) throw new Error(`Submission failed with status ${response.status}`);

      setForm(initialForm);
      setStatus('success');
    } catch {
      setStatus('error');
      setError('We could not send your message. Please email us directly or try again.');
    }
  }

  return (
    <section id="contact-form" className="section contact-section">
      <h2>Contact Us</h2>
      <p>Tell us how we can support your technology or community initiative.</p>

      {status === 'success' ? (
        <div className="success-msg" role="status">
          <h3>Thank you for reaching out.</h3>
          <p>Your message has been submitted successfully.</p>
          <button type="button" className="text-button" onClick={() => setStatus('idle')}>
            Send another message
          </button>
        </div>
      ) : (
        <form
          className="contact-form"
          name="contact"
          method="POST"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="form-name" value="contact" />
          <p className="visually-hidden">
            <label>
              Do not fill this out: <input name="bot-field" tabIndex="-1" autoComplete="off" />
            </label>
          </p>

          <div className="form-field">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              type="text"
              name="name"
              autoComplete="name"
              maxLength="100"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              name="email"
              autoComplete="email"
              maxLength="200"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              name="message"
              maxLength="5000"
              rows="6"
              value={form.message}
              onChange={handleChange}
              required
            />
          </div>

          {status === 'error' && <p className="error-msg" role="alert">{error}</p>}

          <button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}
    </section>
  );
}
