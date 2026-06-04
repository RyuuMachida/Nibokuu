import { Metadata } from 'next';
import PublicLandingClient from './PublicLandingClient';

export const metadata: Metadata = {
  title: 'Nibokuu - High-Performance Anime Scraper API',
  description: 'Infrastruktur API Scraper & Stream Extractor berkecepatan tinggi dengan Edge Caching & Request Coalescing untuk Nibokuu.',
  openGraph: {
    title: 'Nibokuu - High-Performance Anime Scraper API',
    description: 'Infrastruktur API Scraper & Stream Extractor berkecepatan tinggi dengan Edge Caching & Request Coalescing untuk Nibokuu.',
    type: 'website',
    siteName: 'Nibokuu API Gateway',
    images: [
      {
        url: 'https://v2.samehadaku.how/wp-content/uploads/2021/03/cropped-samehadaku-logo-32x32.png',
        width: 1200,
        height: 630,
        alt: 'Nibokuu API Portal',
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nibokuu - High-Performance Anime Scraper API',
    description: 'Infrastruktur API Scraper & Stream Extractor berkecepatan tinggi dengan Edge Caching & Request Coalescing untuk Nibokuu.',
  }
};

export default function Home() {
  return <PublicLandingClient />;
}