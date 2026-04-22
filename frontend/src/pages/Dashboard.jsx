import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Award, Target, Flame, TrendingUp, History, PieChart as PieIcon } from 'lucide-react';

function Dashboard() {
    const [stats, setStats] = useState({ streak: 0, total_sessions: 0, average_score: 0 });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTranscript, setSelectedTranscript] = useState(null);

    useEffect(() => {
        Promise.all([
            fetch('http://localhost:8000/stats').then(res => res.json()),
            fetch('http://localhost:8000/history').then(res => res.json())
        ]).then(([statsData, historyData]) => {
            setStats(statsData);
            setHistory(historyData);
            setLoading(false);
        });
    }, []);

    const chartData = history.slice().reverse().map(item => ({
        day: new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: item.score
    }));

    const topicBreakdown = history.reduce((acc, curr) => {
        const topic = curr.topic || 'General';
        acc[topic] = acc[topic] || { name: topic, score: 0, count: 0 };
        acc[topic].score += curr.score;
        acc[topic].count += 1;
        return acc;
    }, {});

    const topicData = Object.values(topicBreakdown).map(t => ({
        name: t.name,
        avg: Math.round(t.score / t.count)
    }));

    // NEW: Channel Breakdown
    const channelBreakdown = history.reduce((acc, curr) => {
        const channel = curr.channel || 'Voice';
        acc[channel] = acc[channel] || { name: channel, score: 0, count: 0 };
        acc[channel].score += curr.score;
        acc[channel].count += 1;
        return acc;
    }, {});

    const channelData = Object.values(channelBreakdown).map(c => ({
        name: c.name,
        avg: Math.round(c.score / c.count)
    }));

    // NEW: Summary Metrics
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sessionsThisWeek = history.filter(h => new Date(h.timestamp) > oneWeekAgo).length;

    const sortedSkills = [...topicData].sort((a, b) => b.avg - a.avg);
    const topSkill = sortedSkills.length > 0 ? sortedSkills[0].name : "N/A";
    const skillToImprove = sortedSkills.length > 0 ? sortedSkills[sortedSkills.length - 1].name : "N/A";

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;

    return (
        <div>
            <h1 style={{ marginBottom: '2rem' }}>Performance Dashboard</h1>

            <div className="grid">
                <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '1rem', color: '#6366f1' }}>
                        <Award size={32} />
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Average Score</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{Math.round(stats.average_score)}%</div>
                    </div>
                </div>

                <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '1rem', color: '#10b981' }}>
                        <Target size={32} />
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Sessions Completed</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.total_sessions}</div>
                    </div>
                </div>

                <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '1rem', color: '#f59e0b' }}>
                        <Flame size={32} />
                    </div>
                    <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Current Streak</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.streak} Days</div>
                    </div>
                </div>
            </div>

            {/* NEW: Secondary Stats */}
            <div className="grid" style={{ marginTop: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="card glass" style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Sessions This Week</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#6366f1' }}>{sessionsThisWeek}</div>
                </div>
                <div className="card glass" style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Top Skill</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>{topSkill}</div>
                </div>
                <div className="card glass" style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Skill to Improve</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>{skillToImprove}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                <div className="card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3>Score Trend (Last 10 Sessions)</h3>
                        <TrendingUp size={18} color="#94a3b8" />
                    </div>
                    <div style={{ height: '300px', width: '100%' }}>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
                                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No data yet.</div>
                        )}
                    </div>
                </div>

                <div className="card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>Performance Breakdown</h3>
                        <PieIcon size={18} color="#94a3b8" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>By Topic</div>
                            <div style={{ height: '180px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topicData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                                        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                            {topicData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>By Channel</div>
                            <div style={{ height: '120px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={channelData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                                        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                                            {channelData.map((entry, index) => <Cell key={`cell-ch-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ marginTop: '2rem' }}>
                <h3>Recent Sessions History</h3>
                <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.85rem' }}>
                                <th style={{ padding: '0.75rem' }}>Date</th>
                                <th style={{ padding: '0.75rem' }}>Scenario</th>
                                <th style={{ padding: '0.75rem' }}>Channel</th>
                                <th style={{ padding: '0.75rem' }}>Score</th>
                                <th style={{ padding: '0.75rem' }}>Feedback</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((record, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #1e293b', fontSize: '0.9rem' }}>
                                    <td style={{ padding: '1rem' }}>{new Date(record.timestamp).toLocaleDateString()}</td>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{record.title}</td>
                                    <td style={{ padding: '1rem' }}><span style={{ background: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{record.channel}</span></td>
                                    <td style={{ padding: '1rem', fontWeight: 800, color: record.score > 80 ? '#10b981' : '#f59e0b' }}>{record.score}%</td>
                                    <td style={{ padding: '1rem', color: '#94a3b8' }}>
                                        {record.feedback.length > 60 ? record.feedback.substring(0, 60) + '...' : record.feedback}
                                        {record.transcript && (
                                            <button
                                                onClick={() => setSelectedTranscript(record.transcript)}
                                                style={{ marginLeft: '1rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: 'transparent', border: '1px solid #6366f1', color: '#6366f1', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Logs
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedTranscript && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
                    <div className="glass" style={{ padding: '2rem', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.2rem' }}>Full Interaction Log</h2>
                            <button onClick={() => setSelectedTranscript(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {JSON.parse(selectedTranscript || "[]").map((m, i) => (
                                <div key={i} style={{
                                    padding: '1rem', borderRadius: '0.8rem',
                                    background: m.role === 'customer' ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.1)',
                                    alignSelf: m.role === 'customer' ? 'flex-start' : 'flex-end',
                                    maxWidth: '90%'
                                }}>
                                    <div style={{ fontSize: '0.65rem', color: '#6366f1', marginBottom: '4px', fontWeight: 800, textTransform: 'uppercase' }}>{m.role}</div>
                                    <div style={{ fontSize: '0.95rem' }}>{m.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
