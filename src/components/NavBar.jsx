import './NavBar.css';

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        {/* The logo carries the brand, so the wordmark stays alongside it for
            legibility rather than being replaced by the image. */}
        <img src="/avs-logo-icon.png" alt="" width="32" height="35" />
        <span>AVS Seva</span>
      </div>
      <ul className="navbar-links">
        <li><a href="#about">About Us</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#contact-form">Contact</a></li>
      </ul>
    </nav>
  );
}
