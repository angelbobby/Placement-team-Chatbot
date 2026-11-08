import React from 'react';

const ResumePreview = ({ data }) => {
  if (!data) return null;
  const { personal_info, summary, education, experience, projects, skills, certifications, achievements, optional_sections } = data;

  const hasContent = (arr) => arr && arr.length > 0;
  
  const hasSkills = skills && Object.values(skills).some(arr => arr.length > 0);
  
  const skillLabels = {
    programming_languages: "Languages",
    frameworks: "Frameworks",
    databases: "Databases",
    tools: "Tools",
    other: "Other"
  };

  return (
    <div className="resume-paper">
      <div className="resume-paper-content">
        {/* Header */}
        <h1 className="paper-name">{personal_info?.name || "Your Name"}</h1>
        <div className="paper-contact">
          {[
            personal_info?.email,
            personal_info?.phone,
            personal_info?.location,
            personal_info?.linkedin && `LinkedIn: ${personal_info.linkedin}`,
            personal_info?.website
          ].filter(Boolean).join(" | ")}
        </div>

        {/* Summary */}
        {summary && (
          <div className="paper-section">
            <h2 className="paper-section-title">PROFESSIONAL SUMMARY</h2>
            <p className="paper-summary">{summary}</p>
          </div>
        )}

        {/* Education */}
        {hasContent(education) && (
          <div className="paper-section">
            <h2 className="paper-section-title">EDUCATION</h2>
            {education.map((edu, idx) => (
              <div key={idx} className="paper-item">
                <div className="paper-item-header">
                  <span className="paper-item-title">
                    <strong>{edu.degree}</strong> {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                  </span>
                  <span className="paper-item-date">{edu.graduation_year}</span>
                </div>
                <div className="paper-item-sub">
                  <span><i>{edu.school}</i></span>
                  {edu.gpa && <span>GPA: {edu.gpa}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Experience */}
        {hasContent(experience) && (
          <div className="paper-section">
            <h2 className="paper-section-title">WORK EXPERIENCE</h2>
            {experience.map((exp, idx) => (
              <div key={idx} className="paper-item">
                <div className="paper-item-header">
                  <span className="paper-item-title">
                    <strong>{exp.role}</strong> {exp.company && `| `}<i>{exp.company}</i> {exp.location && `(${exp.location})`}
                  </span>
                  <span className="paper-item-date">{[exp.start_date, exp.end_date].filter(Boolean).join(' - ')}</span>
                </div>
                {exp.description && (
                  <ul className="paper-bullets">
                    {exp.description.split('\n').filter(line => line.trim()).map((line, i) => {
                      const cleanLine = line.replace(/^[-*]\s*/, '').trim();
                      return cleanLine ? <li key={i} className="paper-bullet">{cleanLine}</li> : null;
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {hasContent(projects) && (
          <div className="paper-section">
            <h2 className="paper-section-title">PROJECTS</h2>
            {projects.map((proj, idx) => (
              <div key={idx} className="paper-item">
                <div className="paper-item-header">
                  <span className="paper-item-title">
                    <strong>{proj.title}</strong> {hasContent(proj.technologies) && <i>({proj.technologies.join(", ")})</i>}
                  </span>
                  <span className="paper-item-date">
                    {proj.link ? <a href={proj.link} className="paper-item-link" target="_blank" rel="noreferrer">Project Link</a> : ''}
                    {proj.link && proj.github ? ' | ' : ''}
                    {proj.github ? <a href={proj.github} className="paper-item-link" target="_blank" rel="noreferrer">GitHub</a> : ''}
                    {proj.start_date || proj.end_date ? `  ${[proj.start_date, proj.end_date].filter(Boolean).join(' - ')}` : ''}
                  </span>
                </div>
                {proj.description && (
                  <ul className="paper-bullets">
                    {proj.description.split('\n').filter(line => line.trim()).map((line, i) => {
                      const cleanLine = line.replace(/^[-*]\s*/, '').trim();
                      return cleanLine ? <li key={i} className="paper-bullet">{cleanLine}</li> : null;
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {hasSkills && (
          <div className="paper-section">
            <h2 className="paper-section-title">SKILLS</h2>
            <div className="paper-skills">
              {Object.entries(skillLabels).map(([key, label]) => {
                const categorySkills = skills[key];
                if (categorySkills && categorySkills.length > 0) {
                  return (
                    <div key={key} className="paper-skills-category">
                      <strong>{label}:</strong> {categorySkills.join(', ')}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* Certifications */}
        {hasContent(certifications) && (
          <div className="paper-section">
            <h2 className="paper-section-title">CERTIFICATIONS</h2>
            <ul className="paper-bullets">
              {certifications.filter(c => c.trim()).map((cert, idx) => (
                <li key={`cert-${idx}`} className="paper-bullet">{cert.trim()}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Achievements */}
        {hasContent(achievements) && (
          <div className="paper-section">
            <h2 className="paper-section-title">ACHIEVEMENTS</h2>
            <ul className="paper-bullets">
              {achievements.filter(a => a.trim()).map((ach, idx) => (
                <li key={`ach-${idx}`} className="paper-bullet">{ach.trim()}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Optional Sections rendering could be added here if there was data for them.
            Currently optional sections just turns on flags, but since we didn't add fields
            to capture their data in the form, we'll leave it as a placeholder. */}
      </div>
    </div>
  );
};

export default ResumePreview;
