import React from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Roadmap data
const roadmapPhases = [
  {
    title: 'Requirement Analysis',
    description: 'Collect student placement queries, analyze placement workflows, gather policies and guidelines.',
    status: 'Completed',
    icon: '📝',
  },
  {
    title: 'Knowledge Base Development',
    description: 'Store FAQs, company eligibility criteria, placement statistics, drive schedules, and documents.',
    status: 'Completed',
    icon: '📚',
  },
  {
    title: 'AI Chatbot Development',
    description: 'Natural language processing, context‑aware responses, instant query resolution, RAG‑based retrieval.',
    status: 'In Progress',
    icon: '🤖',
  },
  {
    title: 'Service‑Based Placement Module',
    description: 'Aptitude preparation, verbal ability practice, HR interview prep, group discussion guidance, communication skills.',
    status: 'Planned',
    icon: '💼',
  },
  {
    title: 'Product‑Based Placement Module',
    description: 'DSA preparation, coding assessments, project evaluation, GitHub profile guidance, technical interview prep.',
    status: 'Planned',
    icon: '⚙️',
  },
  {
    title: 'Resume Builder',
    description: 'Conversational resume creation, ATS‑friendly formatting, resume templates, PDF/DOCX export.',
    status: 'Planned',
    icon: '📝',
  },
  {
    title: 'Resume Analyzer',
    description: 'ATS score calculation, keyword analysis, missing skill detection, improvement suggestions.',
    status: 'Planned',
    icon: '🔎',
  },
  {
    title: 'Company‑Specific Optimization',
    description: 'Tailor resumes for specific companies, highlight relevant skills and projects, improve keyword matching.',
    status: 'Planned',
    icon: '🎯',
  },
  {
    title: 'Mock Interview System',
    description: 'HR & technical interview practice, feedback generation, performance tracking.',
    status: 'Planned',
    icon: '🗣️',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Student progress tracking, resume performance metrics, placement insights, usage analytics.',
    status: 'Planned',
    icon: '📊',
  },
  {
    title: 'Testing & Validation',
    description: 'Accuracy testing, user feedback collection, performance optimization, security testing.',
    status: 'Planned',
    icon: '✅',
  },
  {
    title: 'Deployment & Maintenance',
    description: 'Cloud deployment, database integration, continuous updates, feature enhancements.',
    status: 'Planned',
    icon: '🚀',
  },
];

const techStack = [
  'React.js',
  'FastAPI',
  'MongoDB',
  'OpenAI / Gemini',
  'LangChain',
  'Render / Vercel',
];

const expectedOutcomes = [
  'Faster access to placement information',
  'Better resume quality',
  'Improved interview preparation',
  'Higher placement success rates',
  'Reduced workload for placement team',
];

const downloadPdf = async () => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;

  doc.setFontSize(24);
  doc.text('AI‑Powered Placement Assistant – Development Roadmap', margin, y);
  y += 30;

  doc.setFontSize(14);
  roadmapPhases.forEach((phase) => {
    doc.setFont(undefined, 'bold');
    doc.text(`${phase.icon} ${phase.title}`, margin, y);
    y += 18;
    doc.setFont(undefined, 'normal');
    doc.text(`Status: ${phase.status}`, margin + 20, y);
    y += 14;
    doc.text(phase.description, margin + 20, y, { maxWidth: 520 });
    y += 30;
  });

  // Tech Stack
  y += 10;
  doc.setFontSize(18);
  doc.text('Tech Stack', margin, y);
  y += 22;
  doc.setFontSize(12);
  techStack.forEach((item) => {
    doc.text(`• ${item}`, margin + 10, y);
    y += 14;
  });

  // Expected Outcomes
  y += 10;
  doc.setFontSize(18);
  doc.text('Expected Outcomes', margin, y);
  y += 22;
  doc.setFontSize(12);
  expectedOutcomes.forEach((out) => {
    doc.text(`• ${out}`, margin + 10, y);
    y += 14;
  });

  doc.save('Placement_Roadmap.pdf');
};

const Roadmap = () => (
  <div className="roadmap-page" style={{ padding: '24px' }}>
    <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>
      AI‑Powered Placement Assistant – Development Roadmap
    </h1>
    <div className="timeline">
      {roadmapPhases.map((phase, idx) => (
        <div key={idx} className="timeline-item" style={{ marginBottom: '32px', display: 'flex' }}>
          <div className="timeline-icon" style={{ fontSize: '24px' }}>{phase.icon}</div>
          <div className="timeline-content" style={{ marginLeft: '12px' }}>
            <h3 style={{ margin: '0' }}>{phase.title}</h3>
            <p style={{ margin: '4px 0', color: '#555' }}>{phase.description}</p>
            <span style={{ fontWeight: 'bold' }}>Status: {phase.status}</span>
          </div>
        </div>
      ))}
    </div>
    <button
      onClick={downloadPdf}
      style={{
        marginTop: '24px',
        padding: '12px 24px',
        background: '#0066ff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      📥 Download Roadmap PDF
    </button>
  </div>
);

export default Roadmap;
