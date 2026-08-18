'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface AnimeItem {
  title: string;
  episode?: string;
  thumbnail?: string;
  link?: string;
  image?: string;
  type?: string;
  score?: string;
}

interface EpisodeItem {
  title: string;
  link: string;
  episode: string;
}

interface MirrorItem {
  name: string;
  link?: string;
  post?: string;
  nume?: string;
  type?: string;
}

interface EpisodeDetailResponse {
  status: string;
  title: string;
  isAnimeDetail?: boolean;
  iframeUrl?: string;
  mirrors?: MirrorItem[];
  episodes?: EpisodeItem[];
  parentAnimeUrl?: string;
}

const AUTHORIZED_KEY = 'nauracantikkesayanganakubangetss';

function WatchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Main UI State
  const [activeTab, setActiveTab] = useState<'recent' | 'search'>('recent');
  const [recentList, setRecentList] = useState<AnimeItem[]>([]);
  const [searchResults, setSearchResults] = useState<AnimeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Selected Anime & Episode State
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [selectedEpisodeUrl, setSelectedEpisodeUrl] = useState<string>('');
  const [episodeDetail, setEpisodeDetail] = useState<EpisodeDetailResponse | null>(null);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState<boolean>(false);
  const [episodeError, setEpisodeError] = useState<string>('');

  // Active Stream / Provider State
  const [activeIframeUrl, setActiveIframeUrl] = useState<string>('');
  const [activeMirrorName, setActiveMirrorName] = useState<string>('Default Server');
  const [playerKey, setPlayerKey] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Check URL Key & LocalStorage on mount
  useEffect(() => {
    const urlKey = searchParams.get('key');
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('nibokuu_studio_key') : null;

    if (urlKey === AUTHORIZED_KEY || storedKey === AUTHORIZED_KEY) {
      setIsAuthenticated(true);
      if (urlKey === AUTHORIZED_KEY && typeof window !== 'undefined') {
        localStorage.setItem('nibokuu_studio_key', urlKey);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, [searchParams]);

  // Trigger toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Handle Manual Password Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim() === AUTHORIZED_KEY) {
      setIsAuthenticated(true);
      setAuthError('');
      if (typeof window !== 'undefined') {
        localStorage.setItem('nibokuu_studio_key', keyInput.trim());
      }
      router.replace(`/watch?key=${encodeURIComponent(keyInput.trim())}`);
    } else {
      setAuthError('Kunci akses salah. Silakan periksa kembali!');
    }
  };

  // Fetch Recent Anime
  const fetchRecentAnime = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/recent');
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setRecentList(json.data);
      }
    } catch (err: any) {
      console.error('Error fetching recent anime:', err);
      showToast('Gagal memuat anime terbaru');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentAnime();
    }
  }, [isAuthenticated, fetchRecentAnime]);

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setActiveTab('search');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setSearchResults(json.data);
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      showToast('Gagal melakukan pencarian');
    } finally {
      setIsSearching(false);
    }
  };

  // Select an Anime & Load details / episode
  const handleSelectAnime = async (item: AnimeItem) => {
    setSelectedAnime(item);
    const targetUrl = item.link;
    if (!targetUrl) return;

    setIsLoadingEpisode(true);
    setEpisodeError('');
    setEpisodeDetail(null);
    setActiveIframeUrl('');

    try {
      const res = await fetch(`/api/episode?url=${encodeURIComponent(targetUrl)}`);
      const data: EpisodeDetailResponse = await res.json();

      if (data.status === 'success') {
        setEpisodeDetail(data);

        // If it's a direct episode page, select it
        if (!data.isAnimeDetail) {
          setSelectedEpisodeUrl(targetUrl);
          if (data.iframeUrl) {
            setActiveIframeUrl(data.iframeUrl);
            setActiveMirrorName('Server Utama (Default)');
          } else if (data.mirrors && data.mirrors.length > 0 && data.mirrors[0].link) {
            setActiveIframeUrl(data.mirrors[0].link);
            setActiveMirrorName(data.mirrors[0].name);
          }
        } else if (data.episodes && data.episodes.length > 0) {
          // If it's an anime detail page, automatically pick the first episode (e.g. Episode 1)
          const firstEp = data.episodes[0];
          handleSelectEpisode(firstEp.link, data);
        }
      } else {
        setEpisodeError('Gagal memuat rincian episode.');
      }
    } catch (err: any) {
      console.error('Episode fetch error:', err);
      setEpisodeError('Terjadi kesalahan saat memuat data episode.');
    } finally {
      setIsLoadingEpisode(false);
    }
  };

  // Select a specific episode from the list
  const handleSelectEpisode = async (epUrl: string, parentData?: EpisodeDetailResponse | null) => {
    setSelectedEpisodeUrl(epUrl);
    setIsLoadingEpisode(true);
    setEpisodeError('');
    setActiveIframeUrl('');

    try {
      const res = await fetch(`/api/episode?url=${encodeURIComponent(epUrl)}`);
      const data: EpisodeDetailResponse = await res.json();

      if (data.status === 'success') {
        // Merge episodes list from parent if missing in single episode response
        const mergedEpisodes = (data.episodes && data.episodes.length > 0)
          ? data.episodes
          : (parentData?.episodes || episodeDetail?.episodes || []);

        setEpisodeDetail({
          ...data,
          episodes: mergedEpisodes
        });

        if (data.iframeUrl) {
          setActiveIframeUrl(data.iframeUrl);
          setActiveMirrorName('Server Utama (Default)');
        } else if (data.mirrors && data.mirrors.length > 0 && data.mirrors[0].link) {
          setActiveIframeUrl(data.mirrors[0].link);
          setActiveMirrorName(data.mirrors[0].name);
        }
      } else {
        setEpisodeError('Gagal memuat video stream episode ini.');
      }
    } catch (err: any) {
      console.error('Episode error:', err);
      setEpisodeError('Terjadi kesalahan saat memuat video.');
    } finally {
      setIsLoadingEpisode(false);
    }
  };

  // Switch Video Provider / Mirror
  const handleSelectMirror = (mirror: MirrorItem) => {
    if (!mirror.link) {
      showToast('Link untuk provider ini tidak tersedia.');
      return;
    }
    setActiveMirrorName(mirror.name);
    setActiveIframeUrl(mirror.link);
    setPlayerKey((prev) => prev + 1);
    showToast(`Beralih ke provider: ${mirror.name}`);
  };

  // Next / Prev Episode navigation
  const currentIndex = useMemo(() => {
    if (!episodeDetail?.episodes || !selectedEpisodeUrl) return -1;
    return episodeDetail.episodes.findIndex((ep) => ep.link === selectedEpisodeUrl);
  }, [episodeDetail, selectedEpisodeUrl]);

  const hasPrev = currentIndex > 0;
  const hasNext = episodeDetail?.episodes && currentIndex >= 0 && currentIndex < episodeDetail.episodes.length - 1;

  const handlePrevEpisode = () => {
    if (hasPrev && episodeDetail?.episodes) {
      handleSelectEpisode(episodeDetail.episodes[currentIndex - 1].link);
    }
  };

  const handleNextEpisode = () => {
    if (hasNext && episodeDetail?.episodes) {
      handleSelectEpisode(episodeDetail.episodes[currentIndex + 1].link);
    }
  };

  // If Not Authenticated -> Show Secret Key Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-8 relative">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4 ring-4 ring-indigo-500/20">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Nibokuu Stream Studio
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Halaman ini diproteksi. Masukkan parameter key untuk membuka akses player & stream extractor.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 relative">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Secret Access Key
              </label>
              <input
                type="password"
                placeholder="Masukkan key akses..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-all outline-none"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 hover:from-indigo-500 to-purple-600 hover:to-purple-500 font-semibold rounded-xl text-sm text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Buka Stream Studio</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Kunci URL: <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded">?key={AUTHORIZED_KEY}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 backdrop-blur-md border border-indigo-500/40 text-indigo-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-toast">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#06080d]/80 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/20">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
              <span>Nibokuu Stream Studio</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Live PRO
              </span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Player Ekstraktor Anime & Pemilih Provider Video
            </p>
          </div>
        </div>

        {/* Search Bar in Header */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Cari judul anime (mis: Jujutsu Kaisen, Solo Leveling)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-white placeholder-slate-500 transition-all outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('recent');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        {/* Lock & Auth Status */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Unlocked</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-8">
        {/* TOP SECTION: VIDEO PLAYER & PROVIDER SWITCHER */}
        <section className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-4 lg:p-6 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Main Player Stage */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center group">
                {isLoadingEpisode ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-xs font-medium animate-pulse">Menghubungkan ke Server Video & Bypass Scraper...</span>
                  </div>
                ) : activeIframeUrl ? (
                  <iframe
                    key={playerKey}
                    src={activeIframeUrl}
                    title="Anime Stream Player"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-500 p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-300">Belum ada anime yang diputar</p>
                    <p className="text-xs max-w-sm text-slate-500">
                      Pilih anime terbaru di bawah atau cari judul anime favorit kamu untuk mulai menonton.
                    </p>
                  </div>
                )}

                {/* Direct Link / Popout Controls */}
                {activeIframeUrl && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setPlayerKey((p) => p + 1)}
                      title="Reload Player"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <a
                      href={activeIframeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Buka Iframe di Tab Baru"
                      className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* Player Header / Title & Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    {episodeDetail?.title || selectedAnime?.title || 'Studio Video Player'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="text-indigo-400 font-semibold">{activeMirrorName}</span>
                    <span>•</span>
                    <span>Nibokuu Edge Extractor</span>
                  </div>
                </div>

                {/* Prev / Next Episode Buttons */}
                {episodeDetail?.episodes && episodeDetail.episodes.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handlePrevEpisode}
                      disabled={!hasPrev || isLoadingEpisode}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                        hasPrev
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Prev Ep</span>
                    </button>

                    <button
                      onClick={handleNextEpisode}
                      disabled={!hasNext || isLoadingEpisode}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                        hasNext
                          ? 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <span>Next Ep</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Provider & Episode Picker */}
            <div className="flex flex-col gap-5 border-t lg:border-t-0 lg:border-l border-slate-800/80 lg:pl-6 pt-4 lg:pt-0">
              {/* Provider / Server Options */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  <span>Pilih Provider / Server Video</span>
                </h3>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {/* Default / Embed server */}
                  {episodeDetail?.iframeUrl && (
                    <button
                      onClick={() => {
                        setActiveMirrorName('Server Utama (Default)');
                        setActiveIframeUrl(episodeDetail.iframeUrl || '');
                        setPlayerKey((p) => p + 1);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
                        activeMirrorName === 'Server Utama (Default)'
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Server Utama (Default)</span>
                    </button>
                  )}

                  {/* Dynamic Mirrors / Providers */}
                  {episodeDetail?.mirrors && episodeDetail.mirrors.length > 0 ? (
                    episodeDetail.mirrors.map((mirror, idx) => {
                      const isActive = activeMirrorName === mirror.name;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectMirror(mirror)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${mirror.link ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                          <span>{mirror.name}</span>
                        </button>
                      );
                    })
                  ) : (
                    !episodeDetail?.iframeUrl && (
                      <p className="text-xs text-slate-500 italic">Belum ada episode / provider yang dipilih.</p>
                    )
                  )}
                </div>
              </div>

              {/* Episode Picker (Milih APD / Episode) */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Daftar Episode ({episodeDetail?.episodes?.length || 0})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
                  {episodeDetail?.episodes && episodeDetail.episodes.length > 0 ? (
                    episodeDetail.episodes.map((ep, idx) => {
                      const isSelected = selectedEpisodeUrl === ep.link;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectEpisode(ep.link)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                              : 'bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {ep.episode ? `Ep ${ep.episode}` : `Ep ${idx + 1}`}
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500 italic">
                      {isLoadingEpisode ? 'Memuat daftar episode...' : 'Pilih anime untuk melihat episode'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM SECTION: ANIME CATALOG (RECENT & SEARCH) */}
        <section className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('recent')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                  activeTab === 'recent'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Anime Terbaru</span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 text-[10px]">
                  {recentList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                  activeTab === 'search'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Hasil Pencarian</span>
                {searchResults.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 text-[10px]">
                    {searchResults.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'recent' && (
              <button
                onClick={fetchRecentAnime}
                disabled={isLoadingList}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 transition"
              >
                <svg className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Anime Grid Cards */}
          {activeTab === 'recent' ? (
            isLoadingList ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800/60" />
                ))}
              </div>
            ) : recentList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {recentList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAnime(item)}
                    className="group relative bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-indigo-950/40 flex flex-col"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
                      )}
                      {item.episode && (
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-indigo-600/90 backdrop-blur-md text-[11px] font-bold text-white shadow-md">
                          Ep {item.episode}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 line-clamp-2 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 mt-2 font-medium">Klik untuk memutar</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm">Tidak ada data anime terbaru ditemukan.</div>
            )
          ) : (
            /* Search Results Tab */
            isSearching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800/60" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAnime(item)}
                    className="group relative bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-indigo-950/40 flex flex-col"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
                      )}
                      {item.score && (
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-amber-500/90 backdrop-blur-md text-[11px] font-bold text-slate-950 shadow-md flex items-center gap-1">
                          ★ {item.score}
                        </div>
                      )}
                      {item.type && (
                        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-900/90 backdrop-blur-md text-[10px] font-semibold text-slate-300">
                          {item.type}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 line-clamp-2 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 mt-2 font-medium">Buka Episode</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-sm">
                {searchQuery ? `Tidak ada hasil pencarian untuk "${searchQuery}".` : 'Ketik judul anime pada kotak pencarian di atas.'}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#06080d] flex items-center justify-center text-indigo-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Memuat Studio...</span>
          </div>
        </div>
      }
    >
      <WatchPageContent />
    </Suspense>
  );
}
