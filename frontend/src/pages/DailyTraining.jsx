import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, ArrowRight, CheckCircle, RefreshCcw, Info } from 'lucide-react';

function DailyTraining() {
    const [step, setStep] = useState('start');
    const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [turnCount, setTurnCount] = useState(0);
    const [sessionResults, setSessionResults] = useState([]);
    const [scenarios, setScenarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isScoring, setIsScoring] = useState(false);
    const [stats, setStats] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [lastCaseResult, setLastCaseResult] = useState(null);

    const MAX_TURNS = 5;

    useEffect(() => {
        fetch('http://localhost:8000/stats')
            .then(res => res.json())
            .then(data => setStats(data));
    }, []);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        fetch('http://localhost:8000/cases')
            .then(res => res.json())
            .then(data => {
                // DAILY SELECTION LOGIC: Seed random based on date
                const today = new Date().toISOString().split('T')[0];
                const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);

                const shuffle = (array, seed) => {
                    let m = array.length, t, i;
                    while (m) {
                        i = Math.floor(Math.abs(Math.sin(seed++) * m--));
                        t = array[m];
                        array[m] = array[i];
                        array[i] = t;
                    }
                    return array;
                };

                const dailyScenarios = shuffle([...data], seed).slice(0, 3);
                setScenarios(dailyScenarios);
                setLoading(false);
            });
    }, []);

    const speak = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        // Try to find a natural sounding English voice
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
        window.speechSynthesis.speak(utterance);
    };

    const startTraining = async () => {
        setStep('training');
        const firstScenario = scenarios[0];
        if (firstScenario) {
            setMessages([{ role: 'customer', text: firstScenario.opening_message }]);
            speak(firstScenario.opening_message);
            // ... start session ...
            // Start session in DB
            try {
                const res = await fetch('http://localhost:8000/start-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        case_id: firstScenario.id,
                        opening_message: firstScenario.opening_message
                    })
                });
                const data = await res.json();
                setSessionId(data.session_id);
            } catch (e) { console.error("Start session failed", e); }
        }
    };

    const nextScenario = async (index) => {
        const scenario = scenarios[index];
        setMessages([{ role: 'customer', text: scenario.opening_message }]);
        speak(scenario.opening_message);
        setTurnCount(0);
        // Start new session in DB
        try {
            const res = await fetch('http://localhost:8000/start-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    case_id: scenario.id,
                    opening_message: scenario.opening_message
                })
            });
            const data = await res.json();
            setSessionId(data.session_id);
        } catch (e) { console.error("Start session failed", e); }
    };

    const handleSend = async (text = null) => {
        setIsTranscribing(false);
        const messageText = text || inputValue;
        if (!messageText.trim()) return;

        const newMessages = [...messages, { role: 'agent', text: messageText }];
        setMessages(newMessages);
        setInputValue('');
        setTurnCount(prev => prev + 1);

        setIsStreaming(true);
        setStreamingText('');

        try {
            const response = await fetch('http://localhost:8000/respond-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    context: scenarios[currentScenarioIndex].scenario,
                    message: messageText,
                    difficulty: scenarios[currentScenarioIndex].difficulty,
                    history: messages,
                    session_id: sessionId
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                setStreamingText(prev => prev + chunk);
            }

            // Finalize message
            const botMessage = { role: 'customer', text: fullText };
            const finalHistory = [...newMessages, botMessage];
            setMessages(finalHistory);

            if (turnCount >= MAX_TURNS - 1) {
                finishScenario(finalHistory);
            }
            speak(fullText);
            setIsStreaming(false);
            setStreamingText('');
        } catch (error) {
            console.error("Failed to get streaming response", error);
            setIsStreaming(false);
        }
    };

    const startVoiceRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.wav');

                setIsTranscribing(true);
                try {
                    const response = await fetch('http://localhost:8000/transcribe', {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await response.json();
                    if (data.text) {
                        handleSend(data.text);
                    } else {
                        setIsTranscribing(false);
                    }
                } catch (error) {
                    console.error("Transcription failed", error);
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone access denied", err);
        }
    };

    const stopVoiceRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const finishScenario = async (history) => {
        setIsScoring(true);
        try {
            const response = await fetch('http://localhost:8000/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: history })
            });
            const resultData = await response.json();

            const sessionResult = {
                title: scenarios[currentScenarioIndex].title,
                score: resultData.score,
                feedback: resultData.feedback
            };

            // Save to DB
            await fetch('http://localhost:8000/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    case_id: scenarios[currentScenarioIndex].id,
                    score: resultData.score,
                    feedback: resultData.feedback,
                    transcript: JSON.stringify(history)
                })
            });

            setSessionResults(prev => [...prev, sessionResult]);
            setLastCaseResult(sessionResult);
            setIsScoring(false);
            setStep('feedback');
        } catch (error) {
            console.error("Scoring failed", error);
            setIsScoring(false);
        }
    };

    const proceedToNext = () => {
        if (currentScenarioIndex < scenarios.length - 1) {
            const nextIdx = currentScenarioIndex + 1;
            setCurrentScenarioIndex(nextIdx);
            nextScenario(nextIdx);
            setStep('training');
        } else {
            setStep('summary');
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading daily scenarios...</div>;
    }

    if (step === 'start') {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Good Morning, Agent</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '3rem' }}>Your daily training session is ready. 3 cases selected for you today.</p>

                <div className="grid" style={{ maxWidth: '900px', margin: '0 auto 3rem auto' }}>
                    {scenarios.map((s, i) => (
                        <div key={i} className="card glass" style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.7rem', background: '#334155', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{s.topic}</span>
                                <span style={{ fontSize: '0.7rem', background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{s.difficulty}</span>
                            </div>
                            <h3 style={{ marginBottom: '0' }}>{s.title}</h3>
                        </div>
                    ))}
                </div>

                <button style={{ fontSize: '1.2rem', padding: '1rem 3rem' }} onClick={startTraining}>
                    Start Session <ArrowRight size={20} style={{ marginLeft: '10px', verticalAlign: 'middle' }} />
                </button>
            </div>
        );
    }

    if (step === 'training') {
        const currentScenario = scenarios[currentScenarioIndex];
        const isCall = currentScenario.channel === 'Call';

        if (isCall) {
            return (
                <div style={{ position: 'relative', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card glass" style={{ position: 'absolute', top: '2rem', left: '2rem', width: '300px', zIndex: 5 }}>
                        <h2 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>Active Call</h2>
                        <h3>{currentScenario.title}</h3>
                        <div className="status-badge" style={{ marginTop: '1rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                            Connection: Stable
                        </div>
                    </div>

                    <div className="pulse-avatar">
                        {(isRecording || window.speechSynthesis.speaking) && <div className="pulse-circle"></div>}
                        <Mic size={48} color="white" />
                    </div>

                    <h2 style={{ marginTop: '2rem', color: '#94a3b8' }}>
                        {isRecording ? "Listening to you..." : isTranscribing ? "Transcribing your voice..." : window.speechSynthesis.speaking ? "Customer is speaking..." : "Customer is on the line"}
                    </h2>

                    {(isStreaming || isTranscribing || messages.length > 0) && (
                        <div className="live-caption">
                            <div style={{ fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 800 }}>
                                {isStreaming || isTranscribing ? 'Agent' : messages[messages.length - 1].role === 'agent' ? 'You (Customer)' : 'Agent'}
                            </div>
                            {isTranscribing ? "Thinking..." : isStreaming ? (streamingText || "...") : messages[messages.length - 1].text}
                        </div>
                    )}

                    <div style={{ position: 'absolute', bottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>TURN</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{turnCount + 1}/{MAX_TURNS}</div>
                        </div>
                        <button
                            style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isRecording ? '#ef4444' : '#1e293b',
                                boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
                            }}
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        >
                            <Mic size={32} />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', height: 'calc(100vh - 180px)' }}>
                <div className="card glass">
                    <h2 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>Case {currentScenarioIndex + 1}/3</h2>
                    <h3>{currentScenario.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <span style={{ fontSize: '0.8rem', background: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{currentScenario.topic}</span>
                        <span style={{ fontSize: '0.8rem', background: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{currentScenario.channel}</span>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#94a3b8' }}>
                            <Info size={16} /> <strong>Context</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{currentScenario.scenario}</p>
                    </div>

                    <div style={{ marginTop: 'auto', textAlign: 'center', padding: '2rem' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#6366f1', margin: '0 auto 1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle color="white" size={32} />
                        </div>
                        <p style={{ color: '#94a3b8' }}>{turnCount < MAX_TURNS ? `${MAX_TURNS - turnCount} turns remaining` : 'Completing scenario...'}</p>
                    </div>
                </div>

                <div className="glass" style={{ display: 'flex', flexDirection: 'column', borderRadius: '1rem', overflow: 'hidden' }}>
                    <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ alignSelf: m.role === 'agent' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textAlign: m.role === 'agent' ? 'right' : 'left' }}>
                                    {m.role === 'agent' ? 'CUSTOMER' : 'AGENT'}
                                </div>
                                <div style={{
                                    padding: '1rem',
                                    borderRadius: '1rem',
                                    background: m.role === 'agent' ? '#6366f1' : '#1e293b',
                                    border: m.role === 'agent' ? 'none' : '1px solid #334155',
                                    color: 'white'
                                }}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {isStreaming || isTranscribing ? (
                            <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textAlign: 'left' }}>AGENT</div>
                                <div style={{ padding: '1rem', borderRadius: '1rem', background: '#1e293b', border: '1px solid #334155', color: 'white' }}>
                                    {isTranscribing ? "..." : (streamingText || "...")}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '1rem' }}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isRecording ? "Recording voice..." : "Type your response..."}
                            style={{ flex: 1, padding: '1rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.8rem', color: 'white' }}
                            disabled={isRecording}
                        />
                        <button
                            style={{ width: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRecording ? '#ef4444' : '#1e293b' }}
                            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        >
                            <Mic size={20} className={isRecording ? 'pulse' : ''} />
                        </button>
                        <button onClick={() => handleSend()}>
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'feedback' && lastCaseResult) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div className="card glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#6366f1', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={40} color="white" />
                    </div>
                    <h2 style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '2px' }}>Case Complete</h2>
                    <h1 style={{ fontSize: '2.5rem', margin: '1rem 0' }}>{lastCaseResult.title}</h1>

                    <div style={{ fontSize: '4rem', fontWeight: 900, color: '#10b981', marginBottom: '1.5rem' }}>
                        {lastCaseResult.score}%
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '1rem', textAlign: 'left', marginBottom: '2rem' }}>
                        <h4 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>AI Feedback:</h4>
                        <p style={{ margin: 0, lineHeight: '1.6' }}>{lastCaseResult.feedback}</p>
                    </div>

                    <button style={{ width: '100%', padding: '1rem' }} onClick={proceedToNext}>
                        {currentScenarioIndex < scenarios.length - 1 ? 'Next Scenario' : 'View Session Summary'}
                        <ArrowRight size={20} style={{ marginLeft: '10px', verticalAlign: 'middle' }} />
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'summary') {
        const avgScore = Math.round(sessionResults.reduce((acc, r) => acc + r.score, 0) / sessionResults.length);
        return (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#10b981', margin: '0 auto 2rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={60} color="white" />
                </div>
                <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Session Complete!</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '3rem' }}>You've completed your daily training. Great job!</p>

                <div className="grid" style={{ maxWidth: '900px', margin: '0 auto 3rem auto' }}>
                    <div className="card glass">
                        <h3>Average Score</h3>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: '#10b981' }}>{avgScore}%</div>
                    </div>
                    <div className="card glass">
                        <h3>Current Streak</h3>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: '#6366f1' }}>{stats?.streak || 0} Days</div>
                    </div>
                </div>

                <div className="card glass" style={{ maxWidth: '900px', margin: '0 auto 3rem auto', textAlign: 'left' }}>
                    <h3>Case Summaries</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        {sessionResults.map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{r.title}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>{r.feedback}</div>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: r.score > 80 ? '#10b981' : '#f59e0b' }}>{r.score}%</div>
                            </div>
                        ))}
                    </div>
                </div>

                <button style={{ padding: '1rem 3rem' }} onClick={() => { setStep('start'); setSessionResults([]); setCurrentScenarioIndex(0); }}>
                    <RefreshCcw size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Back to Home
                </button>
            </div>
        );
    }
}

export default DailyTraining;
