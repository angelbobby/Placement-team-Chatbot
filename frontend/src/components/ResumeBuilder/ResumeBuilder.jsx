import React, { useState } from 'react';
import ResumeForm from './ResumeForm';
import ResumePreview from './ResumePreview';
import './ResumeBuilder.css'; // Optional: separate CSS for the builder

const DEFAULT_RESUME = {
  personal_info: { name: "", email: "", phone: "", linkedin: "", location: "", website: "" },
  summary: "",
  education: [],
  experience: [],
  projects: [],
  skills: {
    programming_languages: [],
    frameworks: [],
    databases: [],
    tools: [],
    other: []
  },
  certifications: [],
  achievements: [],
  optional_sections: {
    publications: false,
    leadership: false,
    volunteer: false,
    extracurricular: false,
    languages: false,
    interests: false
  }
};

const ResumeBuilder = ({ hfToken, modelName }) => {
  const [resumeData, setResumeData] = useState(() => {
    // Optionally load from localStorage
    const saved = localStorage.getItem('resume_builder_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if the old schema is being used (where skills was an array)
        if (Array.isArray(parsed.skills)) {
          console.log("Old resume format detected, resetting to new schema.");
          return DEFAULT_RESUME;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_RESUME;
      }
    }
    return DEFAULT_RESUME;
  });

  const [activeStep, setActiveStep] = useState(0);

  const handleUpdateData = (newData) => {
    setResumeData(newData);
    localStorage.setItem('resume_builder_data', JSON.stringify(newData));
  };

  const downloadPDF = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/resume/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeData)
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resumeData.personal_info.name.replace(/\s+/g, '_')}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF. Make sure your backend server is running.");
    }
  };

  return (
    <div className="resume-builder-layout">
      <div className="resume-builder-left">
        <div className="resume-builder-header">
          <h2>Resume Builder</h2>
          <button className="btn-primary" onClick={downloadPDF}>Download PDF</button>
        </div>
        <ResumeForm 
          resumeData={resumeData} 
          setResumeData={handleUpdateData} 
          activeStep={activeStep} 
          setActiveStep={setActiveStep}
          hfToken={hfToken}
          modelName={modelName}
        />
      </div>
      <div className="resume-builder-right">
        <ResumePreview data={resumeData} />
      </div>
    </div>
  );
};

export default ResumeBuilder;
