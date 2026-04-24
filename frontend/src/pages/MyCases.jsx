import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, X } from 'lucide-react';

function MyCases() {
    const [showModal, setShowModal] = useState(false);
    const [cases, setCases] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTopic, setFilterTopic] = useState('All');
    const [filterChannel, setFilterChannel] = useState('All');
    const [filterDifficulty, setFilterDifficulty] = useState('All');
    const [newCase, setNewCase] = useState({
        title: '',
        topic: 'Billing',
        difficulty: 'Beginner',
        scenario: '',
        opening_message: '',
        channel: 'Chat'
    });

    useEffect(() => {
        fetch('/api/cases')
            .then(res => res.json())
            .then(data => setCases(data));
    }, []);

    const filteredCases = cases.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.scenario.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTopic = filterTopic === 'All' || (c.topic && c.topic.toLowerCase() === filterTopic.toLowerCase());
        const matchesChannel = filterChannel === 'All' || (c.channel && c.channel.toLowerCase() === filterChannel.toLowerCase());
        const matchesDifficulty = filterDifficulty === 'All' || (c.difficulty && c.difficulty.toLowerCase() === filterDifficulty.toLowerCase());
        return matchesSearch && matchesTopic && matchesChannel && matchesDifficulty;
    });

    const handleSave = () => {
        if (!newCase.title || !newCase.scenario) {
            alert("Please fill in Title and Scenario");
            return;
        }
        fetch('/api/cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCase)
        })
            .then(res => res.json())
            .then(data => {
                setCases([...cases, data]);
                setShowModal(false);
                setNewCase({ title: '', topic: 'Billing', difficulty: 'Beginner', scenario: '', opening_message: '', channel: 'Chat' });
            });
    };

    return (
        <div className="cases-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>My Cases</h1>
                <button onClick={() => setShowModal(true)}>
                    <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Create New Case
                </button>
            </div>

            <div className="glass card" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search by title, topic or scenario..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: 'white' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={18} color="#94a3b8" />
                    <select
                        value={filterTopic}
                        onChange={(e) => setFilterTopic(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.6rem', borderRadius: '0.5rem' }}
                    >
                        <option value="All">All Topics</option>
                        <option value="Billing">Billing</option>
                        <option value="Technical">Technical</option>
                        <option value="De-escalation">De-escalation</option>
                        <option value="Logistics">Logistics</option>
                    </select>
                    <select
                        value={filterChannel}
                        onChange={(e) => setFilterChannel(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.6rem', borderRadius: '0.5rem' }}
                    >
                        <option value="All">All Channels</option>
                        <option value="Chat">Chat</option>
                        <option value="Call">Call</option>
                        <option value="Both">Both</option>
                    </select>
                    <select
                        value={filterDifficulty}
                        onChange={(e) => setFilterDifficulty(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.6rem', borderRadius: '0.5rem' }}
                    >
                        <option value="All">All Difficulties</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                    </select>
                </div>
            </div>

            <div className="grid">
                {filteredCases.map((c, i) => (
                    <div key={i} className="card glass" style={{ borderLeft: `4px solid ${c.difficulty === 'Advanced' ? '#ef4444' : c.difficulty === 'Intermediate' ? '#f59e0b' : '#10b981'}` }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>{c.title}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <span style={{ background: '#334155', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem' }}>{c.topic}</span>
                            <span style={{ background: '#1e293b', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>{c.channel}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {c.scenario}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: c.difficulty === 'Advanced' ? '#ef4444' : c.difficulty === 'Intermediate' ? '#f59e0b' : '#10b981' }}>{c.difficulty}</span>
                            <button style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid #6366f1', color: '#6366f1' }}>View Details</button>
                        </div>
                    </div>
                ))}
                {filteredCases.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                        No cases found matching your search.
                    </div>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div className="glass" style={{ padding: '2rem', width: '90%', maxWidth: '550px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => setShowModal(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                        <h2 style={{ marginBottom: '1.5rem' }}>Create New Training Case</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Title</label>
                                <input
                                    type="text"
                                    value={newCase.title}
                                    onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white' }}
                                    placeholder="e.g. Broken Screen Refund"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Topic</label>
                                    <select
                                        value={newCase.topic}
                                        onChange={(e) => setNewCase({ ...newCase, topic: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white' }}
                                    >
                                        <option>Billing</option>
                                        <option>Technical</option>
                                        <option>De-escalation</option>
                                        <option>Logistics</option>
                                        <option>General</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Difficulty</label>
                                    <select
                                        value={newCase.difficulty}
                                        onChange={(e) => setNewCase({ ...newCase, difficulty: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white' }}
                                    >
                                        <option>Beginner</option>
                                        <option>Intermediate</option>
                                        <option>Advanced</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Channel</label>
                                    <select
                                        value={newCase.channel}
                                        onChange={(e) => setNewCase({ ...newCase, channel: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white' }}
                                    >
                                        <option>Chat</option>
                                        <option>Call</option>
                                        <option>Both</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Opening Message (What customer says first)</label>
                                <input
                                    type="text"
                                    value={newCase.opening_message}
                                    onChange={(e) => setNewCase({ ...newCase, opening_message: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white' }}
                                    placeholder="e.g. I want a refund for this broken phone!"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Full Scenario Context</label>
                                <textarea
                                    value={newCase.scenario}
                                    onChange={(e) => setNewCase({ ...newCase, scenario: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.4rem', color: 'white', minHeight: '100px' }}
                                    placeholder="Describe the customer's background and emotional state..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button style={{ flex: 1, padding: '1rem' }} onClick={handleSave}>Save & Add Case</button>
                                <button style={{ flex: 1, background: '#1e293b', padding: '1rem' }} onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyCases;
