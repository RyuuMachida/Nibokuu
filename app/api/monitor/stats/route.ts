import { NextRequest, NextResponse } from 'next/server';
import { getSystemStats } from '@/lib/logger';
import { getFromCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const adminKey = process.env.ADMIN_SECRET_KEY || 'nibokuu-admin-super-secret';

  if (key !== adminKey) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized access.' },
      { status: 401 }
    );
  }

  try {
    const stats = await getSystemStats();
    const resolvedDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';
    
    return NextResponse.json(
      {
        status: 'success',
        ...stats,
        resolvedDomain,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to get system stats:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to retrieve stats.',
      },
      { status: 500 }
    );
  }
}
