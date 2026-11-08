import React, { useState, useEffect, useRef } from 'react';
import MockInterview from './components/MockInterview/MockInterview';
import ResumeBuilder from './components/ResumeBuilder/ResumeBuilder';
import TechInterview from './components/TechInterview/TechInterview';

const API_BASE = 'http://localhost:5000';

function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  
  // Settings State
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('hf_token') || '');
  const [modelName, setModelName] = useState('Qwen/Qwen2.5-7B-Instruct');
  const [showToken, setShowToken] = useState(false);
  const [dbStatus, setDbStatus] = useState('offline');
  const [hfStatus, setHfStatus] = useState('not_configured');
  const [hfTestResult, setHfTestResult] = useState(null);
  const [isTestingHf, setIsTestingHf] = useState(false);

  // Chat State
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [useRag, setUseRag] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  
  // Eligibility State
  const [cgpaInput, setCgpaInput] = useState('');
  const [branchInput, setBranchInput] = useState('CSE');
  const [backlogsInput, setBacklogsInput] = useState('0');
  const [eligibilityResults, setEligibilityResults] = useState([]);
  const [activeProcessCompany, setActiveProcessCompany] = useState(null);

  // FAQs, Tips & Docs State
  const [faqs, setFaqs] = useState([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaqId, setActiveFaqId] = useState(null);
  const [tips, setTips] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // -------------------------------------------------------------
  // NEW STATE: Resume Builder
  // -------------------------------------------------------------
  const [resumeSessionId, setResumeSessionId] = useState(null);
  const [resumeMessages, setResumeMessages] = useState([]);
  const [resumeData, setResumeData] = useState({
    personal_info: { name: "", email: "", phone: "", linkedin: "", location: "", website: "" },
    education: [],
    skills: [],
    experience: [],
    projects: [],
    certifications: [],
    summary: ""
  });
  const [resumeInput, setResumeInput] = useState('');
  const [isResumeTyping, setIsResumeTyping] = useState(false);
  const [activeResumeSection, setActiveResumeSection] = useState(null); // Accordion control

  // -------------------------------------------------------------
  // NEW STATE: Resume Analyzer
  // -------------------------------------------------------------
  const [analyzerFile, setAnalyzerFile] = useState(null);
  const [analyzerJd, setAnalyzerJd] = useState('');
  const [analyzerCompany, setAnalyzerCompany] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);

  // -------------------------------------------------------------
  // NEW STATE: Career Roadmap
  // -------------------------------------------------------------
  const [roadmapRole, setRoadmapRole] = useState('');
  const [roadmapData, setRoadmapData] = useState([]);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState(null);

  const messagesEndRef = useRef(null);
  const resumeMessagesEndRef = useRef(null);
  const roadmapRef = useRef(null);

  // Theme Effect
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Initial Setup: Check Connections & Load Data
  useEffect(() => {
    checkBackendConnection();
    checkHfConfig();
    loadFaqs();
    loadTips();
    loadSessions();
    loadUploadedDocs();
  }, []);

  // Auto-scroll General Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-scroll Resume Chat
  useEffect(() => {
    resumeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [resumeMessages, isResumeTyping]);

  // Session Change Effect
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Trigger Resume Builder load if selected
  useEffect(() => {
    if (activeTab === 'resume-builder' && !resumeSessionId) {
      handleNewResumeSession();
    }
  }, [activeTab]);

  // Check Backend Server & MongoDB Status
  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/companies`);
      if (response.ok) {
        setDbStatus('online');
        const comps = await response.json();
        if (comps.length > 0) {
          const results = comps.map(c => ({
            company_id: c._id,
            name: c.name,
            role: c.role,
            package: c.package,
            required_cgpa: c.cgpa,
            required_branches: c.branches,
            required_backlogs: c.backlogs_allowed,
            eligible: null,
            reason: "Enter details and click check eligibility"
          }));
          setEligibilityResults(results);
        }
      }
    } catch (err) {
      setDbStatus('offline');
    }
    
    const storedToken = localStorage.getItem('hf_token');
    if (storedToken && storedToken.trim().length > 0) {
      setHfStatus('warning');
    }
  };

  // Check server pre-configured HF configs
  const checkHfConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/hf-config`);
      if (response.ok) {
        const data = await response.json();
        if (data.token_configured) {
          setHfStatus('online');
          setModelName(prev => prev || data.model);
        } else {
          const storedToken = localStorage.getItem('hf_token');
          if (!storedToken || !storedToken.trim()) {
            setHfStatus('not_configured');
          }
        }
      }
    } catch (err) {
      console.error('Could not reach /api/hf-config:', err);
    }
  };

  // Fetch FAQs
  const loadFaqs = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/faqs`);
      if (response.ok) {
        const data = await response.json();
        setFaqs(data);
      }
    } catch (err) {
      console.error("Error loading FAQs:", err);
    }
  };

  // Fetch Tips
  const loadTips = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tips`);
      if (response.ok) {
        const data = await response.json();
        setTips(data);
      }
    } catch (err) {
      console.error("Error loading Tips:", err);
    }
  };

  // Fetch Chat Sessions
  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        if (data.length > 0) {
          setCurrentSessionId(data[0]._id);
        } else {
          handleNewSession();
        }
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    }
  };

  // Fetch Uploaded Docs
  const loadUploadedDocs = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/documents`);
      if (response.ok) {
        const data = await response.json();
        setUploadedDocs(data);
      }
    } catch (err) {
      console.error("Error loading docs:", err);
    }
  };

  // Fetch Messages for a specific session
  const loadMessages = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  // Create New Chat Session
  const handleNewSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat Session' })
      });
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession._id);
        setActiveTab('chat');
      }
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };

  // Delete Chat Session
  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation history?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s._id !== sessionId));
        if (currentSessionId === sessionId) {
          const remaining = sessions.filter(s => s._id !== sessionId);
          if (remaining.length > 0) {
            setCurrentSessionId(remaining[0]._id);
          } else {
            setCurrentSessionId(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  // Send Message inside placement Chatbot
  const handleSendMessage = async (textToSend) => {
    const messageContent = textToSend || chatInput;
    if (!messageContent.trim()) return;
    if (!currentSessionId) {
      alert("No active chat session. Please create one!");
      return;
    }

    const userMsg = {
      _id: Math.random().toString(),
      sender: 'user',
      text: messageContent,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          message: messageContent,
          hf_token: hfToken,
          model_name: modelName,
          use_rag: useRag
        })
      });
      if (response.ok) {
        const botReply = await response.json();
        setMessages(prev => [...prev, {
          _id: Math.random().toString(),
          sender: 'bot',
          text: botReply.message,
          timestamp: new Date().toISOString(),
          sources: botReply.retrieved_sources
        }]);
        const sessResp = await fetch(`${API_BASE}/api/sessions`);
        if (sessResp.ok) {
          const sessData = await sessResp.json();
          setSessions(sessData);
        }
      } else {
        const errorData = await response.json();
        setMessages(prev => [...prev, {
          _id: Math.random().toString(),
          sender: 'bot',
          text: `Error from backend: ${errorData.error || 'Unknown error'}`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        _id: Math.random().toString(),
        sender: 'bot',
        text: "Could not connect to the backend server. Make sure FastAPI server is running on localhost:5000.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Eligibility Checker
  const handleCheckEligibility = async (e) => {
    e.preventDefault();
    if (!cgpaInput) {
      alert("Please enter your CGPA!");
      return;
    }
    const cg = parseFloat(cgpaInput);
    if (isNaN(cg) || cg < 0 || cg > 10) {
      alert("Please enter a valid CGPA between 0 and 10!");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/check-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cgpa: cg,
          branch: branchInput,
          backlogs: parseInt(backlogsInput)
        })
      });
      if (response.ok) {
        const results = await response.json();
        setEligibilityResults(results);
      }
    } catch (err) {
      alert("Error checking eligibility. Backend is unreachable.");
    }
  };

  // File Upload RAG
  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first!");
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 80) return prev;
        return prev + 10;
      });
    }, 150);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      clearInterval(interval);
      setUploadProgress(100);

      const data = await response.json();
      if (response.ok) {
        setUploadResult({ status: 'success', message: data.message });
        setSelectedFile(null);
        loadUploadedDocs();
      } else {
        setUploadResult({ status: 'error', message: data.detail || 'Failed to parse file.' });
      }
    } catch (err) {
      clearInterval(interval);
      setUploadResult({ status: 'error', message: 'Connection to upload endpoint failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Test Hugging Face Connection
  const handleTestHfConnection = async () => {
    if (!hfToken.trim()) {
      alert("Enter a token in the Hugging Face Key field!");
      return;
    }
    setIsTestingHf(true);
    setHfTestResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hf_token: hfToken, model_name: modelName })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setHfTestResult({ status: 'success', message: data.message });
          setHfStatus('online');
        } else {
          setHfTestResult({ status: 'error', message: data.message });
          setHfStatus('offline');
        }
      } else {
        setHfTestResult({ status: 'error', message: 'HTTP request failed.' });
        setHfStatus('offline');
      }
    } catch (err) {
      setHfTestResult({ status: 'error', message: 'Could not connect to FastAPI server.' });
      setHfStatus('offline');
    } finally {
      setIsTestingHf(false);
    }
  };

  // Save Config Settings
  const handleSaveSettings = () => {
    localStorage.setItem('hf_token', hfToken);
    localStorage.setItem('model_name', modelName);
    alert("Settings saved locally successfully!");
    checkBackendConnection();
  };

  // Toggle Dark/Light Theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Format responses helper
  const renderFormattedText = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => {
      let cleanLine = line;
      let isBullet = false;
      let isNumbered = false;

      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        isBullet = true;
        cleanLine = line.trim().replace(/^[\*\-]\s+/, '');
      } else if (line.trim().match(/^\d+\.\s+/)) {
        isNumbered = true;
        cleanLine = line.trim().replace(/^\d+\.\s+/, '');
      }

      let isItalicLine = false;
      if (cleanLine.trim().startsWith('*') && cleanLine.trim().endsWith('*') && !cleanLine.includes('**')) {
        isItalicLine = true;
        cleanLine = cleanLine.trim().slice(1, -1);
      }

      const parts = cleanLine.split('**');
      const lineContent = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx}>{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={idx} style={{ marginLeft: '16px', listStyleType: 'disc', margin: '4px 0' }}>
            {lineContent}
          </li>
        );
      }
      if (isNumbered) {
        return (
          <li key={idx} style={{ marginLeft: '16px', listStyleType: 'decimal', margin: '4px 0' }}>
            {lineContent}
          </li>
        );
      }
      if (isItalicLine) {
        return (
          <p key={idx} style={{ margin: '4px 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            {lineContent}
          </p>
        );
      }
      return <p key={idx} style={{ margin: '4px 0' }}>{lineContent}</p>;
    });
  };

  // -------------------------------------------------------------
  // NEW HANDLERS: Resume Builder
  // -------------------------------------------------------------
  const handleNewResumeSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/resume/builder/session`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setResumeSessionId(data.session_id);
        setResumeData(data.resume_data);
        setResumeMessages(data.messages);
      }
    } catch (err) {
      console.error("Could not create resume building session:", err);
    }
  };

  const handleSendResumeMessage = async () => {
    if (!resumeInput.trim() || !resumeSessionId) return;
    
    const userMsgText = resumeInput;
    setResumeInput('');
    setResumeMessages(prev => [...prev, {
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toISOString()
    }]);
    setIsResumeTyping(true);

    try {
      const response = await fetch(`${API_BASE}/api/resume/builder/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: resumeSessionId,
          message: userMsgText,
          hf_token: hfToken,
          model_name: modelName
        })
      });
      if (response.ok) {
        const data = await response.json();
        setResumeMessages(prev => [...prev, {
          sender: 'bot',
          text: data.message,
          timestamp: new Date().toISOString()
        }]);
        setResumeData(data.resume_data);
      }
    } catch (err) {
      console.error("Error communicating with resume builder API:", err);
    } finally {
      setIsResumeTyping(false);
    }
  };

  const handleResumeManualUpdate = async (updatedFields) => {
    const freshData = { ...resumeData, ...updatedFields };
    setResumeData(freshData);
    try {
      await fetch(`${API_BASE}/api/resume/builder/session/${resumeSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freshData)
      });
    } catch (err) {
      console.error("Failed to update manual changes in backend database:", err);
    }
  };

  const handleAddEducation = () => {
    const list = [...(resumeData.education || [])];
    list.push({ degree: "", field_of_study: "", school: "", graduation_year: "", gpa: "" });
    handleResumeManualUpdate({ education: list });
  };

  const handleRemoveEducation = (index) => {
    const list = (resumeData.education || []).filter((_, i) => i !== index);
    handleResumeManualUpdate({ education: list });
  };

  const handleAddExperience = () => {
    const list = [...(resumeData.experience || [])];
    list.push({ role: "", company: "", location: "", duration: "", description: "" });
    handleResumeManualUpdate({ experience: list });
  };

  const handleRemoveExperience = (index) => {
    const list = (resumeData.experience || []).filter((_, i) => i !== index);
    handleResumeManualUpdate({ experience: list });
  };

  const handleAddProject = () => {
    const list = [...(resumeData.projects || [])];
    list.push({ title: "", technologies: [], description: "", link: "" });
    handleResumeManualUpdate({ projects: list });
  };

  const handleRemoveProject = (index) => {
    const list = (resumeData.projects || []).filter((_, i) => i !== index);
    handleResumeManualUpdate({ projects: list });
  };

  const handleExportResume = (format) => {
    if (!resumeSessionId) return;
    window.open(`${API_BASE}/api/resume/export/${resumeSessionId}/${format}`, '_blank');
  };

  // -------------------------------------------------------------
  // NEW HANDLERS: Resume Analyzer
  // -------------------------------------------------------------
  const handleAnalyzeResume = async (e) => {
    e.preventDefault();
    if (!analyzerFile) {
      alert("Please upload a PDF/DOCX resume file!");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setOptimizationResult(null);

    const formData = new FormData();
    formData.append("file", analyzerFile);
    if (analyzerJd) formData.append("job_description", analyzerJd);
    if (analyzerCompany) formData.append("target_company", analyzerCompany);
    if (hfToken) {
      formData.append("hf_token", hfToken);
      formData.append("model_name", modelName);
    }

    try {
      const response = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data);
      } else {
        alert("Server failed to analyze the document.");
      }
    } catch (err) {
      alert("Connection failure trying to reach /api/resume/analyze.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOptimizeResume = async () => {
    if (!analysisResult) return;
    setIsOptimizing(true);
    setOptimizationResult(null);

    // Prepare resume details for optimizations (fallback to standard builder details or construct mock)
    const optimizationPayload = {
      resume_data: resumeSessionId ? resumeData : {
        personal_info: { name: analyzerFile.name.replace(/\.[^/.]+$/, "") },
        projects: (analysisResult.strengths || []).map(s => ({ title: "Core Project", description: s })),
        skills: analysisResult.matching_keywords || []
      },
      company_name: analyzerCompany || "Microsoft",
      role_name: "Software Engineer",
      hf_token: hfToken,
      model_name: modelName
    };

    try {
      const response = await fetch(`${API_BASE}/api/resume/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optimizationPayload)
      });
      if (response.ok) {
        const data = await response.json();
        setOptimizationResult(data);
      }
    } catch (err) {
      console.error("Optimization failed:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // Generate Career Roadmap
  const handleGenerateRoadmap = async (e) => {
    if (e) e.preventDefault();
    if (!roadmapRole.trim()) {
      alert("Please enter a role!");
      return;
    }
    setIsRoadmapLoading(true);
    setRoadmapError(null);
    setRoadmapData([]);

    try {
      const response = await fetch(`${API_BASE}/api/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roadmapRole,
          hf_token: hfToken,
          model_name: modelName
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setRoadmapData(data.roadmap);
        } else {
          setRoadmapError("Failed to generate roadmap content.");
        }
      } else {
        const err = await response.json();
        setRoadmapError(err.detail || "Server error while generating roadmap.");
      }
    } catch (err) {
      setRoadmapError("Connection to backend server failed.");
    } finally {
      setIsRoadmapLoading(false);
    }
  };

  // Helper: wrap text into lines that fit a given pixel width
  const wrapText = (ctx, text, maxCharsPerLine, maxWidth) => {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  };

  // Generate infographic of the roadmap and trigger download
  const downloadRoadmapInfographic = async () => {
    if (!roadmapData || roadmapData.length === 0) {
      alert('No roadmap data to generate infographic.');
      return;
    }
    if (!roadmapRef.current) {
      alert('Unable to generate infographic. Please try again.');
      return;
    }
    
    try {
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default;
      
      // Temporarily hide the download button so it's not in the image
      const btn = roadmapRef.current.querySelector('button');
      if (btn) btn.style.display = 'none';
      
      // Use html2canvas with a specific clone callback to strip styles that cause blank images
      const canvas = await html2canvas(roadmapRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.body.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff',
        onclone: (doc) => {
          // html2canvas fails silently on backdrop-filter and complex flex margins, rendering them completely blank.
          // By stripping the blur from the clone specifically, it captures the cards normally.
          const cards = doc.querySelectorAll('.glass-card');
          cards.forEach(card => {
            card.style.backdropFilter = 'none';
            card.style.webkitBackdropFilter = 'none';
            // Force a slightly opaque solid background for the capture to mimic the glass effect
            card.style.backgroundColor = document.body.getAttribute('data-theme') === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(248, 250, 252, 0.95)';
          });
          
          // Ensure padding/margins don't cut off content
          doc.body.style.margin = '0';
          doc.body.style.padding = '20px';
        }
      });
      
      // Restore button
      if (btn) btn.style.display = '';
      
      const imgData = canvas.toDataURL('image/png');
      
      if (!imgData || imgData === 'data:,') {
         throw new Error('Blank image generated');
      }
      
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `roadmap_${roadmapRole.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error capturing roadmap:', err);
      alert('Unable to generate infographic. Please try again.');
      
      const btn = roadmapRef.current.querySelector('button');
      if (btn) btn.style.display = '';
    }
  };

  // Filters FAQ list
  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
    f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.category.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const faqCategories = filteredFaqs.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  function getRecruitmentProcessText(name) {
    if (name === "Microsoft") return "1. Online Assessment (3 Coding Questions on DS/Algo)\n2. Technical Round 1 (System Design & Code Optimization)\n3. Technical Round 2 (Algorithms & Problem Solving)\n4. Hiring Manager / Cultural Fit Round";
    if (name === "Amazon") return "1. Online Assessment (Debugging + Coding + Work Style Simulation)\n2. Technical Round 1 (Data Structures, Algorithms & Leadership Principles)\n3. Technical Round 2 (Deep dive into project architecture & coding)\n4. Bar Raiser Round (General intelligence & culture fit)";
    if (name === "Google") return "1. Online Coding Challenge (Google Online Challenge)\n2. Technical Round 1 (Advanced Data Structures - Graphs, DP)\n3. Technical Round 2 (Ad-hoc Algorithms & Complexity analysis)\n4. Technical Round 3 (System design & scaling)\n5. Googleyness & Leadership Round";
    if (name === "TCS") return "1. TCS NQT (National Qualifier Test) - Aptitude, Reasoning, Coding\n2. Technical Interview (Fundamentals of OOPS, DBMS, SQL, Basic coding)\n3. HR & Managerial Interview";
    if (name === "Accenture") return "1. Cognitive and Technical Assessment\n2. Coding Assessment (2 questions)\n3. Communication Assessment\n4. Technical & HR Interview (Combined)";
    if (name === "Adobe") return "1. Online Aptitude & Coding Test\n2. Technical Interview 1 (OOPs design, DS/Algo)\n3. Technical Interview 2 (Data structures & system performance optimization)\n4. HR Interview";
    return "1. Resume Screening\n2. Technical Written / Coding Test\n3. Interview Round";
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-section">
            <div className="brand-logo-container">
              <span className="brand-logo">🎓</span>
            </div>
            <div className="brand-info">
              <h2>Apex Portal</h2>
              <p>Placement Coordinator</p>
            </div>
          </div>

          <ul className="nav-links">
            <li>
              <button 
                onClick={() => setActiveTab('chat')} 
                className={`nav-item-btn ${activeTab === 'chat' ? 'active' : ''}`}
              >
                <span>💬</span> Placement Assistant
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('tech-interview')} 
                className={`nav-item-btn ${activeTab === 'tech-interview' ? 'active' : ''}`}
              >
                <span>💻</span> Tech Interview
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('resume-builder')} 
                className={`nav-item-btn ${activeTab === 'resume-builder' ? 'active' : ''}`}
              >
                <span>📝</span> Resume Builder
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('resume-analyzer')} 
                className={`nav-item-btn ${activeTab === 'resume-analyzer' ? 'active' : ''}`}
              >
                <span>📊</span> Resume Analyzer
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('eligibility')} 
                className={`nav-item-btn ${activeTab === 'eligibility' ? 'active' : ''}`}
              >
                <span>✅</span> Eligibility Checker
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('roadmap')} 
                className={`nav-item-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
              >
                <span>🗺️</span> Career Roadmap
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('interview')} 
                className={`nav-item-btn ${activeTab === 'interview' ? 'active' : ''}`}
              >
                <span>🎤</span> AI Mock Interview
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('faqs')} 
                className={`nav-item-btn ${activeTab === 'faqs' ? 'active' : ''}`}
              >
                <span>❓</span> FAQs Hub
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('tips')} 
                className={`nav-item-btn ${activeTab === 'tips' ? 'active' : ''}`}
              >
                <span>💡</span> Preparation Tips
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('documents')} 
                className={`nav-item-btn ${activeTab === 'documents' ? 'active' : ''}`}
              >
                <span>📁</span> Document Center
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('settings')} 
                className={`nav-item-btn ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <span>⚙️</span> Portal Settings
              </button>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className={`status-dot ${dbStatus === 'online' ? 'online' : 'offline'}`}></span>
            <span>MongoDB: {dbStatus === 'online' ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="status-badge">
            <span className={`status-dot ${hfStatus === 'online' ? 'online' : hfStatus === 'warning' ? 'warning' : 'offline'}`}></span>
            <span>Hugging Face: {hfStatus === 'online' ? 'Connected' : hfStatus === 'warning' ? 'Configured' : 'Not Linked'}</span>
          </div>

          <div className="footer-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Light/Dark Mode">
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="tab-header">
          <div className="tab-title">
            <h1>
              {activeTab === 'chat' && 'Placement Assistant'}
              {activeTab === 'resume-builder' && 'Conversational Resume Builder'}
              {activeTab === 'resume-analyzer' && 'ATS Resume Analyzer'}
              {activeTab === 'eligibility' && 'Eligibility Checker'}
              {activeTab === 'roadmap' && 'AI Career Roadmap'}
              {activeTab === 'interview' && 'AI Mock Interview'}
              {activeTab === 'tech-interview' && '💻 Tech Interview (Python + DSA)'}
              {activeTab === 'faqs' && 'Placement FAQ Database'}
              {activeTab === 'tips' && 'Resume & Interview Hub'}
              {activeTab === 'documents' && 'Knowledge Retrieval Center (RAG)'}
              {activeTab === 'settings' && 'System Configuration'}
            </h1>
            <p>
              {activeTab === 'chat' && 'Chat with our AI bot powered by Hugging Face to get instant guideline answers.'}
              {activeTab === 'resume-builder' && 'Chat with the assistant to populate fields and live preview your ATS-friendly resume.'}
              {activeTab === 'resume-analyzer' && 'Audit your resume matching quality against job criteria and company recruitment standards.'}
              {activeTab === 'eligibility' && 'Verify your recruitment qualifications against top recruiters in real-time.'}
              {activeTab === 'roadmap' && 'Generate a structured chronological phase-by-phase learning path for any domain.'}
              {activeTab === 'interview' && 'Practice interviews with AI-generated questions and real-time feedback.'}
              {activeTab === 'tech-interview' && 'Interactive coding interview with a code editor, real-time code execution, and technical evaluation.'}
              {activeTab === 'faqs' && 'Browse common queries regarding rules, backlogs, and interview slots.'}
              {activeTab === 'tips' && 'Get industry-standard tips for structuring resumes and handling interviews.'}
              {activeTab === 'documents' && 'Upload placement PDFs/Docs to automatically index them into FAISS.'}
              {activeTab === 'settings' && 'Configure Hugging Face models, API keys, and check server runtimes.'}
            </p>
          </div>
        </header>

        <div className="tab-panel">
          
          {activeTab === 'interview' && <MockInterview />}

        {activeTab === 'tech-interview' && (
          <TechInterview
            hfToken={hfToken}
            modelName={modelName}
            onBackToDashboard={() => setActiveTab('chat')}
          />
        )}

        {/* ============================================================== */}
        {/* RESUME BUILDER VIEW                                            */}
          
          {/* TAB 1: CHATROOM PLACEMENT ASSISTANT */}
          {activeTab === 'chat' && (
            <div className="chat-layout">
              <div className="chat-sessions-sidebar">
                <div className="sessions-header">
                  <button className="new-chat-btn" onClick={handleNewSession}>
                    ➕ New Chat
                  </button>
                </div>
                <div className="sessions-list-container">
                  {sessions.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No chats found.
                    </div>
                  ) : (
                    sessions.map(s => (
                      <div 
                        key={s._id} 
                        className={`session-item ${currentSessionId === s._id ? 'active' : ''}`}
                        onClick={() => setCurrentSessionId(s._id)}
                      >
                        <span className="session-title">{s.title}</span>
                        <button className="delete-session-btn" onClick={(e) => handleDeleteSession(s._id, e)}>
                          🗑️
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="chat-arena">
                <div className="chat-messages-container">
                  {messages.length === 0 && !isTyping ? (
                    <div className="chat-welcome-screen">
                      <div className="welcome-logo">🤖</div>
                      <h2>Apex Placement Cell AI</h2>
                      <p>
                        Ask me anything about college placements, company criteria, Dream/Super Dream policies, or resumes.
                        Toggle the RAG switch to search uploaded document data.
                      </p>

                      <div className="suggested-pills-container">
                        <button 
                          className="suggested-pill" 
                          onClick={() => handleSendMessage("What is the Dream Offer policy?")}
                        >
                          👉 What is the Dream Offer policy?
                        </button>
                        <button 
                          className="suggested-pill" 
                          onClick={() => handleSendMessage("What CGPA does Microsoft require?")}
                        >
                          👉 Microsoft's CGPA requirement?
                        </button>
                        <button 
                          className="suggested-pill" 
                          onClick={() => handleSendMessage("Can I apply with 1 active backlog?")}
                        >
                          👉 Can I apply with active backlogs?
                        </button>
                      </div>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m._id} className={`message-bubble ${m.sender}`}>
                        {renderFormattedText(m.text)}
                        {m.sources && m.sources.length > 0 && (
                          <div className="message-sources">
                            Retrieved from: {m.sources.map((s, sIdx) => <span key={sIdx}>{s}</span>)}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {isTyping && (
                    <div className="typing-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-container">
                  <div className="chat-input-bar-wrapper">
                    <div className="rag-toggle-wrapper">
                      <label className="rag-label" htmlFor="rag-toggle" title="Search database context and uploaded documents">
                        RAG Search:
                      </label>
                      <label className="checkbox-switch">
                        <input 
                          type="checkbox" 
                          id="rag-toggle" 
                          checked={useRag}
                          onChange={(e) => setUseRag(e.target.checked)}
                        />
                        <span className="slider-switch"></span>
                      </label>
                    </div>

                    <input 
                      type="text" 
                      className="chat-input-field" 
                      placeholder="Ask your placement question here..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                      disabled={isTyping}
                    />

                    <button 
                      className="send-message-btn" 
                      onClick={() => handleSendMessage()}
                      disabled={isTyping || !chatInput.trim()}
                    >
                      ✈️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONVERSATIONAL RESUME BUILDER */}
          {activeTab === 'resume-builder' && (
            <ResumeBuilder hfToken={hfToken} modelName={modelName} />
          )}
          {/* TAB 3: RESUME ANALYZER */}
          {activeTab === 'resume-analyzer' && (
            <div className="analyzer-layout">
              {/* Setup column */}
              <div className="analyzer-setup-card glass-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Upload & Set Targets</h3>
                
                <form onSubmit={handleAnalyzeResume} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div 
                    className="file-drag-zone"
                    onClick={() => document.getElementById('analyzer-file-input').click()}
                  >
                    <span className="file-drag-icon">📄</span>
                    {analyzerFile ? (
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--success)' }}>{analyzerFile.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(analyzerFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontWeight: 600 }}>Click to Choose Resume</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PDF, DOCX or TXT files</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="analyzer-file-input" 
                      style={{ display: 'none' }}
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setAnalyzerFile(e.target.files[0])}
                    />
                  </div>

                  <div className="form-group">
                    <label>Target Placement Company</label>
                    <select 
                      className="form-select"
                      value={analyzerCompany}
                      onChange={(e) => setAnalyzerCompany(e.target.value)}
                    >
                      <option value="">-- Choose Target Company --</option>
                      <option value="Microsoft">Microsoft</option>
                      <option value="Amazon">Amazon</option>
                      <option value="Google">Google</option>
                      <option value="TCS">TCS</option>
                      <option value="Accenture">Accenture</option>
                      <option value="Adobe">Adobe</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Target Job Description (JD)</label>
                    <textarea 
                      className="form-input" 
                      rows="6"
                      placeholder="Paste details of the role description, qualifications, and keywords..."
                      value={analyzerJd}
                      onChange={(e) => setAnalyzerJd(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="eligibility-btn" disabled={isAnalyzing}>
                    {isAnalyzing ? "Auditing Document..." : "🔍 Run ATS Resume Audit"}
                  </button>
                </form>
              </div>

              {/* Dashboard Result column */}
              <div>
                {!analysisResult && !isAnalyzing && (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📊</span>
                    <h2>Resume Analysis Report</h2>
                    <p style={{ maxWidth: '460px', margin: '8px auto 0', fontSize: '14px' }}>
                      Upload your current resume file and enter details of your target position. 
                      Our parser will calculate your ATS match score, extract missing keywords, and suggest improvements.
                    </p>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div className="typing-bubble" style={{ margin: '0 auto 16px', float: 'none' }}>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                    <h2>Auditing Document...</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
                      Extracting text content, mapping layout hierarchies, and matching job keywords using our algorithms.
                    </p>
                  </div>
                )}

                {analysisResult && (
                  <div className="glass-card">
                    <div className="dashboard-grid">
                      {/* Score circle */}
                      <div className="score-widget">
                        <div className="circular-gauge">
                          <svg width="150" height="150">
                            <circle className="circular-gauge-bg" cx="75" cy="75" r="60" />
                            <circle 
                              className={`circular-gauge-fill ${analysisResult.ats_score >= 80 ? 'high' : analysisResult.ats_score >= 50 ? 'mid' : 'low'}`} 
                              cx="75" 
                              cy="75" 
                              r="60" 
                              strokeDasharray="377" 
                              strokeDashoffset={377 - (377 * analysisResult.ats_score) / 100}
                            />
                          </svg>
                          <div className="gauge-text" style={{ color: analysisResult.ats_score >= 80 ? 'var(--success)' : analysisResult.ats_score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                            {analysisResult.ats_score}
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ATS Match Score</span>
                      </div>

                      {/* Summary Analysis */}
                      <div>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>Recruiter Fit Analysis</h3>
                        <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                          {analysisResult.company_fit_analysis}
                        </p>
                        
                        <div style={{ marginTop: '16px', display: 'flex', gap: '20px' }}>
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Strengths</span>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
                              {(analysisResult.strengths || []).length} Points
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Suggestions</span>
                            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--warning)' }}>
                              {(analysisResult.improvements || []).length} Actions
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                      {/* Matching Keywords */}
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>Matching Keywords</h4>
                        <div className="pills-container">
                          {(analysisResult.matching_keywords || []).length === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No keywords matched yet.</span>
                          ) : (
                            analysisResult.matching_keywords.map((kw, idx) => (
                              <span key={idx} className="keyword-pill match">✓ {kw}</span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Missing Keywords */}
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>Missing Target Keywords</h4>
                        <div className="pills-container">
                          {(analysisResult.missing_keywords || []).length === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Excellent, no key keywords missing!</span>
                          ) : (
                            analysisResult.missing_keywords.map((kw, idx) => (
                              <span key={idx} className="keyword-pill missing">✗ {kw}</span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actionable Suggestions */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
                      <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '10px' }}>Actionable Improvements</h4>
                      <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(analysisResult.improvements || []).map((tip, idx) => (
                          <li key={idx} style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* AI Company Optimization Section */}
                    {analyzerCompany && (
                      <div className="optimize-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Tailored Bullet Point Suggestions for {analyzerCompany}</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Optimize your description sentences with metrics tailored for {analyzerCompany} interview standards.
                            </p>
                          </div>
                          <button className="action-btn primary" onClick={handleOptimizeResume} disabled={isOptimizing}>
                            {isOptimizing ? "Optimizing..." : "🚀 Optimize Bullets"}
                          </button>
                        </div>

                        {optimizationResult && (
                          <div style={{ marginTop: '16px' }}>
                            <div className="bullet-item-rewrite" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--accent-secondary)' }}>Suggested Summary Suggestion:</strong>
                              <p style={{ fontSize: '13.5px', marginTop: '4px', color: 'var(--text-primary)' }}>
                                {optimizationResult.summary_suggestion}
                              </p>
                              <button 
                                className="copy-bullet-btn" 
                                style={{ marginTop: '6px' }}
                                onClick={() => handleCopyText(optimizationResult.summary_suggestion)}
                              >
                                Copy Summary
                              </button>
                            </div>

                            {optimizationResult.project_bullet_improvements && optimizationResult.project_bullet_improvements.map((proj, pIdx) => (
                              <div key={pIdx} style={{ marginTop: '14px' }}>
                                <strong style={{ fontSize: '13.5px' }}>Project: {proj.original_project_title}</strong>
                                {proj.suggested_bullet_rewrites && proj.suggested_bullet_rewrites.map((bullet, bIdx) => (
                                  <div key={bIdx} className="bullet-item-rewrite">
                                    <p className="suggested-bullet">
                                      <span>&bull; {bullet}</span>
                                      <button className="copy-bullet-btn" onClick={() => handleCopyText(bullet)}>
                                        Copy Bullet
                                      </button>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ELIGIBILITY CHECKER */}
          {activeTab === 'eligibility' && (
            <div className="eligibility-layout">
              <div className="glass-card">
                <form onSubmit={handleCheckEligibility}>
                  <div className="form-group">
                    <label>Cumulative GPA (CGPA)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 8.25" 
                      step="0.01" 
                      min="0" 
                      max="10" 
                      value={cgpaInput}
                      onChange={(e) => setCgpaInput(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Engineering Branch</label>
                    <select 
                      className="form-select"
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                    >
                      <option value="CSE">Computer Science (CSE)</option>
                      <option value="ISE">Information Science (ISE)</option>
                      <option value="ECE">Electronics & Communication (ECE)</option>
                      <option value="EEE">Electrical & Electronics (EEE)</option>
                      <option value="MECH">Mechanical Eng. (MECH)</option>
                      <option value="CIVIL">Civil Eng. (CIVIL)</option>
                      <option value="CHEM">Chemical Eng. (CHEM)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Active Backlogs</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 0" 
                      min="0" 
                      max="10" 
                      value={backlogsInput}
                      onChange={(e) => setBacklogsInput(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="eligibility-btn">
                    🔍 Check Eligibility
                  </button>
                </form>
              </div>

              <div className="company-grid-container">
                {eligibilityResults.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    MongoDB server is offline or loading company recruitment details. Make sure database sample is seeded.
                  </div>
                ) : (
                  <div className="company-grid">
                    {eligibilityResults.map((c) => {
                      const isEligible = c.eligible;
                      return (
                        <div 
                          key={c.company_id} 
                          className={`glass-card company-card ${isEligible === true ? 'eligible' : isEligible === false ? 'not-eligible' : ''}`}
                        >
                          <div className="company-card-header">
                            <div className="company-initial">
                              {c.name.charAt(0)}
                            </div>
                            <div className="company-title">
                              <h3>{c.name}</h3>
                              <p>{c.role}</p>
                            </div>
                          </div>

                          <div className="company-details-row">
                            <span className="company-details-label">CTC Offer Package:</span>
                            <span className="company-details-value" style={{ color: 'var(--accent-secondary)' }}>
                              {c.package}
                            </span>
                          </div>
                          
                          <div className="company-details-row">
                            <span className="company-details-label">Required CGPA:</span>
                            <span className="company-details-value">{c.required_cgpa}</span>
                          </div>

                          <div className="company-details-row">
                            <span className="company-details-label">Backlogs Limit:</span>
                            <span className="company-details-value">{c.required_backlogs} allowed</span>
                          </div>

                          {isEligible !== null && (
                            <div className={`company-badge-status ${isEligible ? 'eligible' : 'not-eligible'}`}>
                              {isEligible ? '✅ Eligible' : '❌ Blocked'}
                            </div>
                          )}

                          {isEligible === false && (
                            <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '8px', fontWeight: '500' }}>
                              Reason: {c.reason}
                            </p>
                          )}

                          <div className="company-card-footer">
                            <button 
                              className="process-toggle-btn"
                              onClick={() => setActiveProcessCompany(activeProcessCompany === c.company_id ? null : c.company_id)}
                            >
                              {activeProcessCompany === c.company_id ? '🔽 Hide Selection Details' : '▶️ Show Selection Details'}
                            </button>
                            {activeProcessCompany === c.company_id && (
                              <div className="process-text">
                                {c.name} Recruitment Steps:
                                {renderFormattedText(dbStatus === 'online' ? faqs.length > 0 ? getRecruitmentProcessText(c.name) : '' : '')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: CAREER ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="roadmap-layout-wrapper">
              <div className="glass-card roadmap-search-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Generate Learning Path</h3>
                <form onSubmit={handleGenerateRoadmap} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flexGrow: 1, margin: 0 }}>
                    <label htmlFor="roadmap-role-input">Enter Target Profession / Role</label>
                    <input 
                      type="text" 
                      id="roadmap-role-input"
                      className="form-input" 
                      placeholder="e.g., Full Stack Engineer, Cloud Architect, AI Specialist..." 
                      value={roadmapRole}
                      onChange={(e) => setRoadmapRole(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="eligibility-btn" style={{ width: 'auto', minWidth: '180px', height: '46px' }} disabled={isRoadmapLoading}>
                    {isRoadmapLoading ? "Generating..." : "🗺️ Get Career Path"}
                  </button>
                </form>
              </div>

              {isRoadmapLoading && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="typing-bubble" style={{ margin: '0 auto 16px', float: 'none' }}>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                  <h2>Curating Learning Milestones...</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
                    Querying model to outline specialized skills, phase durations, and educational objectives.
                  </p>
                </div>
              )}

              {roadmapError && (
                <div
                  className={`alert ${roadmapData && roadmapData.length > 0 ? 'warning' : 'error'}`}
                  style={{ marginBottom: '24px' }}
                >
                  {roadmapError}
                </div>
              )}

              {roadmapData && roadmapData.length > 0 && (
                <div className="roadmap-timeline-section" ref={roadmapRef}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                      Roadmap for <span style={{ color: 'var(--accent-primary)' }}>{roadmapRole}</span>
                    </h2>
                    <button
                      className="action-btn primary"
                      onClick={downloadRoadmapInfographic}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}
                    >
                      📥 Download Infographic
                    </button>
                  </div>
                  <div className="timeline-container">
                    {roadmapData.map((phase, idx) => (
                      <div className="timeline-item" key={idx}>
                        <div className="timeline-badge">
                          {idx + 1}
                        </div>
                        <div className="timeline-panel glass-card">
                          <div className="timeline-header">
                            <h3 className="timeline-phase-title">{phase.title}</h3>
                            <span className="phase-duration-badge">{phase.duration}</span>
                          </div>
                          <p className="timeline-phase-desc">{phase.description}</p>
                          {phase.skills && phase.skills.length > 0 && (
                            <div className="timeline-skills-container">
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Core Skills:</span>
                              <div className="pills-container" style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {phase.skills.map((skill, sIdx) => (
                                  <span className="skill-tag-pill" key={sIdx}>
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isRoadmapLoading && roadmapData.length === 0 && !roadmapError && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🗺️</span>
                  <h2>Interactive Learning Path Explorer</h2>
                  <p style={{ maxWidth: '500px', margin: '8px auto 0', fontSize: '14.5px', lineHeight: '1.6' }}>
                    Type the specific tech or business career role you are interested in above. 
                    The RAG/LLM backend will build a custom timeline showing milestones, recommended timelines, and targeted skill badges.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FAQs ACCORDION */}
          {activeTab === 'faqs' && (
            <div>
              <div className="faq-search-wrapper">
                <input 
                  type="text" 
                  className="faq-search-input" 
                  placeholder="Search placement rules, criteria, eligibility, or policies..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                />
              </div>

              {faqs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No FAQs available. Make sure FastAPI server is seeded.
                </div>
              ) : (
                Object.keys(faqCategories).map((category) => (
                  <div key={category} className="faq-category-section">
                    <h2 className="faq-category-title">
                      📁 {category}
                    </h2>
                    
                    <div className="faq-accordion-container">
                      {faqCategories[category].map((item) => (
                        <div 
                          key={item._id} 
                          className={`faq-item ${activeFaqId === item._id ? 'active' : ''}`}
                        >
                          <button 
                            className="faq-question-bar"
                            onClick={() => setActiveFaqId(activeFaqId === item._id ? null : item._id)}
                          >
                            <span>{item.question}</span>
                            <span className="faq-arrow">▼</span>
                          </button>
                          
                          {activeFaqId === item._id && (
                            <div className="faq-answer-panel">
                              {renderFormattedText(item.answer)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: PREPARATION TIPS HUB */}
          {activeTab === 'tips' && (
            <div className="tips-grid">
              {tips.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '32px', color: 'var(--text-secondary)' }}>
                  No preparation guides available. Connect your server to load sample data.
                </div>
              ) : (
                tips.map((tip) => (
                  <div key={tip._id} className="glass-card tip-card">
                    <div className="tip-card-header">
                      <h3 className="tip-card-title">{tip.title}</h3>
                      <span className="tip-category-tag">{tip.category}</span>
                    </div>
                    <div className="tip-content-body">
                      {renderFormattedText(tip.content)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 7: DOCUMENT CENTER (RAG) */}
          {activeTab === 'documents' && (
            <div className="document-layout">
              <div>
                <div className="glass-card">
                  <div 
                    className="upload-zone"
                    onClick={() => document.getElementById('file-input-el').click()}
                  >
                    <span className="upload-icon">📤</span>
                    <h3>Drag & Drop or Click to Select File</h3>
                    <p>Supports PDF, Word (DOCX) or Text (TXT) up to 16MB</p>
                    <input 
                      type="file" 
                      id="file-input-el" 
                      className="file-input"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                    />
                  </div>

                  {selectedFile && (
                    <div className="selected-file-card">
                      <div className="selected-file-info">
                        <span>📄</span>
                        <div>
                          <p className="file-name">{selectedFile.name}</p>
                          <p className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button className="remove-file-btn" onClick={() => setSelectedFile(null)}>
                        ✕
                      </button>
                    </div>
                  )}

                  {selectedFile && (
                    <button 
                      className="eligibility-btn" 
                      style={{ marginTop: '20px' }}
                      onClick={handleFileUpload}
                      disabled={isUploading}
                    >
                      🚀 {isUploading ? 'Parsing & Indexing...' : 'Upload & Parse Context'}
                    </button>
                  )}

                  {isUploading && (
                    <div className="upload-progress-bar-wrapper">
                      <div className="upload-progress-label">
                        <span>Splitting content and embedding into FAISS</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="upload-progress-track">
                        <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {uploadResult && (
                    <div className={`alert ${uploadResult.status}`}>
                      {uploadResult.message}
                    </div>
                  )}
                </div>

                <div className="glass-card">
                  <h3 style={{ marginBottom: '16px', fontSize: '17px', fontWeight: '700' }}>Indexed Documents</h3>
                  
                  {uploadedDocs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
                      No custom documents uploaded yet. RAG is currently retrieving from seeded database entries only.
                    </p>
                  ) : (
                    <div className="uploaded-docs-list">
                      {uploadedDocs.map((doc) => (
                        <div key={doc._id} className="uploaded-doc-item">
                          <div className="doc-info">
                            <h4>{doc.filename}</h4>
                            <p>Uploaded: {new Date(doc.upload_date).toLocaleDateString()}</p>
                          </div>
                          <div className="doc-chunks">
                            {doc.chunk_count} chunks
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card rag-explanation-card">
                <h3>RAG Retrieval Flow</h3>
                <p>
                  Retrieval-Augmented Generation (RAG) lets you ground the Hugging Face AI response in verified documents.
                </p>

                <ol className="rag-steps">
                  <li className="rag-step-item">
                    <span className="rag-step-num">1</span>
                    <div>
                      <strong>Chunk Extraction</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Uploaded files are parsed and split into overlapping 500-character segments.
                      </p>
                    </div>
                  </li>
                  <li className="rag-step-item">
                    <span className="rag-step-num">2</span>
                    <div>
                      <strong>Vectorization</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Local model converts segments to 384-dimension semantic vectors.
                      </p>
                    </div>
                  </li>
                  <li className="rag-step-item">
                    <span className="rag-step-num">3</span>
                    <div>
                      <strong>FAISS Indexing</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Vectors are indexed in a local vector database for similarity matching.
                      </p>
                    </div>
                  </li>
                  <li className="rag-step-item">
                    <span className="rag-step-num">4</span>
                    <div>
                      <strong>Grounding Search</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        When you chat, relevant chunks are appended to the AI prompt context.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 8: PORTAL SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '650px' }}>
              <div className="glass-card">
                <h3 className="settings-section-title">🔌 Server & API Verification</h3>
                
                <div className="settings-info-list" style={{ marginBottom: '20px' }}>
                  <div className="settings-info-item">
                    <span className="settings-info-label">FastAPI Server IP:</span>
                    <span className="settings-info-value">http://localhost:5000</span>
                  </div>
                  <div className="settings-info-item">
                    <span className="settings-info-label">MongoDB Status:</span>
                    <span className="settings-info-value" style={{ color: dbStatus === 'online' ? 'var(--success)' : 'var(--danger)' }}>
                      ● {dbStatus === 'online' ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="settings-info-item">
                    <span className="settings-info-label">FAISS Core Support:</span>
                    <span className="settings-info-value" style={{ color: 'var(--success)' }}>
                      ● Enabled (NumPy fallback supported)
                    </span>
                  </div>
                </div>

                <button className="test-conn-btn" onClick={checkBackendConnection}>
                  🔄 Recheck Connection Status
                </button>
              </div>

              <div className="glass-card">
                <h3 className="settings-section-title">🤗 Hugging Face Integration</h3>

                {hfStatus === 'online' && !hfToken && (
                  <div className="alert success" style={{ marginBottom: '16px' }}>
                    ✅ Server is pre-configured with a Hugging Face token via <code>.env</code>.
                    You can chat without entering a token below.
                  </div>
                )}

                <div className="form-group">
                  <label>Hugging Face API Key (User Token) <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional if .env is set)</em></label>
                  <div className="token-input-wrapper">
                    <input 
                      type={showToken ? "text" : "password"} 
                      className="form-input" 
                      placeholder="Paste your key: hf_..." 
                      value={hfToken}
                      onChange={(e) => setHfToken(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="token-toggle-visibility-btn"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? '👁️ Hide' : '👁️ Show'}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Generate a key at <strong>huggingface.co/settings/tokens</strong> (read permission is sufficient).
                  </p>
                </div>

                <div className="form-group">
                  <label>Inference Model Architecture</label>
                  <select 
                    className="form-select"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  >
                    <option value="HuggingFaceH4/zephyr-7b-beta">Zephyr 7B Beta ⚡ (Fast & Recommended)</option>
                    <option value="Qwen/Qwen2.5-7B-Instruct">Qwen 2.5 7B Instruct</option>
                    <option value="Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B Instruct (Slow, high quality)</option>
                    <option value="mistralai/Mistral-7B-Instruct-v0.3">Mistral 7B Instruct v0.3</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button className="eligibility-btn" onClick={handleSaveSettings}>
                    💾 Save Configurations
                  </button>
                  
                  <button 
                    className="test-conn-btn" 
                    onClick={handleTestHfConnection}
                    disabled={isTestingHf || !hfToken}
                  >
                    {isTestingHf ? 'Testing connection...' : '⚡ Test Connection'}
                  </button>
                </div>

                {hfTestResult && (
                  <div className={`alert ${hfTestResult.status}`}>
                    {hfTestResult.message}
                  </div>
                )}
              </div>

              <div className="glass-card" style={{ backgroundColor: 'rgba(59, 130, 246, 0.03)' }}>
                <h3 className="settings-section-title">💡 How to Get a Free Token</h3>
                <p style={{ fontSize: '13.5px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  1. Visit <a href="https://huggingface.co" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)' }}>huggingface.co</a> and sign up for a free account.
                  <br />
                  2. Navigate to your Profile Settings → <strong>Access Tokens</strong>.
                  <br />
                  3. Click <strong>New Token</strong>, set Role as <strong>Read</strong>, give it a name like "PlacementBot", and click Generate.
                  <br />
                  4. Copy the token and paste it above!
                  <br /><br />
                  <em>Note: If no token is provided, the chatbot will fall back to using a local DistilBERT Question-Answering model.</em>
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
