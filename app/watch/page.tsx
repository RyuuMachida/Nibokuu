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

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const [sidebarTab, setSidebarTab] = useState<'recent' | 'search'>('recent');
  const [recentList, setRecentList] = useState<AnimeItem[]>([]);
  const [searchResults, setSearchResults] = useState<AnimeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [selectedEpisodeUrl, setSelectedEpisodeUrl] = useState<string>('');
  const [episodeDetail, setEpisodeDetail] = useState<EpisodeDetailResponse | null>(null);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState<boolean>(false);
  const [episodeError, setEpisodeError] = useState<string>('');

  const [activeIframeUrl, setActiveIframeUrl] = useState<string>('');
  const [activeMirrorName, setActiveMirrorName] = useState<string>('Server Utama');
  const [playerKey, setPlayerKey] = useState<number>(0);

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
      setAuthError('Key akses tidak valid');
    }
  };

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
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentAnime();
    }
  }, [isAuthenticated, fetchRecentAnime]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSidebarTab('search');
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
    } finally {
      setIsSearching(false);
    }
  };

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

        if (!data.isAnimeDetail) {
          setSelectedEpisodeUrl(targetUrl);
          if (data.iframeUrl) {
            setActiveIframeUrl(data.iframeUrl);
            setActiveMirrorName('Server Utama');
          } else if (data.mirrors && data.mirrors.length > 0 && data.mirrors[0].link) {
            setActiveIframeUrl(data.mirrors[0].link);
            setActiveMirrorName(data.mirrors[0].name);
          }
        } else if (data.episodes && data.episodes.length > 0) {
          const firstEp = data.episodes[0];
          handleSelectEpisode(firstEp.link, data);
        }
      } else {
        setEpisodeError('Gagal memuat rincian episode.');
      }
    } catch (err: any) {
      console.error('Episode fetch error:', err);
      setEpisodeError('Terjadi kesalahan saat memuat data.');
    } finally {
      setIsLoadingEpisode(false);
    }
  };

  const handleSelectEpisode = async (epUrl: string, parentData?: EpisodeDetailResponse | null) => {
    setSelectedEpisodeUrl(epUrl);
    setIsLoadingEpisode(true);
    setEpisodeError('');
    setActiveIframeUrl('');

    try {
      const res = await fetch(`/api/episode?url=${encodeURIComponent(epUrl)}`);
      const data: EpisodeDetailResponse = await res.json();

      if (data.status === 'success') {
        const mergedEpisodes = (data.episodes && data.episodes.length > 0)
          ? data.episodes
          : (parentData?.episodes || episodeDetail?.episodes || []);

        setEpisodeDetail({
          ...data,
          episodes: mergedEpisodes
        });

        if (data.iframeUrl) {
          setActiveIframeUrl(data.iframeUrl);
          setActiveMirrorName('Server Utama');
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

  const handleSelectMirror = (mirror: MirrorItem) => {
    if (!mirror.link) return;
    setActiveMirrorName(mirror.name);
    setActiveIframeUrl(mirror.link);
    setPlayerKey((prev) => prev + 1);
  };

  const currentIndex = useMemo(() => {
    if (!episodeDetail?.episodes || !selectedEpisodeUrl) return -1;
    return episodeDetail.episodes.findIndex((ep) => ep.link === selectedEpisodeUrl);
  }, [episodeDetail, selectedEpisodeUrl]);

  const hasPrev = currentIndex > 0;
  const hasNext = episodeDetail?.episodes && currentIndex >= 0 && currentIndex < episodeDetail.episodes.length - 1;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
        <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900 p-6">
          <div className="border-b border-zinc-800 pb-4 mb-5">
            <h1 className="text-sm font-semibold text-zinc-100">Nibokuu Stream Studio</h1>
            <p className="text-xs text-zinc-400 mt-1">Akses memerlukan parameter key valid.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Kunci Akses</label>
              <input
                type="password"
                placeholder="Masukkan key..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 outline-none"
              />
            </div>

            {authError && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 px-2.5 py-1.5">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition-colors"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans antialiased text-xs">
      {/* Top Header - Search Box Only */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-center shrink-0">
        <form onSubmit={handleSearch} className="flex items-center w-full max-w-xl border border-zinc-800 bg-zinc-950">
          <input
            type="text"
            placeholder="Cari anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none"
          />
          <button type="submit" className="px-4 py-1.5 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800 text-xs">
            Cari
          </button>
        </form>
      </header>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center: Video Player & Episode / Provider Controls */}
        <main className="flex-1 flex flex-col overflow-y-auto border-r border-zinc-800">
          {/* 1. Video Player Area */}
          <div className="aspect-video w-full bg-black border-b border-zinc-800 relative flex items-center justify-center">
            {isLoadingEpisode ? (
              <div className="text-zinc-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-400 animate-ping" />
                <span>Memuat player stream...</span>
              </div>
            ) : activeIframeUrl ? (
              <iframe
                key={playerKey}
                src={activeIframeUrl}
                title="Player"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="text-zinc-500 text-center px-4">
                Pilih salah satu episode dari daftar di bawah untuk mulai memutar video.
              </div>
            )}
          </div>

          {/* 2. Player Controls & Metadata Bar */}
          <div className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {episodeDetail?.title || selectedAnime?.title || 'Belum ada anime dipilih'}
              </h2>
              <p className="text-zinc-500 text-[11px] mt-0.5">
                Provider aktif: <span className="text-zinc-300">{activeMirrorName}</span>
              </p>
            </div>

            {episodeDetail?.episodes && episodeDetail.episodes.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    if (hasPrev && episodeDetail?.episodes) {
                      handleSelectEpisode(episodeDetail.episodes[currentIndex - 1].link);
                    }
                  }}
                  disabled={!hasPrev || isLoadingEpisode}
                  className={`px-2.5 py-1 border border-zinc-800 text-[11px] ${
                    hasPrev ? 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : 'text-zinc-600 bg-zinc-950 cursor-not-allowed'
                  }`}
                >
                  Prev Ep
                </button>

                <button
                  onClick={() => {
                    if (hasNext && episodeDetail?.episodes) {
                      handleSelectEpisode(episodeDetail.episodes[currentIndex + 1].link);
                    }
                  }}
                  disabled={!hasNext || isLoadingEpisode}
                  className={`px-2.5 py-1 border border-zinc-800 text-[11px] ${
                    hasNext ? 'bg-zinc-100 text-zinc-950 hover:bg-white font-medium' : 'text-zinc-600 bg-zinc-950 cursor-not-allowed'
                  }`}
                >
                  Next Ep
                </button>

                {activeIframeUrl && (
                  <a
                    href={activeIframeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px]"
                  >
                    Buka Tab Baru
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 3. Provider / Server Picker */}
          <div className="border-b border-zinc-800 p-4">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Pilihan Provider / Server
            </span>

            <div className="flex flex-wrap gap-1.5">
              {episodeDetail?.iframeUrl && (
                <button
                  onClick={() => {
                    setActiveMirrorName('Server Utama');
                    setActiveIframeUrl(episodeDetail.iframeUrl || '');
                    setPlayerKey((p) => p + 1);
                  }}
                  className={`px-3 py-1.5 border text-xs transition-colors ${
                    activeMirrorName === 'Server Utama'
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-medium'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Server Utama
                </button>
              )}

              {episodeDetail?.mirrors && episodeDetail.mirrors.length > 0 ? (
                episodeDetail.mirrors.map((mirror, idx) => {
                  const isActive = activeMirrorName === mirror.name;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectMirror(mirror)}
                      className={`px-3 py-1.5 border text-xs transition-colors ${
                        isActive
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-medium'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {mirror.name}
                    </button>
                  );
                })
              ) : (
                !episodeDetail?.iframeUrl && (
                  <span className="text-zinc-500 text-xs italic">Tidak ada provider khusus</span>
                )
              )}
            </div>
          </div>

          {/* 4. Episode List (APD / Episode Picker) */}
          <div className="p-4 flex-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Daftar Episode ({episodeDetail?.episodes?.length || 0})
            </span>

            {episodeDetail?.episodes && episodeDetail.episodes.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                {episodeDetail.episodes.map((ep, idx) => {
                  const isSelected = selectedEpisodeUrl === ep.link;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectEpisode(ep.link)}
                      className={`py-2 px-1 text-center border text-xs transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {ep.episode ? `Ep ${ep.episode}` : `Ep ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-zinc-500 text-xs italic py-4">
                {isLoadingEpisode ? 'Memuat daftar episode...' : 'Pilih judul anime dari panel kanan'}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Anime Catalog / Search Results */}
        <aside className="w-full lg:w-80 xl:w-96 flex flex-col bg-zinc-900/30 overflow-hidden shrink-0 border-t lg:border-t-0">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button
              onClick={() => setSidebarTab('recent')}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                sidebarTab === 'recent'
                  ? 'border-zinc-200 text-zinc-100 bg-zinc-800/40'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Anime Terbaru ({recentList.length})
            </button>

            <button
              onClick={() => setSidebarTab('search')}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                sidebarTab === 'search'
                  ? 'border-zinc-200 text-zinc-100 bg-zinc-800/40'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Pencarian {searchResults.length > 0 && `(${searchResults.length})`}
            </button>
          </div>

          {/* List Items (Monolithic Border Connected) */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
            {sidebarTab === 'recent' ? (
              isLoadingList ? (
                <div className="p-4 text-zinc-500 text-center">Memuat anime terbaru...</div>
              ) : recentList.length > 0 ? (
                recentList.map((item, idx) => {
                  const isSelected = selectedAnime?.title === item.title;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectAnime(item)}
                      className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-800/80 text-white' : 'hover:bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-12 h-16 object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-100 leading-snug line-clamp-2">
                          {item.title}
                        </div>
                        {item.episode && (
                          <span className="inline-block mt-1 text-[10px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5">
                            Episode {item.episode}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-zinc-500 text-center">Tidak ada data.</div>
              )
            ) : (
              /* Search Tab */
              isSearching ? (
                <div className="p-4 text-zinc-500 text-center">Mencari anime...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item, idx) => {
                  const isSelected = selectedAnime?.title === item.title;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectAnime(item)}
                      className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-800/80 text-white' : 'hover:bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-16 object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-100 leading-snug line-clamp-2">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {item.score && (
                            <span className="text-[10px] text-zinc-300 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5">
                              Skor {item.score}
                            </span>
                          )}
                          {item.type && (
                            <span className="text-[10px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5">
                              {item.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-zinc-500 text-center">
                  {searchQuery ? 'Hasil pencarian kosong.' : 'Ketik judul anime pada kotak pencarian di atas.'}
                </div>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-xs">
          Memuat...
        </div>
      }
    >
      <WatchPageContent />
    </Suspense>
  );
}
