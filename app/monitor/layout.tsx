import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nibokuu - Admin Infrastructure Monitor',
  description: 'Real-time performance analytics, live request logging, and API playground restricted to admin access.',
  openGraph: {
    title: 'Nibokuu - Admin Infrastructure Monitor',
    description: 'Real-time performance analytics, live request logging, and API playground restricted to admin access.',
    type: 'website',
    images: [
      {
        url: 'https://v2.samehadaku.how/wp-content/uploads/2021/03/cropped-samehadaku-logo-32x32.png',
        width: 1200,
        height: 630,
        alt: 'Nibokuu Admin Dashboard',
      }
    ]
  }
};

export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
