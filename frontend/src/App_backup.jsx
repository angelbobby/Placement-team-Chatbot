import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5000';

function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  
  // Settings State
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('hf_token') || '');
  const [modelName, setModelName] = useState(() => localStorage.getItem('model_name') || 'Qwen/Qwen2.5-72B-Instruct');
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

  const messagesEndRef = useRef(null);

  // 1. Theme Effect
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 2. Initial Setup: Check Connections & Load Data
  useEffect(() => {
    checkBackendConnection();
    checkHfConfig();
    loadFaqs();
    loadTips();
    loadSessions();
    loadUploadedDocs();
  }, []);

  // 3. Auto-scroll Messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // 4. Session Change Effect
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Check Backend Server & MongoDB Status
  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/companies`);
      if (response.ok) {
        setDbStatus('online');
        // Pre-fill eligibility if connection works
        const comps = await response.json();
        if (comps.length > 0) {
          // Initialize eligibility list without filters
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
    
    // Check HF config status from localStorage
    const storedToken = localStorage.getItem('hf_token');
    if (storedToken && storedToken.trim().length > 0) {
      setHfStatus('warning'); // Configured but untested this turn
    }
    // Note: checkHfConfig() also runs on mount to check server env token
  };

  // Check if server has HF token configured via .env
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

  // Fetch FAQs from API
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

  // Fetch Interview Tips from API
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
          // If no sessions exist, create one
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
    e.stopPropagation(); // Avoid selecting deleted session
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

  // Send Message inside Chat
  const handleSendMessage = async (textToSend) => {
    const messageContent = textToSend || chatInput;
    if (!messageContent.trim()) return;
    if (!currentSessionId) {
      alert("No active chat session. Please create one!");
      return;
    }

    // Add local user message immediately to state for speed
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
        // Re-fetch sessions to update title if changed
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
        text: "Could not connect to the backend server. Make sure Flask app.py is running on localhost:5000.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Eligibility Form Checker
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

    // Simulate progress ticks
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
        setUploadResult({ status: 'error', message: data.error || 'Failed to parse file.' });
      }
    } catch (err) {
      clearInterval(interval);
      setUploadResult({ status: 'error', message: 'Connection to upload endpoint failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Test Hugging Face Token API connection
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
      setHfTestResult({ status: 'error', message: 'Could not connect to Flask API server.' });
      setHfStatus('offline');
    } finally {
      setIsTestingHf(false);
    }
  };

  // Save Settings Changes
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

  // Clean raw markup simple formatting parser
  const renderFormattedText = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => {
      let cleanLine = line;
      let isBullet = false;
      let isNumbered = false;

      // 1. Identify list structure (requires space after list symbol)
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        isBullet = true;
        cleanLine = line.trim().replace(/^[\*\-]\s+/, '');
      } else if (line.trim().match(/^\d+\.\s+/)) {
        isNumbered = true;
        cleanLine = line.trim().replace(/^\d+\.\s+/, '');
      }

      // 2. Identify full-line italic block helper (starts and ends with * but is not bold)
      let isItalicLine = false;
      if (cleanLine.trim().startsWith('*') && cleanLine.trim().endsWith('*') && !cleanLine.includes('**')) {
        isItalicLine = true;
        cleanLine = cleanLine.trim().slice(1, -1);
      }

      // 3. Render bold elements inside the text (split by **)
      const parts = cleanLine.split('**');
      const lineContent = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx}>{part}</strong>;
        }
        return part;
      });

      // 4. Return correct JSX elements
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

  // Filters FAQ list in real-time
  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
    f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.category.toLowerCase().includes(faqSearch.toLowerCase())
  );

  // Groups FAQs by category
  const faqCategories = filteredFaqs.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  return (
    <div className="app-container">
      {/* 1. Sidebar Nav */}
      <aside className="sidebar">
        <div>
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
                onClick={() => setActiveTab('eligibility')} 
                className={`nav-item-btn ${activeTab === 'eligibility' ? 'active' : ''}`}
              >
                <span>✅</span> Eligibility Checker
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

      {/* 2. Main Area Container */}
      <main className="main-content">
        <header className="tab-header">
          <div className="tab-title">
            <h1>
              {activeTab === 'chat' && 'Placement Assistant'}
              {activeTab === 'eligibility' && 'Eligibility Checker'}
              {activeTab === 'faqs' && 'Placement FAQ Database'}
              {activeTab === 'tips' && 'Resume & Interview Hub'}
              {activeTab === 'documents' && 'Knowledge Retrieval Center (RAG)'}
              {activeTab === 'settings' && 'System Configuration'}
            </h1>
            <p>
              {activeTab === 'chat' && 'Chat with our AI bot powered by Hugging Face to get instant guideline answers.'}
              {activeTab === 'eligibility' && 'Verify your recruitment qualifications against top recruiters in real-time.'}
              {activeTab === 'faqs' && 'Browse common queries regarding rules, backlogs, and interview slots.'}
              {activeTab === 'tips' && 'Get industry-standard tips for structuring resumes and handling interviews.'}
              {activeTab === 'documents' && 'Upload placement PDFs/Docs to automatically index them into FAISS.'}
              {activeTab === 'settings' && 'Configure Hugging Face models, API keys, and check server runtimes.'}
            </p>
          </div>
        </header>

        {/* 3. Render Current Tab Panel */}
        <div className="tab-panel">
          
          {/* TAB 1: CHATROOM ASSISTANT */}
          {activeTab === 'chat' && (
            <div className="chat-layout">
              {/* Chat Session List Sidebar */}
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

              {/* Chat Viewport Area */}
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

          {/* TAB 2: ELIGIBILITY CHECKER */}
          {activeTab === 'eligibility' && (
            <div className="eligibility-layout">
              {/* Form Input Card */}
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

              {/* Company Cards Grid Results */}
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

          {/* TAB 3: FAQs ACCORDION */}
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
                  No FAQs available. Make sure Flask server is seeded.
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

          {/* TAB 4: PREPARATION TIPS HUB */}
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

          {/* TAB 5: DOCUMENT CENTER (RAG) */}
          {activeTab === 'documents' && (
            <div className="document-layout">
              {/* Upload Panel */}
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

              {/* RAG Explanation Sidebar */}
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

          {/* TAB 6: SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '650px' }}>
              <div className="glass-card">
                <h3 className="settings-section-title">🔌 Server & API Verification</h3>
                
                <div className="settings-info-list" style={{ marginBottom: '20px' }}>
                  <div className="settings-info-item">
                    <span className="settings-info-label">Flask Server IP:</span>
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
                    <option value="Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B Instruct ✅ (Recommended)</option>
                    <option value="Qwen/Qwen2.5-7B-Instruct">Qwen 2.5 7B Instruct ✅</option>
                    <option value="mistralai/Mistral-7B-Instruct-v0.3">Mistral 7B Instruct v0.3 (Legacy)</option>
                    <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B Instruct</option>
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

  // Helper function to return hardcoded recruitment processes if MongoDB is offline or load speed optimization is needed
  function getRecruitmentProcessText(name) {
    if (name === "Microsoft") return "1. Online Assessment (3 Coding Questions on DS/Algo)\n2. Technical Round 1 (System Design & Code Optimization)\n3. Technical Round 2 (Algorithms & Problem Solving)\n4. Hiring Manager / Cultural Fit Round";
    if (name === "Amazon") return "1. Online Assessment (Debugging + Coding + Work Style Simulation)\n2. Technical Round 1 (Data Structures, Algorithms & Leadership Principles)\n3. Technical Round 2 (Deep dive into project architecture & coding)\n4. Bar Raiser Round (General intelligence & culture fit)";
    if (name === "Google") return "1. Online Coding Challenge (Google Online Challenge)\n2. Technical Round 1 (Advanced Data Structures - Graphs, DP)\n3. Technical Round 2 (Ad-hoc Algorithms & Complexity analysis)\n4. Technical Round 3 (System design & scaling)\n5. Googleyness & Leadership Round";
    if (name === "TCS") return "1. TCS NQT (National Qualifier Test) - Aptitude, Reasoning, Coding\n2. Technical Interview (Fundamentals of OOPS, DBMS, SQL, Basic coding)\n3. HR & Managerial Interview";
    if (name === "Accenture") return "1. Cognitive and Technical Assessment\n2. Coding Assessment (2 questions)\n3. Communication Assessment\n4. Technical & HR Interview (Combined)";
    if (name === "Adobe") return "1. Online Aptitude & Coding Test\n2. Technical Interview 1 (OOPs design, DS/Algo)\n3. Technical Interview 2 (Data structures & system performance optimization)\n4. HR Interview";
    return "1. Resume Screening\n2. Technical Written / Coding Test\n3. Interview Round";
  }
}

export default App;
