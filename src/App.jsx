import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
    Search, Play, Pause, Music, ChevronLeft, ChevronRight,
    X, Volume2, Shuffle, Repeat, RotateCcw, RotateCw,
    MoreHorizontal, AlertCircle, Loader2, Link2, Info,
    Image as ImageIcon
} from 'lucide-react'
import prabhupadaImg from './assets/prabhupada.png'
import rnsmImg from './assets/rnsm.png'

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ background: '#0f172a', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '20px' }} />
                    <h1 style={{ fontWeight: 800 }}>Application Halted</h1>
                    <p style={{ color: '#94a3b8', marginTop: '10px' }}>{this.state.error?.toString()}</p>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '24px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#fbbf24', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer' }}>Restart Player</button>
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

    const audioRef = useRef(new Audio())
    const listRef = useRef(null)

    useEffect(() => {
        fetch('data/vani_data.json')
            .then(res => { if (!res.ok) throw new Error("Database not found"); return res.json(); })
            .then(data => {
                setVaniData(data);
                const firstTab = Object.keys(data)[0];
                if (firstTab) setActiveTab(firstTab);
                setLoading(false);
            })
            .catch(err => { setLoadError(err.message); setLoading(false); });
    }, [])

    // Reset scroll on tab/search
    useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [activeTab, search])

    const currentTabItems = useMemo(() => (vaniData && activeTab) ? vaniData[activeTab] || [] : [], [vaniData, activeTab])

    const getArtwork = (tab) => {
        if (tab === 'HHRNSM') return rnsmImg;
        return prabhupadaImg;
    }

    const filteredData = useMemo(() => {
        const kw = search.toLowerCase()
        return currentTabItems.filter(item =>
            String(item.title).toLowerCase().includes(kw) ||
            String(item.Theme).toLowerCase().includes(kw)
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
            else { audioRef.current.play().catch(e => setPlaybackError("Stream failed")); setIsPlaying(true); }
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
            console.warn("Primary path failed, attempting recovery...", resolved);

            if (!resolved.includes('drive.google.com')) {
                const filename = resolved.split('/').pop().replace(/ /g, '%20');
                const attempts = [
                    `https://audio.iskcondesiretree.com/06_-_More/01_-_ISKCON_Pune/2025/${filename}`,
                    `https://audio.iskcondesiretree.com/06_-_More/07_-_ISKCON_Punjabi_Baugh/2025/${filename}`,
                    `https://audio.iskcondesiretree.com/02_-_ISKCON_Swamis/ISKCON_Swamis_-_R_to_Y/His_Holiness_Radhanath_Swami/Lectures/00_-_Year_wise/Devotional_Nectar_-_2025/${filename}`,
                    `https://audio.iskcondesiretree.com/06_-_More/01_-_ISKCON_Pune/2024/${filename}`
                ];

                for (const alt of attempts) {
                    try {
                        audioRef.current.src = alt;
                        await audioRef.current.play();
                        setIsPlaying(true);
                        setShowDetail(true);
                        setPlaybackError(null);
                        return;
                    } catch (err) { continue; }
                }
            }
            setPlaybackError("Link unavailable. Server paths are being checked.");
        }
    }

    const skip = (s) => { if (audioRef.current.duration) audioRef.current.currentTime += s; }
    const changeSpeed = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
        const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
        setPlaybackRate(next); audioRef.current.playbackRate = next;
    }

    useEffect(() => {
        const audio = audioRef.current
        const update = () => {
            setProgress(isNaN(audio.currentTime / audio.duration) ? 0 : (audio.currentTime / audio.duration) * 100)
            setCurrentTime(audio.currentTime)
            setDuration(audio.duration || 0)
        }
        audio.addEventListener('timeupdate', update)
        audio.addEventListener('loadedmetadata', update)
        audio.addEventListener('ended', () => setIsPlaying(false))
        audio.addEventListener('error', () => { if (isPlaying) setPlaybackError("Transmission interrupted."); setIsPlaying(false); })
        return () => {
            audio.removeEventListener('timeupdate', update);
            audio.removeEventListener('loadedmetadata', update);
        }
    }, [isPlaying])

    if (loading) return (
        <div style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: '#fbbf24', marginBottom: '20px' }} />
            <h2 style={{ letterSpacing: '0.1em', fontWeight: 800 }}>VANI ARCHIVE LOADING...</h2>
        </div>
    )

    return (
        <div className="main-layout" style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header className="app-header" style={{ opacity: showDetail ? 0 : 1, transition: '0.3s', flexShrink: 0 }}>
                <h1 className="brand-title">Vani Player</h1>
                <p style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.25em' }}>DIVINE INSTRUCTION PORTAL</p>

                <div className="search-container">
                    <Search size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563' }} />
                    <input className="search-input" placeholder="Search recordings..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div className="tab-row" style={{ display: 'flex', gap: '8px', justifyContent: 'center', overflowX: 'auto', padding: '10px 10px 20px', scrollbarWidth: 'none' }}>
                    {Object.keys(vaniData).map(tab => (
                        <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                    ))}
                </div>
            </header>

            <main
                ref={listRef}
                className="song-grid"
                style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    padding: '0 24px 140px',
                    opacity: showDetail ? 0 : 1,
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#334155 transparent'
                }}
            >
                {filteredData.map((track, i) => (
                    <div key={i} className="song-card" onClick={() => handlePlay(track)}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', marginRight: '16px', flexShrink: 0 }}>
                            <img src={getArtwork(activeTab)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Art" />
                        </div>
                        <div className="song-info">
                            <div className="song-title" style={{ color: currentTrack === track ? '#fbbf24' : 'white' }}>{String(track.title)}</div>
                            <div className="song-meta">{String(track.Theme || activeTab).substring(0, 100)}</div>
                        </div>
                        <div style={{ marginLeft: '12px' }}>
                            {currentTrack === track && isPlaying ? <Pause size={20} fill="#fbbf24" style={{ color: '#fbbf24' }} /> : <Play size={20} />}
                        </div>
                    </div>
                ))}
                {filteredData.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No recordings match your search.</div>}
            </main>

            {currentTrack && !showDetail && (
                <div className="mini-player" onClick={() => setShowDetail(true)} style={{ position: 'fixed', bottom: '24px', left: '24px', right: '24px', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
                    <div style={{ padding: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowDetail(false)} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', padding: '12px', border: 'none', cursor: 'pointer' }}>
                            <X size={32} color="white" />
                        </button>
                    </div>

                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 40px', textAlign: 'center' }}>
                        <div style={{ width: 'clamp(220px, 45vh, 400px)', height: 'clamp(220px, 45vh, 400px)', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.6)', marginBottom: '40px' }}>
                            <img src={getArtwork(activeTab)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', marginBottom: '12px', maxWidth: '800px' }}>{String(currentTrack.title)}</h2>
                        <p style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{activeTab} • {currentTrack.Theme || 'Spiritual Archive'}</p>

                        {playbackError && (
                            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.85rem', fontWeight: 700, padding: '12px 24px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '100px' }}>
                                <Info size={18} />
                                {playbackError}
                            </div>
                        )}
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(20px)', padding: '40px 60px 60px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto 24px' }}>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', position: 'relative' }} onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * audioRef.current.duration;
                            }}>
                                <div style={{ width: `${progress}%`, background: '#fbbf24', height: '100%', borderRadius: '3px', transition: 'width 0.1s linear' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8' }}>
                                <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                                <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto', gap: '32px' }}>
                            <div style={{ flex: 1, minWidth: 0, opacity: 0.3 }}><Shuffle size={24} /></div>

                            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
                                <button onClick={() => skip(-10)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', position: 'relative' }}>
                                    <RotateCcw size={36} /><span style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 900 }}>10</span>
                                </button>
                                <div onClick={() => handlePlay(currentTrack)} style={{ width: '80px', height: '80px', background: 'white', borderRadius: '50%', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}>
                                    {isPlaying ? <Pause size={40} fill="black" /> : <Play size={40} fill="black" style={{ marginLeft: '4px' }} />}
                                </div>
                                <button onClick={() => skip(30)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', position: 'relative' }}>
                                    <RotateCw size={36} /><span style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 900 }}>30</span>
                                </button>
                            </div>

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px' }}>
                                <button onClick={changeSpeed} style={{ background: '#fbbf24', border: 'none', color: '#0f172a', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>{playbackRate}x</button>
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
