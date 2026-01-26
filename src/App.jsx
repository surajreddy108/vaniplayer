import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
    Search, Play, Pause, ChevronLeft, ChevronRight,
    X, Shuffle, RotateCcw, RotateCw,
    MoreHorizontal, AlertCircle, Loader2, Link2, Info,
    User, LogOut
} from 'lucide-react'
import LoginScreen from './LoginScreen'
import { saveUserProgress, loadUserProgress } from './firebase'
import prabhupadaImg from './assets/prabhupada.png'
import rnsmImg from './assets/rnsm.png'
import hhbrsmImg from './assets/hhbrsm.png'

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ background: '#0f172a', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '20px' }} />
                    <h1 style={{ fontWeight: 800 }}>Application Halted</h1>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '24px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#fbbf24', color: '#0f172a', fontWeight: 'bold' }}>Restart Player</button>
                </div>
            );
        }
        return this.props.children;
    }
}

const VaniPlayer = () => {
    const [vaniData, setVaniData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)

    const [currentUser, setCurrentUser] = useState(localStorage.getItem('vani_last_user') || null)

    const [activeTab, setActiveTab] = useState('')
    const [search, setSearch] = useState('')
    const [currentTrack, setCurrentTrack] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [showDetail, setShowDetail] = useState(false)
    const [playbackError, setPlaybackError] = useState(null)
    const [syncStatus, setSyncStatus] = useState('idle') // idle, saving, saved, error

    const audioRef = useRef(new Audio())
    const listRef = useRef(null)
    const progressRef = useRef(null)

    // Load Profile on Login (Cloud)
    useEffect(() => {
        if (currentUser && vaniData) {
            const fetchCloudData = async () => {
                setSyncStatus('loading');
                const saved = await loadUserProgress(currentUser);
                if (saved) {
                    console.log("Cloud Data Loaded:", saved);
                    const { tab, track, time } = saved;
                    if (tab) setActiveTab(tab);
                    if (track) {
                        setCurrentTrack(track);
                        setTimeout(() => {
                            if (audioRef.current) {
                                audioRef.current.src = resolveUrl(track);
                                audioRef.current.currentTime = time || 0;
                                setCurrentTime(time || 0);
                            }
                        }, 500);
                    }
                    setSyncStatus('saved');
                } else {
                    setSyncStatus('idle');
                }
            };
            fetchCloudData();
        }
    }, [currentUser, vaniData])

    // Auto-Save Progress (Throttled)
    useEffect(() => {
        if (!currentUser || !currentTrack) return;

        const saveState = async () => {
            setSyncStatus('saving');
            const state = {
                tab: activeTab,
                track: currentTrack,
                time: audioRef.current ? audioRef.current.currentTime : 0,
                lastPlayed: Date.now()
            };
            try {
                await saveUserProgress(currentUser, state);
                setSyncStatus('saved');
            } catch (e) {
                setSyncStatus('error');
            }
        };

        const interval = setInterval(saveState, 5000);
        return () => clearInterval(interval);
    }, [currentUser, currentTrack, activeTab, currentTime])

    const handleLogin = (userId) => {
        setCurrentUser(userId);
        localStorage.setItem('vani_last_user', userId);
    }

    const handleLogout = () => {
        if (audioRef.current) { audioRef.current.pause(); }
        setIsPlaying(false);
        setCurrentUser(null);
        localStorage.removeItem('vani_last_user');
        setCurrentTrack(null);
    }

    useEffect(() => {
        fetch('data/vani_data.json')
            .then(res => { if (!res.ok) throw new Error("Sync failed"); return res.json(); })
            .then(data => {
                setVaniData(data);
                if (Object.keys(data)[0]) setActiveTab(Object.keys(data)[0]);
                setLoading(false);
            })
            .catch(err => { setLoadError(err.message); setLoading(false); });
    }, [])

    useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [activeTab, search])

    const currentTabItems = useMemo(() => {
        if (!vaniData || !activeTab) return []
        const items = vaniData[activeTab] || []
        if (activeTab !== 'HHBRSM') return items
        return items
            .slice()
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }))
    }, [vaniData, activeTab])
    const getArtwork = (tab) => {
        if (tab === 'HHBRSM') return hhbrsmImg
        if (tab === 'HHRNSM') return rnsmImg
        return prabhupadaImg
    }

    const filteredData = useMemo(() => {
        const kw = search.toLowerCase()
        return currentTabItems.filter(item =>
            String(item.title).toLowerCase().includes(kw) || String(item.Theme).toLowerCase().includes(kw)
        )
    }, [search, currentTabItems])

    const resolveUrl = (track) => {
        let url = String(track.link || '');
        if (url.includes('drive.google.com') && !url.includes('export=download')) {
            const id = url.split('id=')[1]?.split('&')[0];
            if (id) return `https://drive.google.com/uc?id=${id}&export=download`;
        }
        return url;
    }

    const handlePlay = async (track) => {
        setPlaybackError(null);
        const resolved = resolveUrl(track);
        if (currentTrack === track) {
            if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
            else { audioRef.current.play(); setIsPlaying(true); }
            return;
        }
        setCurrentTrack(track);
        audioRef.current.src = resolved;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.load();
        try {
            await audioRef.current.play();
            setIsPlaying(true);
            setShowDetail(true);
        } catch (e) {
            if (!resolved.includes('drive.google.com')) {
                const filename = resolved.split('/').pop().replace(/ /g, '%20');
                const attempts = [`https://audio.iskcondesiretree.com/06_-_More/01_-_ISKCON_Pune/2025/${filename}`, `https://audio.iskcondesiretree.com/06_-_More/07_-_ISKCON_Punjabi_Baugh/2025/${filename}`];
                for (const alt of attempts) {
                    try { audioRef.current.src = alt; await audioRef.current.play(); setIsPlaying(true); setPlaybackError(null); return; } catch (err) { continue; }
                }
            }
            setPlaybackError("Link unavailable.");
        }
    }

    const skip = (s) => { if (audioRef.current.duration) audioRef.current.currentTime += s; }
    const changeSpeed = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
        const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
        setPlaybackRate(next); audioRef.current.playbackRate = next;
    }

    const handleSeek = (e) => {
        if (!progressRef.current || !audioRef.current.duration) return;
        const r = progressRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        audioRef.current.currentTime = pos * audioRef.current.duration;
    };

    useEffect(() => {
        const audio = audioRef.current
        const update = () => {
            setProgress(isNaN(audio.currentTime / audio.duration) ? 0 : (audio.currentTime / audio.duration) * 100)
            setCurrentTime(audio.currentTime); setDuration(audio.duration || 0);
        }
        audio.addEventListener('timeupdate', update)
        audio.addEventListener('loadedmetadata', update)
        audio.addEventListener('ended', () => setIsPlaying(false))
        audio.addEventListener('error', () => { if (isPlaying) setPlaybackError("Transmission interrupted."); setIsPlaying(false); })
        return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('loadedmetadata', update); }
    }, [isPlaying])

    if (loading) return (
        <div style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: '#fbbf24', marginBottom: '20px' }} />
            <h2 style={{ letterSpacing: '0.1em', fontWeight: 800 }}>VANI ARCHIVE LOADING...</h2>
        </div>
    )

    if (!currentUser) return <LoginScreen onLogin={handleLogin} />

    return (
        <div className="main-layout" style={{ height: '100vh', overflow: 'hidden' }}>
            <header className="app-header" style={{ opacity: showDetail ? 0 : 1, transition: '0.3s', position: 'relative' }}>
                <button
                    onClick={handleLogout}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '50px',
                        padding: '8px 16px',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        fontWeight: '700'
                    }}
                >
                    <User size={16} />
                    <User size={16} />
                    {currentUser}
                    {syncStatus === 'saving' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', marginLeft: 4 }} />}
                    {syncStatus === 'saved' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', marginLeft: 4 }} />}
                    {syncStatus === 'error' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginLeft: 4 }} />}
                    <LogOut size={16} style={{ marginLeft: '4px' }} />
                </button>

                <h1 className="brand-title">Vani Player</h1>
                <p style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.25em' }}>DIVINE INSTRUCTION PORTAL</p>
                <div className="search-container">
                    <Search size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563' }} />
                    <input className="search-input" placeholder="Search teachings..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="tab-row">
                    {Object.keys(vaniData).map(tab => (
                        <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                    ))}
                </div>
            </header>

            <main ref={listRef} className="song-grid" style={{ flexGrow: 1, overflowY: 'auto', opacity: showDetail ? 0 : 1 }}>
                {filteredData.map((track, i) => (
                    <div key={i} className="song-card" onClick={() => handlePlay(track)}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', marginRight: '16px', flexShrink: 0 }}>
                            <img src={getArtwork(activeTab)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Art" />
                        </div>
                        <div className="song-info">
                            <div className="song-title" style={{ color: currentTrack === track ? '#fbbf24' : 'white' }}>{String(track.title)}</div>
                            <div className="song-meta">{String(track.Theme || activeTab).substring(0, 100)}</div>
                        </div>
                        <div>
                            {currentTrack === track && isPlaying ? <Pause size={20} fill="#fbbf24" stroke="none" /> : <Play size={20} />}
                        </div>
                    </div>
                ))}
            </main>

            {currentTrack && !showDetail && (
                <div className="mini-player" onClick={() => setShowDetail(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                            <img src={getArtwork(activeTab)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(currentTrack.title)}</div>
                            <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700 }}>{activeTab}</div>
                        </div>
                    </div>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handlePlay(currentTrack); }}>
                        {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
                    </button>
                </div>
            )}

            {showDetail && currentTrack && (
                <div className="detail-view">
                    <div className="detail-header">
                        <button className="icon-btn" onClick={() => setShowDetail(false)}>
                            <X size={32} color="white" />
                        </button>
                    </div>

                    <div className="detail-content">
                        <div className="artwork-box">
                            <img src={getArtwork(activeTab)} />
                        </div>
                        <h2 className="detail-title">{String(currentTrack.title)}</h2>
                        <p className="detail-meta">{activeTab} • {currentTrack.Theme || 'Spiritual Archive'}</p>
                        {playbackError && <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 700, marginTop: '10px' }}>{playbackError}</div>}
                    </div>

                    <div className="player-controls-bar">
                        <div className="progress-container">
                            <div
                                className="progress-bar-base"
                                ref={progressRef}
                                onClick={handleSeek}
                                onTouchStart={handleSeek}
                                onTouchMove={handleSeek}
                            >
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="time-stamps">
                                <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                                <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div className="controls-row">
                            <div style={{ flex: 1, opacity: 0.3 }}><Shuffle size={24} /></div>
                            <div className="main-controls">
                                <button className="icon-btn" onClick={() => skip(-10)} style={{ position: 'relative' }}>
                                    <RotateCcw size={36} /><span style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 900 }}>10</span>
                                </button>
                                <div className="play-pause-circle" onClick={() => handlePlay(currentTrack)}>
                                    {isPlaying ? <Pause size={40} fill="black" /> : <Play size={40} fill="black" style={{ marginLeft: '4px' }} />}
                                </div>
                                <button className="icon-btn" onClick={() => skip(30)} style={{ position: 'relative' }}>
                                    <RotateCw size={36} /><span style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 900 }}>30</span>
                                </button>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px' }}>
                                <button className="util-btn" onClick={changeSpeed}>{playbackRate}x</button>
                                <a href={resolveUrl(currentTrack)} target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}><Link2 size={28} /></a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const App = () => (<ErrorBoundary> <VaniPlayer /> </ErrorBoundary>)
export default App
