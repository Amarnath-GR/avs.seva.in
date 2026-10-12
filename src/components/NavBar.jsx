import './NavBar.css';

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand" aria-label="AVS Seva Technologies logo and brand name">
        <img src="/avs-logo-circle.jpeg" alt="AVS Seva logo" className="navbar-mark" />
        <div className="navbar-text">
          <span className="brand-name">AVS</span>
          <span className="brand-tag">Seva Technologies</span>
        </div>
      </div>

      <ul className="navbar-links">
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#detailed-services">Solutions</a></li>
        <li><a href="#contact-form">Contact</a></li>
      </ul>
    </nav>
  );
}
