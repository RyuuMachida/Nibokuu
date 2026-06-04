import { NextRequest, NextResponse } from 'next/server';
import { getSystemStats } from '@/lib/logger';
import { getFromCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const stats = await getSystemStats();
    const resolvedDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';
    
    // Return only public safe statistics, omitting detailed logs
    return NextResponse.json(
      {
        status: 'success',
        totalRequests: stats.totalRequests,
        cacheHitRatio: stats.cacheHitRatio,
        successRequests: stats.successRequests,
        failedRequests: stats.failedRequests,
        resolvedDomain,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to get public system stats:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to retrieve public stats.',
      },
      { status: 500 }
    );
  }
}
