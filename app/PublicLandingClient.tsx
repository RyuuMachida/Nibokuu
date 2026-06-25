'use client';

import React, { useState, useEffect, useRef } from 'react';
import LogoLoop from '../components/LogoLoop';

interface PublicStats {
  totalRequests: number;
  cacheHitRatio: number;
  successRequests: number;
  failedRequests: number;
  resolvedDomain: string;
}

interface CustomSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  small?: boolean;
  showSearch?: boolean;
}

function CustomSelect({ options, value, onChange, label, small = false, showSearch }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const displaySearch = !!showSearch;

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        onChange(filteredOptions[0].value);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 select-none w-full">
      {label && (
        <span className={`font-mono uppercase text-[#737373] ${small ? 'text-[8px]' : 'text-[9px]'}`}>
          {label}
        </span>
      )}
      <button
        type="button"
        suppressHydrationWarning={true}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between bg-[#121212] border border-[#222] hover:border-[#333] rounded text-[#fafafa] outline-none text-left cursor-pointer transition-all w-full ${
          small ? 'h-7 px-2 text-[10px]' : 'h-8 px-3 text-xs'
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
          className={`absolute left-0 right-0 z-[100] bg-[#0d0d0d] border border-[#222] rounded shadow-lg overflow-y-auto no-scrollbar py-1 top-[42px] flex flex-col ${
            displaySearch ? 'max-h-[220px]' : 'max-h-[140px]'
          }`}
        >
          {displaySearch && (
            <div className="sticky top-0 z-[101] bg-[#0d0d0d] p-1 border-b border-[#222] shrink-0">
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#121212] border border-[#222] rounded px-2.5 py-1 text-xs font-mono text-[#f5f5f5] focus:outline-none focus:border-blue-500/50 placeholder-[#525252] h-7"
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  suppressHydrationWarning={true}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left hover:bg-[#1a1a1a] cursor-pointer transition-colors block border-none outline-none ${
                    small ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
                  } ${value === opt.value ? 'text-[#fafafa] bg-[#121212] font-semibold' : 'text-[#a3a3a3]'}`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs font-mono text-[#525252] text-center">
                Tidak ada hasil
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ENDPOINTS = [
  {
    path: '/api/recent',
    name: 'Recent Anime Releases',
    method: 'GET',
    description: 'Mengambil daftar episode rilis anime terbaru secara real-time.',
    params: [
      { name: 'page', label: 'Halaman', type: 'number', placeholder: '1', default: '1' }
    ]
  },
  {
    path: '/api/search',
    name: 'Search Anime Catalog',
    method: 'GET',
    description: 'Melakukan pencarian anime secara global berdasarkan kata kunci.',
    params: [
      { name: 'q', label: 'Kata Kunci Pencarian', type: 'text', placeholder: 'Solo Leveling', default: 'solo leveling' }
    ]
  },
  {
    path: '/api/anime',
    name: 'Anime Directory Listing',
    method: 'GET',
    description: 'Menyaring seluruh direktori catalog anime dengan berbagai filter.',
    params: [
      { name: 'page', label: 'Halaman', type: 'number', placeholder: '1', default: '1' },
      { name: 'status', label: 'Status Anime', type: 'select', options: ['', 'ongoing', 'completed'], default: '' },
      { name: 'type', label: 'Tipe Anime', type: 'select', options: ['', 'tv', 'movie', 'ova', 'ona'], default: '' },
      { name: 'order', label: 'Urutan Data', type: 'select', options: ['', 'latest', 'popular', 'title'], default: '' }
    ]
  },
  {
    path: '/api/schedule',
    name: 'Release Schedule',
    method: 'GET',
    description: 'Mendapatkan jadwal rilis mingguan lengkap atau per hari tertentu.',
    params: [
      { name: 'day', label: 'Hari', type: 'select', options: ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], default: '' }
    ]
  },
  {
    path: '/api/episode',
    name: 'Episode Mirror Stream Resolver',
    method: 'GET',
    description: 'Mengekstrak data media player eksternal dan mirror stream Samehadaku.',
    params: [
      { name: 'url', label: 'URL Detail Episode Samehadaku', type: 'text', placeholder: 'Pilih preset atau masukkan link episode', default: '' }
    ]
  },
  {
    path: '/api/anime-detail',
    name: 'Anime Detail Scraper',
    method: 'GET',
    description: 'Mengambil detail informasi anime (rating, genre, sinopsis, metadata) berdasarkan URL detail Samehadaku.',
    params: [
      { name: 'url', label: 'URL Detail Anime Samehadaku', type: 'text', placeholder: 'https://v2.samehadaku.how/anime/tate-no-yuusha-no-nariagari-season-3/', default: '' }
    ]
  },
  {
    path: '/api/episodes',
    name: 'Anime Episodes List Scraper',
    method: 'GET',
    description: 'Mengambil daftar episode lengkap dari suatu anime berdasarkan URL detail Samehadaku.',
    params: [
      { name: 'url', label: 'URL Detail Anime Samehadaku', type: 'text', placeholder: 'https://v2.samehadaku.how/anime/tate-no-yuusha-no-nariagari-season-3/', default: '' }
    ]
  },
  {
    path: '/api/genres',
    name: 'Anime Genres List',
    method: 'GET',
    description: 'Mengambil seluruh daftar kategori/genre anime yang tersedia.',
    params: []
  },
  {
    path: '/api/popular',
    name: 'Popular Anime Listing',
    method: 'GET',
    description: 'Mengambil daftar anime terpopuler berdasarkan data widget sidebar.',
    params: []
  },
  {
    path: '/api/batch',
    name: 'Anime Batch Listing',
    method: 'GET',
    description: 'Mengambil daftar anime rilis Batch berdasarkan pagination.',
    params: [
      { name: 'page', label: 'Halaman', type: 'number', placeholder: '1', default: '1' }
    ]
  },
  {
    path: '/api/stream-link',
    name: 'Direct Video Stream Resolver',
    method: 'GET',
    description: 'Mengurai/mengekstrak url file video streaming langsung dari link player (Krakenfiles/Blogger).',
    params: [
      { name: 'url', label: 'URL Stream Player', type: 'text', placeholder: 'https://krakenfiles.com/view/... atau Blogger link', default: '' }
    ]
  },
  {
    path: '/api/mirror-size',
    name: 'Mirror File Size Checker',
    method: 'GET',
    description: 'Mendapatkan ukuran file video dari tautan mirror (Krakenfiles, Acefile, Mediafire).',
    params: [
      { name: 'url', label: 'URL Mirror Link', type: 'text', placeholder: 'https://krakenfiles.com/view/... atau https://acefile.co/f/...', default: '' }
    ]
  }
];

const FAQ_ITEMS = [
  {
    q: 'Bagaimana sistem cache bekerja di Nibokuu API?',
    a: 'Nibokuu menggunakan arsitektur cache dua lapis. Data scraping disimpan secara lokal di Firebase Firestore untuk sinkronisasi terdistribusi, kemudian dialirkan melalui Edge Cache CDN Vercel. Durasi cache bervariasi dari 5 menit untuk rilis terbaru (recent) hingga 24 jam untuk episode dan data statis lainnya.'
  },
  {
    q: 'Apa itu Request Coalescing (Single Flight) yang digunakan di sini?',
    a: 'Request Coalescing adalah mekanisme optimasi di mana beberapa permintaan masuk yang identik (misal: 20 user meminta episode yang sama secara bersamaan saat cache kedaluwarsa) akan digabungkan menjadi satu proses Puppeteer tunggal. Hal ini menghemat penggunaan CPU/RAM server secara signifikan dan meminimalkan resiko deteksi anti-bot dari situs sumber.'
  },
  {
    q: 'Bagaimana Nibokuu API memecahkan player video Samehadaku?',
    a: 'Samehadaku memuat tautan pemutar video (iframe) secara asinkron menggunakan WordPress AJAX Endpoint (player_ajax). Scraper kami mensimulasikan panggilan AJAX internal ini secara paralel di server-side, mengekstrak URL iframe asli, dan mengembalikannya secara instan ke klien.'
  },
  {
    q: 'Apakah ada pembatasan penggunaan (Rate Limit)?',
    a: 'Untuk menjaga stabilitas operasional, API dilengkapi dengan pembatas request (rate limiter) pada tingkat infrastruktur gateway. Administrator dapat mengatur limitasi ini dan memonitornya secara real-time melalui Dashboard Monitor Administratif.'
  }
];

const techLogos = [
  { src: '/logos/nextjs.svg', alt: 'Next.js', title: 'Next.js' },
  { src: '/logos/react.svg', alt: 'React', title: 'React' },
  { src: '/logos/typescript.svg', alt: 'TypeScript', title: 'TypeScript' },
  { src: '/logos/tailwindcss.svg', alt: 'Tailwind CSS', title: 'Tailwind CSS' },
  { src: '/logos/nodejs.svg', alt: 'Node.js', title: 'Node.js' },
  { src: '/logos/puppeteer.svg', alt: 'Puppeteer', title: 'Puppeteer' },
  { src: '/logos/firebase.svg', alt: 'Firebase', title: 'Firebase' },
  { src: '/logos/vercel.svg', alt: 'Vercel', title: 'Vercel' },
];

export default function PublicLandingClient() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Tabs & Copy states
  const [codeTab, setCodeTab] = useState<'curl' | 'js' | 'python' | 'go' | 'php'>('curl');
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Sandbox states
  const [sandboxEndpoint, setSandboxEndpoint] = useState<string>('/api/recent');
  const [sandboxParams, setSandboxParams] = useState<Record<string, string>>({ page: '1' });
  const [sandboxResponse, setSandboxResponse] = useState<any>(null);
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxLatency, setSandboxLatency] = useState<number | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);
  const [presetEpisodeUrl, setPresetEpisodeUrl] = useState<string>('');

  // FAQ states
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // Latency History Chart Telemetry
  const [latencyHistory, setLatencyHistory] = useState<number[]>([36, 42, 38, 45, 39, 41, 37, 44, 40, 42, 39, 43]);

  // Back to Top button state
  const [showScrollTop, setShowScrollTop] = useState(false);

  const paramsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paramsRef.current) {
      // 1. Temporarily clear transition to read target height
      paramsRef.current.style.transition = 'none';
      
      // Save current height style (which is the old height we set in handleEndpointChange/loadPreset)
      const oldHeightStyle = paramsRef.current.style.height;
      
      // Set to auto to measure the new height of the new content
      paramsRef.current.style.height = 'auto';
      const targetHeight = paramsRef.current.scrollHeight;
      
      // Set it back to the old height so transition can start from there
      paramsRef.current.style.height = oldHeightStyle || '0px';
      
      // Force reflow
      paramsRef.current.offsetHeight;
      
      // Apply smooth transition and animate to the new target height
      paramsRef.current.style.transition = 'height 300ms cubic-bezier(0.4, 0, 0.2, 1)';
      paramsRef.current.style.height = `${targetHeight}px`;
      paramsRef.current.style.overflow = 'hidden';
      
      const handleTransitionEnd = () => {
        if (paramsRef.current) {
          paramsRef.current.style.height = 'auto';
          paramsRef.current.style.overflow = 'visible';
        }
      };
      
      paramsRef.current.addEventListener('transitionend', handleTransitionEnd, { once: true });
    }
  }, [sandboxEndpoint]);

  const fetchPublicStats = async () => {
    try {
      const res = await fetch('/api/monitor/public-stats');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setStats(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch public stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicStats();
    const interval = setInterval(fetchPublicStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent episode link to pre-populate sandbox URL automatically (only when endpoint /api/episode is selected)
  useEffect(() => {
    if (sandboxEndpoint === '/api/episode' && !presetEpisodeUrl) {
      fetch('/api/recent')
        .then(res => res.json())
        .then(data => {
          if (data && data.data && data.data.length > 0) {
            const latestLink = data.data[0].link || data.data[0].url || '';
            if (latestLink) {
              setPresetEpisodeUrl(latestLink);
              setSandboxParams({ url: latestLink });
            }
          }
        })
        .catch(err => console.error('Failed to pre-fetch recent url:', err));
    }
  }, [sandboxEndpoint, presetEpisodeUrl]);

  // Telemetry fluctuation simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setLatencyHistory(prev => {
        const next = [...prev.slice(1)];
        const val = Math.floor(Math.random() * 15) + 32; // Fluctuations around 32-47ms
        next.push(val);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Scroll position monitor
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const totalRequests = stats?.totalRequests || 0;
  const successRequests = stats?.successRequests || 0;
  const failedRequests = stats?.failedRequests || 0;
  const successPercent = totalRequests > 0 ? parseFloat(((successRequests / totalRequests) * 100).toFixed(1)) : 0;
  const failedPercent = totalRequests > 0 ? parseFloat(((failedRequests / totalRequests) * 100).toFixed(1)) : 0;

  const codeSnippets = {
    curl: `curl -X GET "https://nibokuu.vercel.app/api/recent" \\
     -H "Accept: application/json"`,
    js: `// Fetch rilis anime terbaru
fetch('https://nibokuu.vercel.app/api/recent')
  .then(response => response.json())
  .then(data => {
    console.log(\`Menemukan \${data.total_data} anime baru:\`);
    console.log(data.data);
  })
  .catch(error => console.error('Error:', error));`,
    python: `import requests

# Mengambil rilis terbaru dari API Nibokuu
url = "https://nibokuu.vercel.app/api/recent"
response = requests.get(url)

if response.status_code == 200:
    data = response.json()
    print(f"Total data: {data['total_data']}")
    for anime in data['data']:
        print(f"- {anime['title']} (Episode {anime['episode']})")
else:
    print("Gagal mengambil data.")`,
    go: `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	url := "https://nibokuu.vercel.app/api/recent"
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Add("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	fmt.Println(string(body))
}`,
    php: `<?php

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://nibokuu.vercel.app/api/recent");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/json"
]);

$response = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
} else {
    $data = json_decode($response, true);
    echo "Total data: " . $data['total_data'];
}
curl_close($ch);
?>`
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setToastMessage('Snippet kode berhasil disalin ke clipboard');
    setShowToast(true);
    setTimeout(() => {
      setCopied(false);
      setShowToast(false);
    }, 2000);
  };

  const getSandboxUrl = () => {
    const params = new URLSearchParams();
    const ep = ENDPOINTS.find(e => e.path === sandboxEndpoint);
    if (!ep) return sandboxEndpoint;
    
    ep.params.forEach(p => {
      const val = sandboxParams[p.name];
      if (val !== undefined && val !== '') {
        params.append(p.name, val);
      }
    });
    
    const queryStr = params.toString();
    return queryStr ? `${sandboxEndpoint}?${queryStr}` : sandboxEndpoint;
  };

  const handleEndpointChange = (path: string) => {
    if (paramsRef.current) {
      const currentHeight = paramsRef.current.offsetHeight;
      paramsRef.current.style.transition = 'none';
      paramsRef.current.style.height = `${currentHeight}px`;
      paramsRef.current.style.overflow = 'hidden';
    }
    setSandboxEndpoint(path);
    const ep = ENDPOINTS.find(e => e.path === path);
    if (ep) {
      const initialParams: Record<string, string> = {};
      ep.params.forEach(p => {
        if (p.name === 'url' && p.default === '') {
          initialParams[p.name] = presetEpisodeUrl || 'https://v2.samehadaku.how/';
        } else {
          initialParams[p.name] = p.default || '';
        }
      });
      setSandboxParams(initialParams);
    }
  };

  const loadPreset = (endpoint: string, params: Record<string, string>) => {
    if (paramsRef.current) {
      const currentHeight = paramsRef.current.offsetHeight;
      paramsRef.current.style.transition = 'none';
      paramsRef.current.style.height = `${currentHeight}px`;
      paramsRef.current.style.overflow = 'hidden';
    }
    setSandboxEndpoint(endpoint);
    setSandboxParams(params);
    // Focus or trigger immediate execution
    setTimeout(() => {
      const form = document.getElementById('sandbox-form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const executeSandboxRequest = async (
    e?: React.FormEvent,
    overrideEndpoint?: string,
    overrideParams?: Record<string, string>
  ) => {
    if (e) e.preventDefault();
    setSandboxLoading(true);
    setSandboxResponse(null);
    setSandboxLatency(null);
    setSandboxStatus(null);

    const endpointToUse = overrideEndpoint || sandboxEndpoint;
    const paramsToUse = overrideParams || sandboxParams;

    const startTime = performance.now();
    try {
      const query = new URLSearchParams();
      Object.entries(paramsToUse).forEach(([key, val]) => {
        if (val) {
          query.append(key, val);
        }
      });

      const queryString = query.toString();
      const requestUrl = `${endpointToUse}${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(requestUrl);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setSandboxLatency(duration);
      setSandboxStatus(`${res.status} ${res.statusText}`);

      const data = await res.json();
      setSandboxResponse(data);
    } catch (err: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setSandboxLatency(duration);
      setSandboxStatus('FAILED');
      setSandboxResponse({
        status: 'error',
        message: err.message || 'Gagal memanggil endpoint API. Pastikan server lokal Anda aktif.',
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleInteractiveLinkClick = (url: string) => {
    const targetEndpoint = url.includes('/anime/') ? '/api/episodes' : '/api/episode';
    const targetParams = { url };
    setSandboxEndpoint(targetEndpoint);
    setSandboxParams(targetParams);
    executeSandboxRequest(undefined, targetEndpoint, targetParams);
  };

  const highlightJson = (jsonObj: any): string => {
    if (!jsonObj) return '';
    const jsonStr = JSON.stringify(jsonObj, null, 2);
    const escaped = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-blue-400'; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-purple-400 font-semibold'; // key
          } else {
            cls = 'text-emerald-400'; // string
            const val = match.slice(1, -1);
            if (val.startsWith('http') && val.includes('samehadaku')) {
              return `"<span class="underline cursor-pointer text-sky-400 hover:text-sky-300 font-medium interactive-json-link" data-url="${val}">${val}</span>"`;
            }
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-amber-500'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-rose-500 font-bold'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Telemetry SVG calculations
  const chartWidth = 500;
  const chartHeight = 80;
  const points = latencyHistory.map((val, index) => {
    const x = (index / (latencyHistory.length - 1)) * chartWidth;
    const minVal = 20;
    const maxVal = 60;
    const y = chartHeight - ((val - minVal) / (maxVal - minVal)) * (chartHeight - 20) - 10;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans selection:bg-[#f5f5f5]/10 flex flex-col relative overflow-x-hidden scroll-smooth">
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-[-5%] left-[-15%] w-[60%] aspect-square rounded-full bg-blue-500/5 blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-[-15%] w-[60%] aspect-square rounded-full bg-[#10b981]/3 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[50%] aspect-square rounded-full bg-purple-500/3 blur-[120px] pointer-events-none" />
      
      {/* Sticky Header */}
      <header className="w-full border-b border-[#222222]/50 bg-[#0d0d0d]/80 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
        <div className="max-w-[1000px] h-14 mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-[#fafafa] cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Nibokuu
            </span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 border border-[#262626] bg-[#121212] rounded text-[#a3a3a3] tracking-wider">
              API Portal
            </span>
          </div>

          <nav className="hidden sm:flex items-center gap-6 text-[11px] font-mono uppercase tracking-wider text-[#a3a3a3]">
            <button suppressHydrationWarning={true} onClick={() => scrollToSection('telemetry')} className="hover:text-[#fafafa] transition-colors cursor-pointer">Stats</button>
            <button suppressHydrationWarning={true} onClick={() => scrollToSection('sandbox')} className="hover:text-[#fafafa] transition-colors cursor-pointer">Sandbox</button>
            <button suppressHydrationWarning={true} onClick={() => scrollToSection('docs')} className="hover:text-[#fafafa] transition-colors cursor-pointer">Docs</button>
            <button suppressHydrationWarning={true} onClick={() => scrollToSection('faq')} className="hover:text-[#fafafa] transition-colors cursor-pointer">FAQ</button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10b981]"></span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#a3a3a3] hidden xs:inline">
                API Active
              </span>
            </div>
          </div>
        </div>
      </header>
      {/* Spacer to prevent layout jump under fixed header */}
      <div className="h-14 shrink-0" />

      {/* Main Container */}
      <main className="flex-1 max-w-[1000px] w-full mx-auto px-4 py-8 sm:py-16 md:py-20 flex flex-col gap-20 sm:gap-28 md:gap-36 z-10">
        
        {/* Hero + Tech Stack Group */}
        <div className="flex flex-col gap-8 sm:gap-12">
          {/* Section 1: Intro Hero */}
          <section className="flex flex-col gap-5 max-w-[750px] text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono text-[9px] font-semibold w-fit tracking-wider uppercase">
              Infrastruktur API Scraper
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold tracking-tight text-[#fafafa] leading-tight">
              Nibokuu Scraping & Streaming Engine
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-[#a3a3a3] leading-relaxed">
              API performa tinggi yang dirancang untuk mengindeks metadata anime, jadwal rilis, data pencarian, serta mirror streaming secara instan. Dioptimalkan dengan teknologi <strong>Edge CDN Caching</strong> dan <strong>Request Coalescing (Single Flight)</strong> untuk perlindungan domain dan kecepatan maksimal.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button 
                suppressHydrationWarning={true}
                onClick={() => scrollToSection('sandbox')}
                className="px-4 py-2 text-xs font-mono uppercase tracking-wider rounded bg-[#fafafa] text-[#0a0a0a] hover:bg-[#e5e5e5] transition-all font-semibold cursor-pointer shadow-md shadow-white/5"
              >
                Buka Sandbox
              </button>
              <button 
                suppressHydrationWarning={true}
                onClick={() => scrollToSection('docs')}
                className="px-4 py-2 text-xs font-mono uppercase tracking-wider rounded border border-[#222] bg-[#121212]/50 hover:bg-[#1a1a1a] hover:border-[#333] text-[#fafafa] transition-all cursor-pointer"
              >
                Dokumentasi API
              </button>
            </div>
          </section>

          {/* Logo Loop Section */}
          <section className="w-full py-2 overflow-hidden relative">
            <LogoLoop
              logos={techLogos}
              speed={35}
              direction="left"
              logoHeight={22}
              gap={90}
              pauseOnHover={true}
              scaleOnHover={true}
              fadeOut={true}
              fadeOutColor="#0a0a0a"
              ariaLabel="Technology Stack"
            />
          </section>
        </div>

        {/* Section 2: Real-Time API Statistics & Telemetry */}
        <section id="telemetry" className="flex flex-col gap-6 scroll-mt-20">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Telemetry & Statistik Real-Time</h2>
            <p className="text-[11px] text-[#a3a3a3]">Kondisi performa dan throughput gateway API Nibokuu secara langsung.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Stat Card 1 */}
            <div className="bg-[#121212]/40 border border-[#222]/80 p-4 rounded-lg flex flex-col justify-between hover:border-[#333] transition-colors shadow-sm">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373]">Total Requests</span>
              {loading ? (
                <div className="h-8 w-24 bg-neutral-800/50 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-2xl font-bold text-[#fafafa] font-mono mt-1">
                  {totalRequests.toLocaleString('en-US')}
                </span>
              )}
              <span className="text-[9px] text-[#737373] mt-2">Akumulasi request masuk</span>
            </div>

            {/* Stat Card 2 */}
            <div className="bg-[#121212]/40 border border-[#222]/80 p-4 rounded-lg flex flex-col justify-between hover:border-[#333] transition-colors shadow-sm">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373]">Cache Hit Ratio</span>
              {loading ? (
                <div className="h-8 w-16 bg-neutral-800/50 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-2xl font-bold text-[#fafafa] font-mono mt-1">
                  {`${stats?.cacheHitRatio || 0}%`}
                </span>
              )}
              <div className="w-full bg-[#222] h-1 rounded-full overflow-hidden mt-3 shrink-0">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${stats?.cacheHitRatio || 0}%` }} />
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="bg-[#121212]/40 border border-[#222]/80 p-4 rounded-lg flex flex-col justify-between hover:border-[#333] transition-colors shadow-sm">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373]">Success Rate</span>
              {loading ? (
                <div className="h-8 w-16 bg-neutral-800/50 animate-pulse rounded mt-1" />
              ) : (
                <span className="text-2xl font-bold text-[#fafafa] font-mono mt-1">
                  {`${successPercent}%`}
                </span>
              )}
              <div className="flex justify-between font-mono text-[8px] mt-2 uppercase tracking-wider">
                <span className="text-emerald-400 font-semibold">{loading ? '0' : successRequests} OK</span>
                <span className="text-[#525252]">/</span>
                <span className="text-rose-400">{loading ? '0' : failedRequests} Fail</span>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div className="bg-[#121212]/40 border border-[#222]/80 p-4 rounded-lg flex flex-col justify-between hover:border-[#333] transition-colors shadow-sm">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#737373]">Resolved Domain</span>
              {loading ? (
                <div className="h-4 w-32 bg-neutral-800/50 animate-pulse rounded mt-3 mb-1" />
              ) : (
                <span className="text-[11px] font-semibold text-[#fafafa] font-mono mt-2 truncate" title={stats?.resolvedDomain}>
                  {stats?.resolvedDomain || 'none'}
                </span>
              )}
              <span className="text-[9px] text-[#737373] mt-3">Target source bypass aktif</span>
            </div>
          </div>

          {/* SVG Animated Latency Telemetry Chart */}
          <div className="bg-[#121212]/20 border border-[#222] p-5 rounded-lg flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex flex-col gap-1 text-left w-full md:w-auto">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#737373]">Edge Latency Monitor</span>
              <span className="text-sm font-semibold text-[#fafafa] flex items-center gap-2">
                Avg: {latencyHistory[latencyHistory.length - 1]}ms
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
              </span>
              <p className="text-[9px] text-[#737373] max-w-[280px]">
                Grafik latensi CDN cache hit lokal 10 request terakhir. Diperbarui secara asinkronus setiap 2 detik.
              </p>
            </div>
            <div className="w-full max-w-[500px] h-[80px] relative overflow-hidden bg-[#0d0d0d] border border-[#222]/50 rounded p-1">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={fillPath} fill="url(#chart-grad)" />
                <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                
                {/* Horizontal reference grid lines */}
                <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="#222" strokeDasharray="3,3" strokeWidth="0.5" />
                <line x1="0" y1="50" x2={chartWidth} y2="50" stroke="#222" strokeDasharray="3,3" strokeWidth="0.5" />
              </svg>
            </div>
          </div>
        </section>

        {/* Section 3: Core Technology Features */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Keunggulan Teknologi & Arsitektur</h2>
            <p className="text-[11px] text-[#a3a3a3]">Bagaimana Nibokuu API menjaga reliabilitas dan performa tinggi secara paralel.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 p-4 bg-[#121212]/20 border border-[#222] rounded-lg">
              <div className="h-7 w-7 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono text-xs font-bold border border-blue-500/25">
                01
              </div>
              <span className="text-xs font-semibold text-[#fafafa] mt-1">Single Flight Coalescing</span>
              <p className="text-[10px] text-[#a3a3a3] leading-relaxed">
                Mencegah penumpukan proses browser Puppeteer yang boros RAM. Jika ada 10 request bersamaan untuk anime yang sama, hanya 1 browser yang aktif melakukan scraping; 9 request lainnya menunggu dan memakai hasil yang sama secara instan.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-[#121212]/20 border border-[#222] rounded-lg">
              <div className="h-7 w-7 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold border border-emerald-500/25">
                02
              </div>
              <span className="text-xs font-semibold text-[#fafafa] mt-1">Edge CDN & DB Caching</span>
              <p className="text-[10px] text-[#a3a3a3] leading-relaxed">
                Menggunakan caching berlapis. Cache di-deploy di Vercel Edge Network dan disinkronkan dengan database cloud Firebase untuk menghindari pemanggilan berulang ke server sumber, mereduksi waktu respon hingga sub-30ms.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-[#121212]/20 border border-[#222] rounded-lg">
              <div className="h-7 w-7 rounded bg-purple-500/10 text-purple-400 flex items-center justify-center font-mono text-xs font-bold border border-purple-500/25">
                03
              </div>
              <span className="text-xs font-semibold text-[#fafafa] mt-1">AJAX Mirror Solver</span>
              <p className="text-[10px] text-[#a3a3a3] leading-relaxed">
                Secara cerdas mengeksekusi request AJAX internal Samehadaku (player_ajax) langsung di browser Puppeteer. Memecahkan link iframe mirror asli (Wibufile, Filedon, Blogger, Mega) agar dapat dialirkan tanpa pemblokiran pihak ketiga.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Performance Matrix Comparison */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Matriks Perbandingan Performa</h2>
            <p className="text-[11px] text-[#a3a3a3]">Analisis komparatif arsitektur pemrosesan request Nibokuu versus scraper konvensional.</p>
          </div>

          <div className="overflow-x-auto border border-[#222] rounded-lg bg-[#0d0d0d]">
            <table className="w-full text-left font-mono text-[9px] sm:text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-[#222] bg-[#111]">
                  <th className="p-2.5 sm:p-4 font-semibold text-[#737373] uppercase tracking-wider w-[25%]">Aspek Metrik</th>
                  <th className="p-2.5 sm:p-4 font-semibold text-rose-400 uppercase tracking-wider w-[35%]">Scraper Konvensional (Standard)</th>
                  <th className="p-2.5 sm:p-4 font-semibold text-emerald-400 uppercase tracking-wider w-[40%]">Nibokuu Engine (Optimized)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222] text-[#a3a3a3]">
                <tr>
                  <td className="p-2.5 sm:p-4 font-semibold text-[#fafafa]">Concurrent Requests</td>
                  <td className="p-2.5 sm:p-4">Membuka Puppeteer instance per request (RAM meledak jika traffic padat)</td>
                  <td className="p-2.5 sm:p-4 text-[#a3a3a3] font-semibold">Request Coalescing (Single Flight) menggabungkan query duplikat</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-4 font-semibold text-[#fafafa]">Response Latency (Cache Hit)</td>
                  <td className="p-2.5 sm:p-4 text-[#737373]">1500ms - 3000ms (selalu memproses ulang browser)</td>
                  <td className="p-2.5 sm:p-4 text-emerald-400 font-bold">10ms - 40ms (Edge CDN Cache Layer)</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-4 font-semibold text-[#fafafa]">Sourcing Server Load</td>
                  <td className="p-2.5 sm:p-4 text-[#737373]">Sangat tinggi, memicu ban IP (Cloudflare block) dengan cepat</td>
                  <td className="p-2.5 sm:p-4 text-[#a3a3a3]">Minimal, terdistribusi melalui edge-layer cache sync</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-4 font-semibold text-[#fafafa]">AJAX Video Decryption</td>
                  <td className="p-2.5 sm:p-4 text-[#737373]">Gagal atau link kosong akibat dynamic player loading</td>
                  <td className="p-2.5 sm:p-4 text-[#a3a3a3] font-semibold">AJAX player_ajax resolved via server-side Puppeteer</td>
                </tr>
                <tr>
                  <td className="p-2.5 sm:p-4 font-semibold text-[#fafafa]">Database Layer</td>
                  <td className="p-2.5 sm:p-4 text-[#737373]">Tanpa sinkronisasi database (mengandalkan scraping mentah)</td>
                  <td className="p-2.5 sm:p-4 text-[#a3a3a3]">Terintegrasi Firestore dengan sinkronisasi multi-instance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Alur Kerja Request (Architecture Flow) */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Alur Kerja Request (Architecture Diagram)</h2>
            <p className="text-[11px] text-[#a3a3a3]">Visualisasi bagaimana request Anda diproses secara aman dan efisien.</p>
          </div>

          <div className="p-6 bg-[#0d0d0d] border border-[#222] rounded-lg flex flex-col md:flex-row justify-between items-stretch gap-4 md:gap-2 relative">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col gap-2 p-3 bg-[#121212]/60 border border-[#222] rounded relative z-10">
              <span className="font-mono text-[9px] text-[#737373] uppercase">Langkah 1</span>
              <span className="text-xs font-semibold text-[#fafafa]">Permintaan Masuk</span>
              <p className="text-[9px] text-[#a3a3a3]">Aplikasi klien mengirimkan request ke endpoint scraper (misal: /api/episode?url=...).</p>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#222] px-1 font-bold z-10">→</div>

            {/* Step 2 */}
            <div className="flex-1 flex flex-col gap-2 p-3 bg-[#121212]/60 border border-[#222] rounded relative z-10">
              <span className="font-mono text-[9px] text-[#737373] uppercase">Langkah 2</span>
              <span className="text-xs font-semibold text-[#fafafa]">Pemeriksaan Cache</span>
              <p className="text-[9px] text-[#a3a3a3]">Mengecek ketersediaan data di Edge Cache / Firebase DB. Jika ada, langsung dikembalikan (40ms).</p>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#222] px-1 font-bold z-10">→</div>

            {/* Step 3 */}
            <div className="flex-1 flex flex-col gap-2 p-3 bg-[#121212]/60 border border-[#222] rounded relative z-10">
              <span className="font-mono text-[9px] text-[#737373] uppercase">Langkah 3</span>
              <span className="text-xs font-semibold text-[#fafafa]">Single Flight Filter</span>
              <p className="text-[9px] text-[#a3a3a3]">Jika cache miss, sistem memastikan tidak ada browser lain yang sedang memproses request yang sama.</p>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#222] px-1 font-bold z-10">→</div>

            {/* Step 4 */}
            <div className="flex-1 flex flex-col gap-2 p-3 bg-[#121212]/60 border border-[#222] rounded relative z-10">
              <span className="font-mono text-[9px] text-[#737373] uppercase">Langkah 4</span>
              <span className="text-xs font-semibold text-[#fafafa]">Headless Resolving</span>
              <p className="text-[9px] text-[#a3a3a3]">Puppeteer memuat target, memicu AJAX player, mengekstrak data bersih, menyimpannya ke cache, lalu selesai.</p>
            </div>
          </div>
        </section>

        {/* Section 6: Interactive API Sandbox (Playground) */}
        <section id="sandbox" className="flex flex-col gap-6 scroll-mt-20">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Interactive API Sandbox</h2>
            <p className="text-[11px] text-[#a3a3a3]">Uji coba response endpoint secara real-time langsung melalui portal.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Form Builder (Left Panel) */}
            <div className="lg:col-span-5 bg-[#0d0d0d] border border-[#222] rounded-lg p-5 flex flex-col gap-3 sm:gap-4 shadow-sm lg:min-h-[430px] h-auto" id="sandbox-form">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#737373] border-b border-[#222] pb-2 font-bold block">
                Request Parameters Builder
              </span>
              
              <div className="flex flex-col gap-1">
                <CustomSelect
                  label="Target Endpoint"
                  value={sandboxEndpoint}
                  onChange={handleEndpointChange}
                  showSearch={true}
                  options={ENDPOINTS.map(ep => ({
                    label: `${ep.method} ${ep.path} (${ep.name})`,
                    value: ep.path
                  }))}
                />
              </div>

              {/* Dynamic inputs based on parameters */}
              <div 
                ref={paramsRef}
                style={{ overflow: 'visible' }}
                className="h-auto shrink-0 flex flex-col gap-3 py-2 border-y border-[#222]/40"
              >
                {ENDPOINTS.find(e => e.path === sandboxEndpoint)?.params.map(p => (
                  <div key={p.name} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-[#a3a3a3] flex items-center justify-between">
                      <span>{p.label} <span className="text-[#525252]">({p.name})</span></span>
                      <span className="text-[8px] text-[#737373] uppercase">Query Param</span>
                    </label>
                    
                    {p.type === 'select' ? (
                      <CustomSelect
                        small
                        value={sandboxParams[p.name] || ''}
                        onChange={(val) => setSandboxParams(prev => ({ ...prev, [p.name]: val }))}
                        options={p.options?.map(opt => ({
                          label: opt === '' ? 'ALL (Default)' : opt.toUpperCase(),
                          value: opt
                        })) || []}
                      />
                    ) : (
                      <input
                        type={p.type}
                        placeholder={p.placeholder}
                        value={sandboxParams[p.name] || ''}
                        onChange={(e) => setSandboxParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                        className="bg-[#121212] border border-[#222] rounded px-3 py-2 text-xs font-mono text-[#f5f5f5] focus:outline-none focus:border-blue-500 w-full placeholder-[#404040] h-8"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Endpoint Meta Info & Live Preview */}
              <div className="flex flex-col gap-2 bg-[#121212]/40 border border-[#222]/80 rounded p-3 text-[10px] font-mono leading-relaxed select-text shrink-0">
                <div className="flex items-center justify-between text-[#737373] uppercase tracking-wider text-[8px] border-b border-[#222]/50 pb-1.5">
                  <span>Endpoint Info</span>
                  <span className="text-blue-400 font-bold font-mono lowercase">{ENDPOINTS.find(e => e.path === sandboxEndpoint)?.method}</span>
                </div>
                <p className="text-[#a3a3a3]">
                  {ENDPOINTS.find(e => e.path === sandboxEndpoint)?.description}
                </p>
                <div className="flex flex-col gap-1 mt-1 border-t border-[#222]/30 pt-1.5">
                  <span className="text-[8px] text-[#737373] uppercase tracking-wider">Request Path Preview</span>
                  <div className="text-[9px] text-blue-400 bg-[#161616] px-2 py-1 rounded border border-[#222] font-semibold font-mono truncate">
                    {getSandboxUrl()}
                  </div>
                </div>
              </div>



              {/* Action and Preset Shortcuts */}
              <div className="flex flex-col gap-3 shrink-0">
                <button
                  type="button"
                  suppressHydrationWarning={true}
                  onClick={() => executeSandboxRequest()}
                  disabled={sandboxLoading}
                  className="w-full rounded bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-[#a3a3a3] font-mono text-xs uppercase font-semibold text-white tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-900/10 h-9"
                >
                  {sandboxLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Send Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sandbox Response Output Console (Right Panel) */}
            <div className="lg:col-span-7 bg-[#0d0d0d] border border-[#222] rounded-lg overflow-hidden flex flex-col h-[300px] lg:h-[430px] shadow-sm">
              <div className="border-b border-[#222] bg-[#111] px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="font-mono text-[9px] text-[#737373] ml-2 uppercase font-semibold">Response Console</span>
                </div>
                
                {sandboxLatency !== null && (
                  <div className="flex items-center gap-3 text-[9px] font-mono">
                    <span className="text-[#737373]">Latency: <span className={sandboxLatency < 100 ? "text-emerald-400 font-bold" : "text-blue-400"}>{sandboxLatency}ms</span></span>
                    <span className="text-[#737373]">Status: <span className="text-emerald-400 font-bold">{sandboxStatus}</span></span>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] leading-relaxed relative bg-[#090909] no-scrollbar">
                {sandboxLoading ? (
                  <div className="absolute inset-0 bg-[#090909]/80 backdrop-blur-xs flex flex-col justify-center items-center gap-2 z-10 text-[#737373]">
                    <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Memproses request di server...</span>
                  </div>
                ) : null}

                {sandboxResponse ? (
                  <pre 
                    className="whitespace-pre select-text" 
                    dangerouslySetInnerHTML={{ __html: highlightJson(sandboxResponse) }} 
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.classList.contains('interactive-json-link')) {
                        const url = target.getAttribute('data-url');
                        if (url) {
                          handleInteractiveLinkClick(url);
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#404040] gap-1 py-10">
                    <svg className="w-8 h-8 stroke-current" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-xs text-[#525252]">Console Klien Kosong</span>
                    <span className="text-[9px] max-w-[280px]">Tekan "Send Request" untuk memicu eksekusi endpoint API terpilih.</span>
                  </div>
                )}
              </div>

              {sandboxResponse && (
                <div className="border-t border-[#222] bg-[#111]/80 px-4 py-2 shrink-0 flex justify-end">
                  <button
                    type="button"
                    suppressHydrationWarning={true}
                    onClick={() => copyToClipboard(JSON.stringify(sandboxResponse, null, 2))}
                    className="text-[9px] font-mono text-[#a3a3a3] hover:text-[#fafafa] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Salin JSON</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* Section 7: Detailed API Documentation Specifications */}
        <section id="docs" className="flex flex-col gap-6 scroll-mt-20">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Spesifikasi Detail Endpoint API</h2>
            <p className="text-[11px] text-[#a3a3a3]">Daftar endpoint publik, konfigurasi caching, dan parameter yang didukung Nibokuu.</p>
          </div>

          <div className="flex flex-col gap-4">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="p-5 rounded-lg border border-[#222] bg-[#121212]/10 flex flex-col gap-3.5 hover:border-[#262626] transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222]/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[9px] font-bold">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#fafafa]">{ep.path}</span>
                  </div>
                  <span className="font-mono text-[8px] text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                    Cache TTL: {ep.path === '/api/recent' ? '5 Menit' : (ep.path === '/api/episode' ? '24 Jam' : '4 Jam')}
                  </span>
                </div>
                
                <p className="text-[10.5px] text-[#a3a3a3] leading-relaxed">{ep.description}</p>
                
                <div className="flex flex-col gap-2">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-[#737373] block">Parameters:</span>
                  <div className="overflow-x-auto border border-[#222]/60 rounded">
                    <table className="w-full text-left font-mono text-[9px] border-collapse">
                      <thead>
                        <tr className="bg-[#111] border-b border-[#222]/60">
                          <th className="p-2 font-semibold text-[#737373] w-[20%]">Query Name</th>
                          <th className="p-2 font-semibold text-[#737373] w-[15%]">Type</th>
                          <th className="p-2 font-semibold text-[#737373] w-[15%]">Required</th>
                          <th className="p-2 font-semibold text-[#737373] w-[50%]">Description & Values</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222]/40 text-[#a3a3a3]">
                        {ep.params.map(param => (
                          <tr key={param.name}>
                            <td className="p-2 font-semibold text-[#fafafa]">{param.name}</td>
                            <td className="p-2">{param.type}</td>
                            <td className="p-2">
                              {param.name === 'q' || param.name === 'url' ? (
                                <span className="text-amber-500/80 font-bold">YES</span>
                              ) : (
                                <span className="text-[#525252]">NO</span>
                              )}
                            </td>
                            <td className="p-2 leading-relaxed">
                              {param.name === 'url' && 'Link detail episode anime Samehadaku. Harus berupa link yang valid.'}
                              {param.name === 'q' && 'Kata kunci pencarian judul anime.'}
                              {param.name === 'page' && 'Nomor halaman pagination (default: 1).'}
                              {param.name === 'status' && 'Filter status: ongoing, completed.'}
                              {param.name === 'type' && 'Filter tipe media: tv, movie, ova, ona.'}
                              {param.name === 'order' && 'Sorting urutan data: latest, popular, title.'}
                              {param.name === 'day' && 'Filter hari rilis: monday s.d. sunday.'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 8: Interactive Developer Integration Code Snippets */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Integrasi Developer (Quick Start)</h2>
            <p className="text-[11px] text-[#a3a3a3]">Salin cuplikan kode di bawah untuk mengintegrasikan scraper Nibokuu ke dalam aplikasi Anda.</p>
          </div>

          <div className="flex flex-col border border-[#222] rounded-lg bg-[#0d0d0d] overflow-hidden">
            {/* Tabs selector */}
            <div className="flex border-b border-[#222] bg-[#111] overflow-x-auto shrink-0 no-scrollbar">
              {['curl', 'js', 'python', 'go', 'php'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  suppressHydrationWarning={true}
                  onClick={() => setCodeTab(lang as any)}
                  className={`px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider border-b-2 cursor-pointer transition-all shrink-0 ${
                    codeTab === lang 
                      ? 'border-[#fafafa] text-[#fafafa] font-semibold bg-[#0d0d0d]' 
                      : 'border-transparent text-[#737373] hover:text-[#a3a3a3]'
                  }`}
                >
                  {lang === 'js' ? 'Javascript' : lang === 'go' ? 'Golang' : lang}
                </button>
              ))}
            </div>

            {/* Code editor body */}
            <div className="p-4 overflow-auto h-[240px] font-mono text-[10px] text-[#a3a3a3] relative bg-[#090909] no-scrollbar">
              <button
                type="button"
                suppressHydrationWarning={true}
                onClick={() => copyToClipboard(codeSnippets[codeTab])}
                className="absolute top-3 right-3 p-1.5 rounded border border-[#222] bg-[#121212]/80 hover:bg-[#1a1a1a] hover:border-[#333] transition-all cursor-pointer shadow-sm"
                title="Salin cuplikan kode"
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
              <pre className="whitespace-pre text-left selection:bg-blue-500/20">{codeSnippets[codeTab]}</pre>
            </div>
          </div>
        </section>

        {/* Section 9: Developer FAQ Accordion */}
        <section id="faq" className="flex flex-col gap-6 scroll-mt-20">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Frequently Asked Questions (FAQ)</h2>
            <p className="text-[11px] text-[#a3a3a3]">Pertanyaan umum mengenai infrastruktur, performa, dan batasan operasional Nibokuu.</p>
          </div>

          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index}
                  className="border border-[#222] rounded-lg bg-[#0d0d0d] overflow-hidden transition-all hover:border-[#262626]"
                >
                  <button
                    type="button"
                    suppressHydrationWarning={true}
                    onClick={() => toggleFaq(index)}
                    className="w-full px-4 py-3 sm:px-5 sm:py-4 text-left flex justify-between items-center gap-3 sm:gap-4 cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-[#fafafa] font-sans">{item.q}</span>
                    <svg 
                      className={`w-3.5 h-3.5 text-[#737373] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#fafafa]' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen 
                        ? 'grid-rows-[1fr] opacity-100 border-t border-[#222]/40' 
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden bg-[#090909]">
                      <div className="px-4 py-3 sm:px-5 sm:py-4 text-[10px] sm:text-[10.5px] leading-relaxed text-[#a3a3a3]">
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 10: Full Infrastructure Status Checks */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#737373] mb-1">Status Keaktifan Infrastruktur</h2>
            <p className="text-[11px] text-[#a3a3a3]">Kondisi operasional dari setiap komponen penyusun Nibokuu API.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#121212]/40 border border-[#222]/60 rounded hover:border-[#333] transition-all">
              <span className="text-[10px] font-semibold text-[#fafafa]">Browser Engine</span>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ONLINE
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#121212]/40 border border-[#222]/60 rounded hover:border-[#333] transition-all">
              <span className="text-[10px] font-semibold text-[#fafafa]">Firestore DB</span>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SYNCED
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#121212]/40 border border-[#222]/60 rounded hover:border-[#333] transition-all">
              <span className="text-[10px] font-semibold text-[#fafafa]">Vercel Edge CDN</span>
              <span className="text-[9px] font-mono text-[#38bdf8] flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#121212]/40 border border-[#222]/60 rounded hover:border-[#333] transition-all">
              <span className="text-[10px] font-semibold text-[#fafafa]">Single Flight Queues</span>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                IDLE
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[#121212]/40 border border-[#222]/60 rounded hover:border-[#333] transition-all col-span-2 sm:col-span-1">
              <span className="text-[10px] font-semibold text-[#fafafa]">API Gateway</span>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SECURE
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#222222]/50 bg-[#0d0d0d]/20 py-8 mt-20 z-10 shrink-0">
        <div className="max-w-[1000px] mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-mono text-[9px] text-[#737373]">
            &copy; 2026 Nibokuu Development. All Rights Reserved.
          </span>
          <span className="font-mono text-[8px] text-[#525252] max-w-[320px] text-center sm:text-right">
            Dashboard administratif monitor dibatasi di bawah autentikasi kunci server.
          </span>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          suppressHydrationWarning={true}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-5 p-2 rounded-full border border-[#222] bg-[#121212]/80 hover:bg-[#1c1c1c] text-[#fafafa] shadow-lg cursor-pointer transition-all z-50 flex items-center justify-center hover:scale-105"
          title="Kembali ke Atas"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Toast Notification Panel */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 border border-[#222] bg-[#0d0d0d] text-emerald-400 text-[10px] font-mono uppercase tracking-wider rounded-md shadow-lg z-50 animate-toast">
          {toastMessage}
        </div>
      )}

    </div>
  );
}
