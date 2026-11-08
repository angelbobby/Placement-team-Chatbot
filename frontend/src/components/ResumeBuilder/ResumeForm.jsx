import React, { useState } from 'react';

const STEPS = [
  "Personal Info", 
  "Summary", 
  "Education", 
  "Experience", 
  "Projects", 
  "Skills", 
  "Certifications", 
  "Achievements",
  "Optional Sections",
  "Analyze & Finish"
];

const ResumeForm = ({ resumeData, setResumeData, activeStep, setActiveStep, hfToken, modelName }) => {
  const [isImproving, setIsImproving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleNext = () => setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const handlePrev = () => setActiveStep(prev => Math.max(prev - 1, 0));

  const handleChange = (section, field, value) => {
    setResumeData({
      ...resumeData,
      [section]: {
        ...resumeData[section],
        [field]: value
      }
    });
  };

  const handleArrayChange = (section, index, field, value) => {
    const newArray = [...resumeData[section]];
    newArray[index] = { ...newArray[index], [field]: value };
    setResumeData({ ...resumeData, [section]: newArray });
  };

  const addArrayItem = (section, emptyItem) => {
    setResumeData({ ...resumeData, [section]: [...resumeData[section], emptyItem] });
  };

  const removeArrayItem = (section, index) => {
    const newArray = resumeData[section].filter((_, i) => i !== index);
    setResumeData({ ...resumeData, [section]: newArray });
  };

  const handleSkillChange = (category, value) => {
    setResumeData({
      ...resumeData,
      skills: {
        ...resumeData.skills,
        [category]: value.split(',').map(s => s.trim()).filter(Boolean)
      }
    });
  };

  const improveWithAI = async (text, context_type, onUpdate) => {
    if (!text || !text.trim()) return;
    setIsImproving(true);
    try {
      const response = await fetch('http://localhost:5000/api/resume/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context_type, hf_token: hfToken, model_name: modelName })
      });
      const data = await response.json();
      if (data.improved_text) {
        onUpdate(data.improved_text);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to improve text. Is the backend running?");
    } finally {
      setIsImproving(false);
    }
  };

  const analyzeResume = async () => {
    setIsImproving(true);
    try {
      // Simulate file upload by generating PDF or sending text
      // We will actually just send the raw data to the backend /optimize for a quick analysis
      // But the endpoint /analyze expects a file. 
      // To simplify, we can use the /optimize endpoint which takes resume_data
      const response = await fetch('http://localhost:5000/api/resume/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_data: resumeData,
          company_name: "General Placement",
          role_name: "Software Engineer",
          hf_token: hfToken,
          model_name: modelName
        })
      });
      const data = await response.json();
      setAnalysisResult(data);
    } catch(err) {
      console.error(err);
      alert("Error analyzing resume");
    } finally {
      setIsImproving(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="form-step">
            <h3>Personal Information</h3>
            <div className="form-group"><label>Full Name</label><input type="text" value={resumeData.personal_info.name || ''} onChange={(e) => handleChange('personal_info', 'name', e.target.value)} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={resumeData.personal_info.email || ''} onChange={(e) => handleChange('personal_info', 'email', e.target.value)} /></div>
            <div className="form-group"><label>Phone</label><input type="text" value={resumeData.personal_info.phone || ''} onChange={(e) => handleChange('personal_info', 'phone', e.target.value)} /></div>
            <div className="form-group"><label>Location</label><input type="text" value={resumeData.personal_info.location || ''} onChange={(e) => handleChange('personal_info', 'location', e.target.value)} /></div>
            <div className="form-group"><label>LinkedIn (Optional)</label><input type="text" value={resumeData.personal_info.linkedin || ''} onChange={(e) => handleChange('personal_info', 'linkedin', e.target.value)} /></div>
            <div className="form-group"><label>Portfolio/Website (Optional)</label><input type="text" value={resumeData.personal_info.website || ''} onChange={(e) => handleChange('personal_info', 'website', e.target.value)} /></div>
          </div>
        );
      case 1:
        return (
          <div className="form-step">
            <h3>Professional Summary</h3>
            <textarea rows={6} value={resumeData.summary || ''} onChange={(e) => setResumeData({...resumeData, summary: e.target.value})} placeholder="Write a brief professional summary..." />
            <button className="btn-secondary" onClick={() => improveWithAI(resumeData.summary, "Professional Summary", (res) => setResumeData({...resumeData, summary: res}))} disabled={isImproving}>
              {isImproving ? "Improving..." : "✨ Improve with AI"}
            </button>
          </div>
        );
      case 2:
        return (
          <div className="form-step">
            <h3>Education</h3>
            {resumeData.education.map((edu, idx) => (
              <div key={idx} className="entry-card">
                <input type="text" placeholder="Institution Name" value={edu.school || ''} onChange={(e) => handleArrayChange('education', idx, 'school', e.target.value)} />
                <input type="text" placeholder="Degree (e.g. B.Tech)" value={edu.degree || ''} onChange={(e) => handleArrayChange('education', idx, 'degree', e.target.value)} />
                <input type="text" placeholder="Specialization (e.g. Computer Science)" value={edu.field_of_study || ''} onChange={(e) => handleArrayChange('education', idx, 'field_of_study', e.target.value)} />
                <div className="flex-row">
                  <input type="text" placeholder="Start Year" />
                  <input type="text" placeholder="End Year / Expected" value={edu.graduation_year || ''} onChange={(e) => handleArrayChange('education', idx, 'graduation_year', e.target.value)} />
                </div>
                <input type="text" placeholder="CGPA / Percentage" value={edu.gpa || ''} onChange={(e) => handleArrayChange('education', idx, 'gpa', e.target.value)} />
                <button className="btn-danger" onClick={() => removeArrayItem('education', idx)}>Delete</button>
              </div>
            ))}
            <button className="btn-add" onClick={() => addArrayItem('education', { degree: '', field_of_study: '', school: '', graduation_year: '', gpa: '' })}>+ Add Education</button>
          </div>
        );
      case 3:
        return (
          <div className="form-step">
            <h3>Experience / Internships</h3>
            {resumeData.experience.map((exp, idx) => (
              <div key={idx} className="entry-card">
                <input type="text" placeholder="Job Title / Role" value={exp.role || ''} onChange={(e) => handleArrayChange('experience', idx, 'role', e.target.value)} />
                <input type="text" placeholder="Company" value={exp.company || ''} onChange={(e) => handleArrayChange('experience', idx, 'company', e.target.value)} />
                <input type="text" placeholder="Location" value={exp.location || ''} onChange={(e) => handleArrayChange('experience', idx, 'location', e.target.value)} />
                <div className="flex-row">
                  <input type="text" placeholder="Start Date" value={exp.start_date || ''} onChange={(e) => handleArrayChange('experience', idx, 'start_date', e.target.value)} />
                  <input type="text" placeholder="End Date" value={exp.end_date || ''} onChange={(e) => handleArrayChange('experience', idx, 'end_date', e.target.value)} disabled={exp.currently_working} />
                </div>
                <div className="flex-row" style={{alignItems: 'center', marginBottom: '10px'}}>
                  <input type="checkbox" checked={exp.currently_working || false} onChange={(e) => {
                    handleArrayChange('experience', idx, 'currently_working', e.target.checked);
                    if(e.target.checked) handleArrayChange('experience', idx, 'end_date', 'Present');
                  }} /> <label>Currently Working</label>
                </div>
                <textarea rows={4} placeholder="Responsibilities and Achievements (bullet points)" value={exp.description || ''} onChange={(e) => handleArrayChange('experience', idx, 'description', e.target.value)} />
                <div className="btn-group">
                  <button className="btn-secondary" onClick={() => improveWithAI(exp.description, "Work Experience Bullet Points", (res) => handleArrayChange('experience', idx, 'description', res))} disabled={isImproving}>
                    ✨ Improve Bullet Points with AI
                  </button>
                  <button className="btn-danger" onClick={() => removeArrayItem('experience', idx)}>Delete</button>
                </div>
              </div>
            ))}
            <button className="btn-add" onClick={() => addArrayItem('experience', { role: '', company: '', location: '', start_date: '', end_date: '', currently_working: false, description: '' })}>+ Add Experience</button>
          </div>
        );
      case 4:
        return (
          <div className="form-step">
            <h3>Projects</h3>
            {resumeData.projects.map((proj, idx) => (
              <div key={idx} className="entry-card">
                <input type="text" placeholder="Project Name" value={proj.title || ''} onChange={(e) => handleArrayChange('projects', idx, 'title', e.target.value)} />
                <input type="text" placeholder="Technologies Used (comma separated)" value={proj.technologies?.join(', ') || ''} onChange={(e) => handleArrayChange('projects', idx, 'technologies', e.target.value.split(',').map(s => s.trim()))} />
                <input type="text" placeholder="Role / Contribution" value={proj.role || ''} onChange={(e) => handleArrayChange('projects', idx, 'role', e.target.value)} />
                <div className="flex-row">
                  <input type="text" placeholder="Start Date" value={proj.start_date || ''} onChange={(e) => handleArrayChange('projects', idx, 'start_date', e.target.value)} />
                  <input type="text" placeholder="End Date" value={proj.end_date || ''} onChange={(e) => handleArrayChange('projects', idx, 'end_date', e.target.value)} />
                </div>
                <input type="text" placeholder="GitHub URL" value={proj.github || ''} onChange={(e) => handleArrayChange('projects', idx, 'github', e.target.value)} />
                <input type="text" placeholder="Project/Live URL" value={proj.link || ''} onChange={(e) => handleArrayChange('projects', idx, 'link', e.target.value)} />
                <textarea rows={4} placeholder="Project Description (bullet points)" value={proj.description || ''} onChange={(e) => handleArrayChange('projects', idx, 'description', e.target.value)} />
                <div className="btn-group">
                  <button className="btn-secondary" onClick={() => improveWithAI(proj.description, "Project Description", (res) => handleArrayChange('projects', idx, 'description', res))} disabled={isImproving}>
                    ✨ Improve Description with AI
                  </button>
                  <button className="btn-danger" onClick={() => removeArrayItem('projects', idx)}>Delete</button>
                </div>
              </div>
            ))}
            <button className="btn-add" onClick={() => addArrayItem('projects', { title: '', technologies: [], role: '', start_date: '', end_date: '', github: '', link: '', description: '' })}>+ Add Project</button>
          </div>
        );
      case 5:
        return (
          <div className="form-step">
            <h3>Technical Skills</h3>
            <div className="form-group">
              <label>Programming Languages</label>
              <textarea rows={2} placeholder="Python, Java, C++, JavaScript..." value={(resumeData.skills?.programming_languages || []).join(', ')} onChange={(e) => handleSkillChange('programming_languages', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Frameworks / Libraries</label>
              <textarea rows={2} placeholder="Flask, React, Next.js, TensorFlow..." value={(resumeData.skills?.frameworks || []).join(', ')} onChange={(e) => handleSkillChange('frameworks', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Databases</label>
              <textarea rows={2} placeholder="MySQL, PostgreSQL, MongoDB..." value={(resumeData.skills?.databases || []).join(', ')} onChange={(e) => handleSkillChange('databases', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tools / Technologies</label>
              <textarea rows={2} placeholder="Git, Docker, AWS, Kubernetes..." value={(resumeData.skills?.tools || []).join(', ')} onChange={(e) => handleSkillChange('tools', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Other Skills</label>
              <textarea rows={2} placeholder="Agile, Problem Solving..." value={(resumeData.skills?.other || []).join(', ')} onChange={(e) => handleSkillChange('other', e.target.value)} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="form-step">
            <h3>Certifications</h3>
            <textarea rows={5} placeholder="Enter certifications separated by newlines (e.g. AWS Certified Solutions Architect)" value={resumeData.certifications.join('\n')} onChange={(e) => setResumeData({...resumeData, certifications: e.target.value.split('\n').filter(Boolean)})} />
          </div>
        );
      case 7:
        return (
          <div className="form-step">
            <h3>Achievements</h3>
            <textarea rows={5} placeholder="Enter achievements separated by newlines (e.g. 1st Place at University Hackathon 2023)" value={(resumeData.achievements || []).join('\n')} onChange={(e) => setResumeData({...resumeData, achievements: e.target.value.split('\n').filter(Boolean)})} />
          </div>
        );
      case 8:
        return (
          <div className="form-step">
            <h3>Optional Sections</h3>
            <p>Select additional sections to include in your resume.</p>
            {Object.keys(resumeData.optional_sections || {}).map((sec, idx) => (
               <div key={idx} className="flex-row" style={{alignItems: 'center', marginBottom: '10px'}}>
                  <input type="checkbox" checked={resumeData.optional_sections[sec]} onChange={(e) => handleChange('optional_sections', sec, e.target.checked)} /> 
                  <label style={{textTransform: 'capitalize'}}>{sec}</label>
               </div>
            ))}
          </div>
        );
      case 9:
        return (
          <div className="form-step">
            <h3>Analyze & Finish</h3>
            <p>Your resume is ready for review.</p>
            <button className="btn-secondary" onClick={analyzeResume} disabled={isImproving}>
              {isImproving ? "Analyzing..." : "Analyze Resume"}
            </button>
            {analysisResult && (
              <div className="analysis-results" style={{marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px'}}>
                <h4>Optimization Suggestions</h4>
                {analysisResult.summary_suggestion && <p><strong>Summary Suggestion:</strong> {analysisResult.summary_suggestion}</p>}
                {analysisResult.skills_to_add && <p><strong>Skills to Consider:</strong> {analysisResult.skills_to_add.join(', ')}</p>}
              </div>
            )}
          </div>
        )
      default:
        return null;
    }
  };

  return (
    <div className="resume-form-container">
      <div className="progress-bar">
        {STEPS.map((step, idx) => (
          <div key={idx} className={`step-indicator ${idx === activeStep ? 'active' : ''} ${idx < activeStep ? 'completed' : ''}`}>
            {step}
          </div>
        ))}
      </div>
      
      <div className="form-content-area">
        {renderStepContent()}
      </div>

      <div className="form-navigation">
        <button className="btn-nav" onClick={handlePrev} disabled={activeStep === 0}>← Previous</button>
        <button className="btn-nav" onClick={handleNext} disabled={activeStep === STEPS.length - 1}>Next →</button>
      </div>
    </div>
  );
};

export default ResumeForm;
