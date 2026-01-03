import './Team.css';

const teamMembers = [
  {
    name: 'Amarnath G Rathod',
    role: 'Founder & CEO',
    image: '/amarnath.jpg',
    bio: 'Visionary leader and CEO of AVS Seva Technologies Pvt Ltd, with a passion for technology-driven community solutions.'
  }
  // Add more real team members here as needed
];

export default function Team() {
  return (
    <section id="team" className="section team-section">
      <h2>Meet Our Team</h2>
      <div className="team-list">
        {teamMembers.map((member, idx) => (
          <div className="team-member" key={idx}>
            <img src={member.image} alt={member.name} className="team-photo" />
            <h3>{member.name}</h3>
            <p className="team-role">{member.role}</p>
            <p className="team-bio">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
