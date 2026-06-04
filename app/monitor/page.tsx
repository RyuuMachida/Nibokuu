'use client';

import React, { useState, useEffect } from 'react';

interface RequestLog {
  id: string;
  endpoint: string;
  method: string;
  status: string;
  statusCode: number;
  latency: string;
  timestamp: string;
}

interface MirrorData {
  name: string;
  link: string | undefined;
  post?: string;
  nume?: string;
  type?: string;
}

interface RecentAnimeItem {
  title: string;
  episode: string;
  thumbnail: string | undefined;
  link: string | undefined;
}

interface SelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  small?: boolean;
}

// Custom drop-down select component
function CustomSelect({ options, value, onChange, label, small = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="relative flex flex-col gap-0.5 select-none">
      <span className={`font-mono uppercase text-[#737373] ${small ? 'text-[8px]' : 'text-[9px]'}`}>
        {label}
      </span>
      <button
        type="button"
        suppressHydrationWarning={true}
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={`flex items-center justify-between bg-[#0a0a0a] border border-[#222] hover:border-[#333] hover:bg-[#121212] rounded text-[#fafafa] outline-none text-left cursor-pointer transition-all ${
          small ? 'h-6 px-2 text-[10px]' : 'h-7 px-2.5 text-xs'
        }`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          className={`text-[#737373] transition-transform duration-200 shrink-0 ${small ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[100] bg-[#0d0d0d] border border-[#222] rounded shadow-lg overflow-y-auto max-h-[140px] no-scrollbar py-1 top-[42px]`}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={() => onChange(opt.value)}
              className={`w-full text-left hover:bg-[#1a1a1a] cursor-pointer transition-colors block border-none outline-none ${
                small ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'
              } ${value === opt.value ? 'text-[#fafafa] bg-[#121212] font-semibold' : 'text-[#a3a3a3]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonitorPage() {
  // Global stats & resolved domain state
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [cacheHitRatio, setCacheHitRatio] = useState<number>(0);
  const [successRequests, setSuccessRequests] = useState<number>(0);
  const [failedRequests, setFailedRequests] = useState<number>(0);
  const [resolvedDomain, setResolvedDomain] = useState('https://v2.samehadaku.how/');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Stream Launcher State (Recent Episodes list)
  const [recentEpisodes, setRecentEpisodes] = useState<RecentAnimeItem[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(false);
  const [launcherTab, setLauncherTab] = useState<'recent' | 'detail'>('recent');

  // API Playground State
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/recent');
  const [playgroundParams, setPlaygroundParams] = useState({
    q: '',
    page: '1',
    day: '',
    url: '',
    status: '',
    type: '',
    order: '',
    genres: '',
    title: ''
  });
  const [playgroundResponse, setPlaygroundResponse] = useState<any | null>(null);
  const [isPlaygroundLoading, setIsPlaygroundLoading] = useState(false);

  // Video Extractor Player State
  const [liveEpisodeUrl, setLiveEpisodeUrl] = useState('');
  const [scrapedIframeUrl, setScrapedIframeUrl] = useState('');
  const [scrapedMirrors, setScrapedMirrors] = useState<MirrorData[]>([]);
  const [scrapedTitle, setScrapedTitle] = useState('');
  const [isVideoScraping, setIsVideoScraping] = useState(false);
  const [videoStatus, setVideoStatus] = useState<'standby' | 'loading' | 'playing'>('standby');
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerWarning, setPlayerWarning] = useState<string | null>(null);
  const [scrapedEpisodes, setScrapedEpisodes] = useState<{ title: string; link: string; episode: string }[]>([]);
  const [selectedMirrorSize, setSelectedMirrorSize] = useState('');
  const [isSizeLoading, setIsSizeLoading] = useState(false);

  // Options lists for Select elements
  const ENDPOINT_OPTIONS = [
    { label: 'Recent Updates', value: '/api/recent' },
    { label: 'Anime List (Filter)', value: '/api/anime' },
    { label: 'Weekly Schedule', value: '/api/schedule' },
    { label: 'Batch List', value: '/api/batch' },
    { label: 'Search Anime', value: '/api/search' },
    { label: 'Get Video Stream & Mirrors', value: '/api/episode' },
    { label: 'Scrape Updates', value: '/api/scrape' }
  ];

  const DAY_OPTIONS = [
    { label: 'All Days', value: '' },
    { label: 'Monday', value: 'monday' },
    { label: 'Tuesday', value: 'tuesday' },
    { label: 'Wednesday', value: 'wednesday' },
    { label: 'Thursday', value: 'thursday' },
    { label: 'Friday', value: 'friday' },
    { label: 'Saturday', value: 'saturday' },
    { label: 'Sunday', value: 'sunday' }
  ];

  const STATUS_OPTIONS = [
    { label: 'All Status', value: '' },
    { label: 'Ongoing', value: 'Ongoing' },
    { label: 'Completed', value: 'Completed' }
  ];

  const TYPE_OPTIONS = [
    { label: 'All Types', value: '' },
    { label: 'TV', value: 'TV' },
    { label: 'Movie', value: 'Movie' },
    { label: 'OVA', value: 'OVA' }
  ];

  const ORDER_OPTIONS = [
    { label: 'Default Sort', value: '' },
    { label: 'Title', value: 'title' },
    { label: 'Popularity', value: 'popular' },
    { label: 'Latest Updates', value: 'update' }
  ];

  // Fetch statistics helper
  const fetchStats = async (keyParam?: string, showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    const secretKey = keyParam || new URLSearchParams(window.location.search).get('key') || '';
    
    try {
      const res = await fetch(`/api/monitor/stats?key=${secretKey}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized access. Invalid key.');
        }
        throw new Error(`Server returned status: ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success') {
        setTotalRequests(data.totalRequests);
        setCacheHitRatio(data.cacheHitRatio);
        setSuccessRequests(data.successRequests || 0);
        setFailedRequests(data.failedRequests || 0);
        setLogs(data.logs || []);
        if (data.resolvedDomain) {
          setResolvedDomain(data.resolvedDomain);
        }
        setErrorMsg(null);
      } else {
        throw new Error(data.message || 'Failed to fetch statistics.');
      }
    } catch (err: any) {
      console.error('Error fetching monitor stats:', err);
      setErrorMsg(err.message || 'An error occurred while loading stats.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch recent episodes for Quick Stream Launcher
  const fetchRecentEpisodes = async () => {
    setIsRecentLoading(true);
    try {
      const res = await fetch('/api/recent');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          setRecentEpisodes(data.data.slice(0, 15));
        }
      }
    } catch (err) {
      console.error('Failed to pre-fetch recent episodes:', err);
    } finally {
      setIsRecentLoading(false);
    }
  };

  useEffect(() => {
    // Lock scrolling on html and body for the monitor dashboard to ensure fit-to-viewport layout
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    const params = new URLSearchParams(window.location.search);
    const secretKey = params.get('key') || '';
    
    fetchStats(secretKey);
    fetchRecentEpisodes();

    // Poll every 5 seconds for real-time logs
    const interval = setInterval(() => {
      fetchStats(secretKey);
    }, 5000);

    return () => {
      clearInterval(interval);
      // Restore normal scrolling when leaving the monitor page
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);

  // Pre-fill parameters with examples when endpoint changes
  useEffect(() => {
    if (selectedEndpoint === '/api/search') {
      setPlaygroundParams((prev) => ({ ...prev, q: 'one piece' }));
    } else if (selectedEndpoint === '/api/batch') {
      setPlaygroundParams((prev) => ({ ...prev, page: '1' }));
    } else if (selectedEndpoint === '/api/schedule') {
      setPlaygroundParams((prev) => ({ ...prev, day: 'monday' }));
    } else if (selectedEndpoint === '/api/episode') {
      setPlaygroundParams((prev) => ({ ...prev, url: `${resolvedDomain}gachiakuta-episode-1/` }));
    } else if (selectedEndpoint === '/api/anime') {
      setPlaygroundParams((prev) => ({ 
        ...prev, 
        title: 'boruto', 
        status: 'Ongoing', 
        type: 'TV', 
        order: 'popular',
        genres: '',
        page: '1'
      }));
    }
    setPlaygroundResponse(null);
  }, [selectedEndpoint, resolvedDomain]);

  // Fetch file size for selected mirror on-demand
  useEffect(() => {
    if (!scrapedIframeUrl) {
      setSelectedMirrorSize('');
      return;
    }

    const host = scrapedIframeUrl.toLowerCase();
    if (!host.includes('krakenfiles.com') && !host.includes('acefile.co') && !host.includes('mediafire.com')) {
      setSelectedMirrorSize('');
      return;
    }

    const fetchSize = async () => {
      setIsSizeLoading(true);
      setSelectedMirrorSize('Loading...');
      try {
        const res = await fetch(`/api/mirror-size?url=${encodeURIComponent(scrapedIframeUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.size) {
            setSelectedMirrorSize(data.size);
          } else {
            setSelectedMirrorSize('Tidak terdeteksi');
          }
        } else {
          setSelectedMirrorSize('Gagal memuat');
        }
      } catch (err) {
        console.error('Failed to fetch mirror size:', err);
        setSelectedMirrorSize('Gagal memuat');
      } finally {
        setIsSizeLoading(false);
      }
    };

    fetchSize();
  }, [scrapedIframeUrl]);

  const handleRefreshClick = () => {
    fetchStats(undefined, true);
    fetchRecentEpisodes();
  };

  // Helper for Endpoint Information box
  const getEndpointInfo = () => {
    switch (selectedEndpoint) {
      case '/api/recent':
        return {
          method: 'GET',
          path: '/api/recent',
          desc: 'Mengambil daftar rilis anime terbaru yang baru saja di-upload.',
          ex: []
        };
      case '/api/anime':
        return {
          method: 'GET',
          path: '/api/anime?title=&status=&type=&order=&genres=&page=1',
          desc: 'Mengambil daftar seluruh anime dengan opsi filter pencarian, genre, dan pengurutan.',
          ex: [
            { label: 'Popular TV Anime', fill: () => setPlaygroundParams(prev => ({ ...prev, title: '', type: 'TV', order: 'popular', status: '' })) },
            { label: 'Ongoing TV Series', fill: () => setPlaygroundParams(prev => ({ ...prev, title: '', type: 'TV', order: '', status: 'Ongoing' })) }
          ]
        };
      case '/api/schedule':
        return {
          method: 'GET',
          path: '/api/schedule?day=monday',
          desc: 'Mengambil jadwal rilis mingguan anime (berdasarkan hari rilis).',
          ex: [
            { label: 'Hari Senin', fill: () => setPlaygroundParams(prev => ({ ...prev, day: 'monday' })) },
            { label: 'Semua Hari', fill: () => setPlaygroundParams(prev => ({ ...prev, day: '' })) }
          ]
        };
      case '/api/batch':
        return {
          method: 'GET',
          path: '/api/batch?page=1',
          desc: 'Mengambil daftar anime versi batch (kumpulan download seluruh episode sekaligus).',
          ex: [
            { label: 'Halaman 1', fill: () => setPlaygroundParams(prev => ({ ...prev, page: '1' })) },
            { label: 'Halaman 2', fill: () => setPlaygroundParams(prev => ({ ...prev, page: '2' })) }
          ]
        };
      case '/api/search':
        return {
          method: 'GET',
          path: '/api/search?q=one+piece',
          desc: 'Mencari anime secara spesifik berdasarkan kata kunci judul.',
          ex: [
            { label: 'Cari One Piece', fill: () => setPlaygroundParams(prev => ({ ...prev, q: 'one piece' })) },
            { label: 'Cari Boruto', fill: () => setPlaygroundParams(prev => ({ ...prev, q: 'boruto' })) }
          ]
        };
      case '/api/episode':
        return {
          method: 'GET',
          path: `/api/episode?url=${resolvedDomain}gachiakuta-episode-1/`,
          desc: 'Mengambil url video player (iframe) dan link download dari halaman episode anime.',
          ex: [
            { label: 'Gachiakuta Ep 1', fill: () => setPlaygroundParams(prev => ({ ...prev, url: `${resolvedDomain}gachiakuta-episode-1/` })) }
          ]
        };
      case '/api/scrape':
        return {
          method: 'GET',
          path: '/api/scrape',
          desc: 'Sama seperti /api/recent, digunakan untuk memicu manual scraping dan membuang cache.',
          ex: []
        };
      default:
        return { method: 'GET', path: '', desc: '', ex: [] };
    }
  };

  // API Playground execution
  const handlePlaygroundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPlaygroundLoading(true);
    setPlaygroundResponse(null);
    
    let url = selectedEndpoint;
    const paramsList: string[] = [];
    
    if (selectedEndpoint === '/api/search') {
      if (playgroundParams.q) paramsList.push(`q=${encodeURIComponent(playgroundParams.q)}`);
    } else if (selectedEndpoint === '/api/anime') {
      if (playgroundParams.title) paramsList.push(`title=${encodeURIComponent(playgroundParams.title)}`);
      if (playgroundParams.status) paramsList.push(`status=${encodeURIComponent(playgroundParams.status)}`);
      if (playgroundParams.type) paramsList.push(`type=${encodeURIComponent(playgroundParams.type)}`);
      if (playgroundParams.order) paramsList.push(`order=${encodeURIComponent(playgroundParams.order)}`);
      if (playgroundParams.genres) paramsList.push(`genres=${encodeURIComponent(playgroundParams.genres)}`);
      if (playgroundParams.page) paramsList.push(`page=${encodeURIComponent(playgroundParams.page)}`);
    } else if (selectedEndpoint === '/api/schedule') {
      if (playgroundParams.day) paramsList.push(`day=${encodeURIComponent(playgroundParams.day)}`);
    } else if (selectedEndpoint === '/api/batch') {
      if (playgroundParams.page) paramsList.push(`page=${encodeURIComponent(playgroundParams.page)}`);
    } else if (selectedEndpoint === '/api/episode') {
      if (playgroundParams.url) paramsList.push(`url=${encodeURIComponent(playgroundParams.url)}`);
    }

    if (paramsList.length > 0) {
      url = `${url}?${paramsList.join('&')}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      setPlaygroundResponse(data);
    } catch (err: any) {
      setPlaygroundResponse({ error: err.message || 'Failed to execute request' });
    } finally {
      setIsPlaygroundLoading(false);
      // Refresh stats after a short delay
      setTimeout(() => fetchStats(), 1000);
    }
  };

  // Live stream scraper (Episode details query)
  const handleLoadStream = async (e?: React.FormEvent, customUrl?: string) => {
    if (e) e.preventDefault();
    const url = customUrl || liveEpisodeUrl;
    if (!url) return;
    
    setIsVideoScraping(true);
    setPlayerError(null);
    setPlayerWarning(null);
    setScrapedIframeUrl('');
    setScrapedMirrors([]);
    setVideoStatus('loading');
    setLauncherTab('detail');

    try {
      const res = await fetch(`/api/episode?url=${encodeURIComponent(url.trim())}`);
      if (!res.ok) {
        throw new Error(`Failed to scrape episode details. Status: ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success') {
        setScrapedTitle(data.title);
        
        // Update episodes list if returned
        if (data.episodes && data.episodes.length > 0) {
          setScrapedEpisodes(data.episodes);
        }

        if (data.isAnimeDetail) {
          setPlayerWarning('Halaman detail anime berhasil dimuat. Silakan pilih salah satu episode di bawah untuk memutar video.');
          setVideoStatus('standby');
        } else {
          const mirrorsList = data.mirrors || [];
          setScrapedMirrors(mirrorsList);
          
          // Set iframe URL and transition status to playing if there's an embeddable link
          const defaultMirror = mirrorsList.find((m: any) => m.link);
          if (defaultMirror) {
            setScrapedIframeUrl(defaultMirror.link);
            setVideoStatus('playing');
          } else if (data.iframeUrl) {
            setScrapedIframeUrl(data.iframeUrl);
            setVideoStatus('playing');
          } else {
            setVideoStatus('standby');
            setPlayerWarning('Tidak ada link video player (iframe) yang valid untuk episode ini.');
          }
        }
      } else {
        throw new Error(data.message || 'Failed to extract stream information.');
      }
    } catch (err: any) {
      console.error(err);
      setPlayerError(err.message || 'An error occurred during extraction.');
      setVideoStatus('standby');
    } finally {
      setIsVideoScraping(false);
      // Refresh stats after a short delay
      setTimeout(() => fetchStats(), 1000);
    }
  };

  const handleQuickLoad = (url: string) => {
    setLiveEpisodeUrl(url);
    handleLoadStream(undefined, url);
  };

  const handleSelectMirror = (link: string) => {
    if (link) {
      setScrapedIframeUrl(link);
      setVideoStatus('playing');
    }
  };

  const successPercent = totalRequests > 0 ? parseFloat(((successRequests / totalRequests) * 100).toFixed(1)) : 0;
  const failedPercent = totalRequests > 0 ? parseFloat(((failedRequests / totalRequests) * 100).toFixed(1)) : 0;

  const endpointInfo = getEndpointInfo();

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans antialiased overflow-hidden flex flex-col">
      {/* Dynamic injection to hide all scrollbars */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      {/* 1. Header (Top Navbar) */}
      <header className="w-full bg-[#0d0d0d]/90 backdrop-blur-md border-b border-[#222222] h-12 shrink-0">
        <div className="max-w-[1200px] h-full mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#fafafa] tracking-tight">Nibokuu API</span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-[#262626] bg-[#121212] rounded text-[#a3a3a3] tracking-wider">
              System Monitor
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10b981]"></span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#a3a3a3]">
                Operational
              </span>
            </div>

            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="flex items-center justify-center p-1.5 rounded border border-[#262626] bg-[#121212] text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#1a1a1a] transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh stats manually"
            >
              <svg
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main content container (fits exactly in viewport, no outer scrollbar) */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-4 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Compact Combined Header & Metrics Row */}
        <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121212] border border-[#222] p-3 px-4 rounded-lg shrink-0 gap-3">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#fafafa]">API Infrastructure</h1>
            <p className="text-[10px] text-[#a3a3a3]">Real-time status monitoring, Edge CDN cache metrics, and Samehadaku resolver status.</p>
          </div>
          
          <div className="flex gap-6 items-center flex-wrap sm:flex-nowrap">
            {/* Dynamic Success vs Failed split bar */}
            <div className="flex flex-col w-[180px] shrink-0">
              <div className="flex justify-between font-mono text-[8px] uppercase tracking-wider mb-1">
                <span className="text-emerald-400 font-semibold">{successPercent}% Berhasil</span>
                <span className="text-[#525252]">|</span>
                <span className={`${failedPercent > 0 ? 'text-rose-400 font-semibold' : 'text-[#737373]'}`}>{failedPercent}% Gagal</span>
              </div>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden flex">
                {totalRequests > 0 ? (
                  <>
                    <div className="h-full bg-emerald-500 rounded-l" style={{ width: `${successPercent}%` }} />
                    <div className="h-full bg-rose-500 rounded-r" style={{ width: `${failedPercent}%` }} />
                  </>
                ) : (
                  <div className="h-full bg-neutral-700 w-full" />
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#737373]">Total Requests</span>
              <span className="text-xs font-semibold text-[#fafafa]">{totalRequests.toLocaleString('en-US')}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#737373]">Cache Hit Ratio</span>
              <span className="text-xs font-semibold text-[#fafafa]">{cacheHitRatio}%</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#737373]">Solver Status</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        </section>

        {/* 3. Main Dashboard grid layout (fitted split heights) */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          
          {/* Left panel: Live Anime Video Player & Quick Launcher (5 cols) */}
          <div className="lg:col-span-5 flex flex-col bg-[#121212] rounded-lg p-4 border border-[#222] shadow-[0_1px_2px_rgba(0,0,0,0.4)] min-h-0 h-full">
            <div className="mb-2 shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373] block mb-0.5">
                Stream Extractor
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">
                Live Video Player
              </h2>
            </div>

            {/* URL Input Form */}
            <form onSubmit={handleLoadStream} className="flex gap-2 mb-2.5 shrink-0">
              <input
                type="text"
                placeholder="Masukkan URL episode Samehadaku..."
                value={liveEpisodeUrl}
                onChange={(e) => setLiveEpisodeUrl(e.target.value)}
                className="flex-1 px-2.5 py-1 text-xs bg-[#0a0a0a] border border-[#222] hover:border-[#333] focus:border-[#444] rounded text-[#fafafa] outline-none font-mono h-7"
                disabled={isVideoScraping}
                required
              />
              <button
                type="submit"
                disabled={isVideoScraping}
                className="px-3 py-1 bg-[#fafafa] text-[#0a0a0a] hover:bg-[#e5e5e5] rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors h-7 shrink-0"
              >
                {isVideoScraping ? 'Scraping...' : 'Load Stream'}
              </button>
            </form>

            {/* Collapsible Video Player container (aspect-video when loading/playing, h-14 when standby) */}
            <div className={`relative w-full rounded-md bg-[#050505] overflow-hidden border border-[#262626] flex items-center justify-center shadow-inner shrink-0 transition-all duration-300 ${
              videoStatus === 'playing' || videoStatus === 'loading' ? 'aspect-video' : 'h-14'
            }`}>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(10,10,10,0)_96%,_rgba(255,255,255,0.01)_96%)] bg-[size:100%_12px] pointer-events-none z-10"></div>
              
              {videoStatus === 'standby' && (
                <div className="flex items-center gap-2 z-10 px-3 py-1">
                  <svg className="h-4 w-4 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono text-[9px] text-[#737373] truncate max-w-[340px]">
                    {playerError ? `Scrape Error: ${playerError}` : scrapedTitle ? `Loaded: ${scrapedTitle} - Pilih server di tab "Eps Detail" untuk memutar` : 'Pilih anime di tab "Rilis Terbaru" di bawah'}
                  </span>
                </div>
              )}

              {videoStatus === 'loading' && (
                <div className="z-10 flex flex-col items-center gap-1.5">
                  <svg className="animate-spin h-5 w-5 text-[#fafafa]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-mono text-[8px] uppercase text-[#a3a3a3] tracking-wider animate-pulse">
                    Mengekstrak data video player...
                  </span>
                </div>
              )}

              {videoStatus === 'playing' && scrapedIframeUrl && (
                isEmbeddable(scrapedIframeUrl) ? (
                  <iframe
                    src={scrapedIframeUrl}
                    className="absolute inset-0 w-full h-full border-none z-20"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups"
                  />
                ) : (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-[#0a0a0a] text-center border border-[#262626] rounded-md">
                    <svg className="h-7 w-7 text-amber-500 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-sans text-[11px] font-semibold text-[#fafafa] mb-0.5">Halaman Unduhan Terdeteksi</span>
                    <p className="font-mono text-[9px] text-[#a3a3a3] max-w-[280px] mb-2.5">
                      Link ini ({(() => { try { return new URL(scrapedIframeUrl).hostname; } catch(e) { return 'eksternal'; } })()}) memblokir pemutaran langsung di dalam aplikasi.
                    </p>
                    <a
                      href={scrapedIframeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#fafafa] text-[#0a0a0a] hover:bg-[#e5e5e5] rounded text-[9px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Buka di Tab Baru
                    </a>
                  </div>
                )
              )}
            </div>

            {/* Custom quality selector bar */}
            {scrapedMirrors.filter(m => m.link).length > 0 && (videoStatus === 'playing' || videoStatus === 'standby') && (
              <div className="mt-2 shrink-0 bg-[#0d0d0d] border border-[#222] rounded p-2 flex flex-col gap-2">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-mono text-[8px] text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Streaming Server</span>
                      {selectedMirrorSize && (
                        <span className={`text-[8.5px] px-1 rounded font-bold uppercase ${isSizeLoading ? 'text-amber-500 animate-pulse' : 'text-blue-400 bg-blue-950/20 border border-blue-500/15'}`}>
                          {selectedMirrorSize}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] text-[#fafafa] font-semibold truncate" title={scrapedTitle}>
                      {scrapedTitle || 'Active Stream'}
                    </span>
                  </div>
                  <div className="w-[180px] shrink-0">
                    <CustomSelect
                      small
                      label="Pilih Grafik"
                      options={scrapedMirrors.filter(m => m.link).map(m => ({ label: m.name, value: m.link || '' }))}
                      value={scrapedIframeUrl}
                      onChange={(val) => handleSelectMirror(val)}
                    />
                  </div>
                </div>
                
                {scrapedIframeUrl && (
                  <div className="flex justify-end gap-2 shrink-0">
                    <a
                      href={scrapedIframeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-[#222] hover:border-[#333] text-[#fafafa] rounded text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Buka di Tab Baru
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stream Launcher & Server Tabs (Takes up all remaining card space) */}
            <div className="flex-1 flex flex-col min-h-0 mt-3.5">
              {/* Tab Selector */}
              <div className="flex border-b border-[#222] shrink-0 mb-2.5">
                <button
                  type="button"
                  onClick={() => setLauncherTab('recent')}
                  className={`px-3 py-1 font-mono text-[9px] uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    launcherTab === 'recent' 
                      ? 'border-[#fafafa] text-[#fafafa] font-semibold' 
                      : 'border-transparent text-[#737373] hover:text-[#a3a3a3]'
                  }`}
                >
                  Rilis Terbaru
                </button>
                
                <button
                  type="button"
                  onClick={() => setLauncherTab('detail')}
                  className={`px-3 py-1 font-mono text-[9px] uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    launcherTab === 'detail' 
                      ? 'border-[#fafafa] text-[#fafafa] font-semibold' 
                      : 'border-transparent text-[#737373] hover:text-[#a3a3a3]'
                  }`}
                >
                  Eps Detail
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {launcherTab === 'recent' ? (
                  isRecentLoading ? (
                    <div className="flex items-center justify-center gap-1.5 py-8 text-xs font-mono text-[#737373]">
                      <svg className="animate-spin h-3.5 w-3.5 text-[#737373]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading recent updates...</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recentEpisodes.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-2 p-1.5 rounded border border-[#222] bg-[#0d0d0d] hover:bg-[#151515] transition-colors"
                        >
                          {item.thumbnail ? (
                            <img 
                              src={item.thumbnail} 
                              alt="" 
                              className="w-7 h-9 object-cover rounded bg-[#222] shrink-0" 
                            />
                          ) : (
                            <div className="w-7 h-9 rounded bg-[#222] flex items-center justify-center text-[9px] text-[#737373] font-bold uppercase shrink-0">
                              {item.title ? item.title[0] : 'A'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold text-[#fafafa] truncate" title={item.title}>
                              {item.title}
                            </div>
                            <div className="font-mono text-[8px] text-[#737373]">
                              Episode {item.episode || 'N/A'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickLoad(item.link || '')}
                            className="px-2 py-0.5 bg-neutral-900 hover:bg-[#222] border border-[#333] text-[#fafafa] rounded text-[9px] font-semibold cursor-pointer transition-colors"
                          >
                            Detail
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Eps Detail Tab
                  <div className="space-y-2">
                    {playerWarning && (
                      <div className="p-2 border border-amber-900/35 bg-amber-950/15 rounded text-[9.5px] text-amber-300 font-mono leading-snug">
                        {playerWarning}
                      </div>
                    )}

                    {scrapedEpisodes.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between shrink-0 mb-1">
                          <h3 className="text-xs font-bold text-[#fafafa] truncate max-w-[240px]">
                            {scrapedTitle || 'Daftar Episode'}
                          </h3>
                          <span className="font-mono text-[8px] text-[#737373] bg-[#0d0d0d] border border-[#222] px-1 py-0.5 rounded">
                            {scrapedEpisodes.length} Episode
                          </span>
                        </div>

                        <div className="space-y-1 max-h-[300px] overflow-y-auto no-scrollbar pr-0.5">
                          {scrapedEpisodes.map((ep, idx) => (
                            <div 
                              key={idx} 
                              className={`flex items-center justify-between p-1.5 rounded border transition-colors ${
                                liveEpisodeUrl === ep.link 
                                  ? 'border-emerald-500/35 bg-emerald-950/5' 
                                  : 'border-[#222] bg-[#0d0d0d] hover:bg-[#151515]'
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <span className="font-mono text-[9px] text-[#fafafa] font-semibold truncate block">
                                  {ep.title}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleQuickLoad(ep.link)}
                                className={`px-2.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                  liveEpisodeUrl === ep.link && videoStatus === 'playing'
                                    ? 'bg-emerald-500 text-[#0a0a0a] border border-emerald-500'
                                    : 'bg-[#222] hover:bg-[#333] text-[#fafafa] border border-[#333]'
                                }`}
                              >
                                {liveEpisodeUrl === ep.link && isVideoScraping 
                                  ? 'Loading...' 
                                  : liveEpisodeUrl === ep.link && videoStatus === 'playing'
                                    ? 'Diputar'
                                    : 'Tonton'
                                }
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : scrapedTitle ? (
                      <>
                        <h3 className="text-xs font-semibold text-[#fafafa]">
                          {scrapedTitle}
                        </h3>
                        
                        <span className="font-mono text-[8px] uppercase tracking-wider text-[#737373] block">
                          Pilih Server untuk Memutar Video:
                        </span>

                        <div className="grid grid-cols-2 gap-2 pr-0.5">
                          {scrapedMirrors.length === 0 ? (
                            <div className="text-[9.5px] font-mono text-rose-400 col-span-2 p-2 border border-rose-950/30 bg-rose-950/10 rounded">
                              Tidak ada episode atau mirror yang ditemukan. Silakan masukkan link anime atau episode yang valid.
                            </div>
                          ) : (
                            scrapedMirrors.map((mirror, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-1.5 p-1 px-2 rounded border border-[#222] bg-[#0d0d0d] text-[9px] font-mono">
                                <span className="text-[#a3a3a3] truncate max-w-[80px]">{mirror.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {mirror.link ? (
                                    <>
                                      <button
                                        onClick={() => handleSelectMirror(mirror.link!)}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer ${
                                          scrapedIframeUrl === mirror.link && videoStatus === 'playing'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/35' 
                                            : 'bg-[#222] hover:bg-[#333] text-[#fafafa] border border-[#333]'
                                        }`}
                                      >
                                        Nonton
                                      </button>
                                      <a
                                        href={mirror.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-1 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/25 text-[8px]"
                                        title="Buka link mirror di tab baru"
                                      >
                                        Link
                                      </a>
                                    </>
                                  ) : (
                                    <span className="text-[#737373] text-[8px]">scraped</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-[#737373] font-mono text-[10px] py-12">
                        Belum ada episode yang dimuat.<br />Silakan pilih anime di tab **Rilis Terbaru** atau masukkan URL episode Samehadaku di atas.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: API Playground (Top) + Logs Feed (Bottom) (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-h-0 h-full">
            
            {/* API Playground (Top Part) */}
            <div className="flex-1 flex flex-col bg-[#121212] rounded-lg p-4 border border-[#222] shadow-[0_1px_2px_rgba(0,0,0,0.4)] min-h-0">
              <div className="mb-2 shrink-0">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373] block mb-0.5">
                  Developer Client
                </span>
                <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">
                  API Playground
                </h2>
              </div>

              {/* Endpoint selection & parameters */}
              <form onSubmit={handlePlaygroundSubmit} className="space-y-2.5 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Custom Endpoint Select */}
                  <CustomSelect
                    label="Endpoint Route"
                    options={ENDPOINT_OPTIONS}
                    value={selectedEndpoint}
                    onChange={(val) => {
                      setSelectedEndpoint(val);
                    }}
                  />

                  {/* Dynamic Fields */}
                  {selectedEndpoint === '/api/search' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase text-[#737373]">Search Query (q)</label>
                      <input
                        type="text"
                        placeholder="one piece, boruto..."
                        value={playgroundParams.q}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, q: e.target.value })}
                        className="px-2.5 py-1 text-xs bg-[#0a0a0a] border border-[#222] hover:border-[#333] rounded text-[#fafafa] outline-none font-mono h-7"
                        required
                      />
                    </div>
                  )}

                  {selectedEndpoint === '/api/schedule' && (
                    <CustomSelect
                      label="Day Filter"
                      options={DAY_OPTIONS}
                      value={playgroundParams.day}
                      onChange={(val) => setPlaygroundParams({ ...playgroundParams, day: val })}
                    />
                  )}

                  {selectedEndpoint === '/api/batch' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase text-[#737373]">Page</label>
                      <input
                        type="number"
                        min="1"
                        value={playgroundParams.page}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, page: e.target.value })}
                        className="px-2.5 py-1 text-xs bg-[#0a0a0a] border border-[#222] hover:border-[#333] rounded text-[#fafafa] outline-none font-mono h-7"
                        required
                      />
                    </div>
                  )}

                  {selectedEndpoint === '/api/episode' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase text-[#737373]">Episode Page URL</label>
                      <input
                        type="text"
                        placeholder="https://v2.samehadaku.how/..."
                        value={playgroundParams.url}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, url: e.target.value })}
                        className="px-2.5 py-1 text-xs bg-[#0a0a0a] border border-[#222] hover:border-[#333] rounded text-[#fafafa] outline-none font-mono h-7 text-[10px]"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Additional filters for /api/anime */}
                {selectedEndpoint === '/api/anime' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-[#222] pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[8px] uppercase text-[#737373]">Title Filter</label>
                      <input
                        type="text"
                        placeholder="naruto..."
                        value={playgroundParams.title}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, title: e.target.value })}
                        className="px-1.5 py-0.5 text-[10px] bg-[#0a0a0a] border border-[#222] rounded text-[#fafafa] outline-none font-mono h-6"
                      />
                    </div>

                    <CustomSelect
                      small
                      label="Status"
                      options={STATUS_OPTIONS}
                      value={playgroundParams.status}
                      onChange={(val) => setPlaygroundParams({ ...playgroundParams, status: val })}
                    />

                    <CustomSelect
                      small
                      label="Type"
                      options={TYPE_OPTIONS}
                      value={playgroundParams.type}
                      onChange={(val) => setPlaygroundParams({ ...playgroundParams, type: val })}
                    />

                    <CustomSelect
                      small
                      label="Sort Order"
                      options={ORDER_OPTIONS}
                      value={playgroundParams.order}
                      onChange={(val) => setPlaygroundParams({ ...playgroundParams, order: val })}
                    />

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[8px] uppercase text-[#737373]">Genres</label>
                      <input
                        type="text"
                        placeholder="Action,Comedy"
                        value={playgroundParams.genres}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, genres: e.target.value })}
                        className="px-1.5 py-0.5 text-[10px] bg-[#0a0a0a] border border-[#222] rounded text-[#fafafa] outline-none font-mono h-6"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[8px] uppercase text-[#737373]">Page</label>
                      <input
                        type="number"
                        min="1"
                        value={playgroundParams.page}
                        onChange={(e) => setPlaygroundParams({ ...playgroundParams, page: e.target.value })}
                        className="px-1.5 py-0.5 text-[10px] bg-[#0a0a0a] border border-[#222] rounded text-[#fafafa] outline-none font-mono h-6"
                      />
                    </div>
                  </div>
                )}

                {/* Endpoint Info & Examples Box */}
                <div className="p-1.5 border border-[#222] bg-[#0d0d0d] rounded flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[8px] font-bold">
                      {endpointInfo.method}
                    </span>
                    <span className="font-mono text-[9px] text-[#fafafa] font-semibold select-all">
                      {endpointInfo.path}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#a3a3a3] leading-snug">{endpointInfo.desc}</p>
                  
                  {endpointInfo.ex.length > 0 && (
                    <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                      <span className="font-mono text-[8px] text-[#737373]">Uji Cepat:</span>
                      {endpointInfo.ex.map((exItem, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            exItem.fill();
                            // Delay slightly to allow state to settle, then auto submit
                            setTimeout(() => {
                              const btn = document.getElementById('playground-submit-btn');
                              if (btn) btn.click();
                            }, 50);
                          }}
                          className="px-1.5 py-0.5 bg-[#1e1e1e] hover:bg-[#2e2e2e] text-[#fafafa] rounded text-[8px] border border-[#333] cursor-pointer"
                        >
                          {exItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  id="playground-submit-btn"
                  disabled={isPlaygroundLoading}
                  className="w-full py-1 bg-[#fafafa] text-[#0a0a0a] hover:bg-[#e5e5e5] rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors h-7"
                >
                  {isPlaygroundLoading ? 'Request Executing...' : 'Execute Request'}
                </button>
              </form>

              {/* JSON Viewer (takes the rest of playground card height) */}
              <div className="mt-2 flex-1 flex flex-col min-h-0">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373] block mb-0.5 shrink-0">
                  Response Payload
                </span>
                
                <div className="flex-1 bg-[#0d0d0d] border border-[#222] rounded p-2 overflow-auto font-mono text-[10px] text-[#a3a3a3] no-scrollbar min-h-0">
                  {isPlaygroundLoading ? (
                    <div className="flex items-center gap-2 text-[#737373] h-full justify-center py-6">
                      <svg className="animate-spin h-3.5 w-3.5 text-[#fafafa]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Scraper compiling response...</span>
                    </div>
                  ) : playgroundResponse ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(playgroundResponse, null, 2)}</pre>
                  ) : (
                    <div className="text-center text-[#737373] py-6 flex items-center justify-center h-full">
                      Ready to execute. JSON output will display here.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Requests Feed (Bottom Part - Fixed Height 180px) */}
            <div className="h-[180px] shrink-0 flex flex-col bg-[#121212] rounded-lg p-4 border border-[#222] shadow-[0_1px_2px_rgba(0,0,0,0.4)] min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373]">
                  Live Requests Feed
                </span>
                <span className="font-mono text-[9px] text-[#737373]">
                  Showing last {logs.length} entries
                </span>
              </div>

              <div className="flex-1 overflow-auto border border-[#222] rounded bg-[#0d0d0d] no-scrollbar min-h-0">
                {logs.length === 0 ? (
                  <div className="p-4 text-center text-xs font-mono text-[#737373] h-full flex items-center justify-center">
                    No request logs recorded yet. Send some API calls to start logging!
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#0d0d0d]">
                      <tr className="bg-[#0f0f0f] border-b border-[#222]">
                        <th className="p-1.5 text-left font-mono text-[9px] uppercase text-[#737373] tracking-wider font-normal">
                          Timestamp
                        </th>
                        <th className="p-1.5 text-left font-mono text-[9px] uppercase text-[#737373] tracking-wider font-normal">
                          Method
                        </th>
                        <th className="p-1.5 text-left font-mono text-[9px] uppercase text-[#737373] tracking-wider font-normal">
                          Endpoint
                        </th>
                        <th className="p-1.5 text-left font-mono text-[9px] uppercase text-[#737373] tracking-wider font-normal">
                          Status
                        </th>
                        <th className="p-1.5 text-left font-mono text-[9px] uppercase text-[#737373] tracking-wider font-normal">
                          Latency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {logs.map((log) => {
                        const isSuccess = log.statusCode >= 200 && log.statusCode < 400;
                        const isClientError = log.statusCode >= 400 && log.statusCode < 500;
                        const statusColor = isSuccess 
                          ? 'text-emerald-400' 
                          : isClientError 
                            ? 'text-amber-400' 
                            : 'text-rose-500';
                        const dotBg = isSuccess 
                          ? 'bg-emerald-400' 
                          : isClientError 
                            ? 'bg-amber-400' 
                            : 'bg-rose-500';

                        return (
                          <tr 
                            key={log.id} 
                            className="hover:bg-[#161616] transition-colors"
                          >
                            <td className="p-1.5 text-[9px] text-[#737373] font-mono whitespace-nowrap">
                              {log.timestamp}
                            </td>
                            <td className="p-1.5 whitespace-nowrap">
                              <code className="font-mono text-[8px] text-[#fafafa] bg-[#222] px-1 py-0.5 rounded">
                                {log.method}
                              </code>
                            </td>
                            <td className="p-1.5 text-[10px] text-[#fafafa] font-mono truncate max-w-[220px]">
                              {log.endpoint}
                            </td>
                            <td className="p-1.5 whitespace-nowrap">
                              <span className={`flex items-center gap-1 font-mono text-[9px] ${statusColor}`}>
                                <span className={`h-1 w-1 rounded-full ${dotBg}`}></span>
                                {log.status}
                              </span>
                            </td>
                            <td className="p-1.5 text-[9px] text-[#fafafa] font-mono whitespace-nowrap">
                              {log.latency}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
          
        </div>
      </main>
    </div>
  );
}

const isEmbeddable = (url: string) => {
  if (!url) return true;
  const nonEmbeddableHosts = [
    'drive.google.com', 
    'acefile.co', 
    'megaup.net', 
    'mediafire.com', 
    'zippyshare.com', 
    'solidfiles.com', 
    'files.im', 
    'racaty',
    'desudrive',
    'krakenfiles'
  ];
  try {
    const hostname = new URL(url).hostname;
    return !nonEmbeddableHosts.some(host => hostname.includes(host));
  } catch (e) {
    return true; // Fallback
  }
};

