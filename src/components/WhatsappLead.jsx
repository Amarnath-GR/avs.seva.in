import { useState } from 'react';
import './WhatsappLead.css';

/**
 * Opt-in WhatsApp entry point.
 *
 * Why opt-in rather than unsolicited messaging
 * -------------------------------------------
 * Meta prohibits unsolicited WhatsApp messages, and sending them risks the
 * business number being banned - which would remove the ability to talk to
 * customers who do want to hear from us. So the number is only ever opened by
 * someone who has just acted: they entered their own website and tapped send.
 *
 * That action is the consent. Nothing is pre-filled with a phone number and no
 * message is sent until they press the button, so the conversation starts on
 * their side, which is both lawful and far more likely to be answered.
 *
 * wa.me/ with a prefilled text opens the visitor's own WhatsApp app. If they
 * have no WhatsApp installed the link does nothing, so an email route is
 * offered alongside it rather than as a fallback after the fact.
 */

// The business WhatsApp number in international format, digits only.
// Kept as one constant so the number appears in exactly one place.
const WHATSAPP_NUMBER = '919741519415';

const PREFILLED_MESSAGE =
  "Hi, I'd like a free website review. My website is: ";

function isValidUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Accept what a visitor actually types: "acme.co.uk", "www.acme.co.uk",
  // "https://acme.co.uk". Anything else is more likely a typo than a website.
  return /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed);
}

function normaliseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^www\./i, '')}`;
}

export default function WhatsappLead() {
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const value = website.trim();

    if (!isValidUrl(value)) {
      setError('Please enter your website address, for example acme.co.uk');
      return;
    }
    setError('');

    const text = `${PREFILLED_MESSAGE}${normaliseUrl(value)}`;
    // wa.me takes digits only. The visitor's own message is carried in the
    // text parameter so they can see and edit it before sending.
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section id="free-review" className="section whatsapp-lead">
      <h2>Get a free website review on WhatsApp</h2>
      <p className="whatsapp-lead-intro">
        Enter your website and we&rsquo;ll send you a short, evidence-based
        review of what&rsquo;s working and what isn&rsquo;t. No cost, and you
        can ignore it if it&rsquo;s not useful.
      </p>

      <form className="whatsapp-lead-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="review-website">Your website address</label>
          <input
            id="review-website"
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbusiness.co.uk"
            maxLength="200"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            aria-describedby={error ? 'review-website-error' : undefined}
            aria-invalid={error ? 'true' : undefined}
            required
          />
        </div>

        {error && (
          <p id="review-website-error" className="error-msg" role="alert">
            {error}
          </p>
        )}

        <button type="submit">Open WhatsApp and send my review request</button>
      </form>

      <p className="whatsapp-lead-note">
        This opens WhatsApp with a message ready to send &mdash; you keep it
        and decide whether to send. We only reply to messages you send us, and
        if you&rsquo;d rather not use WhatsApp, email{' '}
        <a href="mailto:avsseva@gmail.com">avsseva@gmail.com</a> instead.
      </p>
    </section>
  );
}