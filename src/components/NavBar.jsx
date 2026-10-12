import './NavBar.css';

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <img src="/favicon.svg" alt="AVS Seva logo" width="32" height="32" />
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
