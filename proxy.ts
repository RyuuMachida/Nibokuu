import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Protect the /monitor route and all subpaths under it
  if (pathname === '/monitor' || pathname.startsWith('/monitor/')) {
    const key = searchParams.get('key');
    const adminKey = process.env.ADMIN_SECRET_KEY || 'nibokuu-admin-super-secret';
    if (key !== adminKey) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 Not Found</title>
  <style>
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff;
      color: #171717;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-align: center;
    }
    .container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h1 {
      font-size: 24px;
      font-weight: 500;
      margin: 0 20px 0 0;
      padding-right: 20px;
      border-right: 1px solid #a1a1a1;
      line-height: 40px;
    }
    span {
      font-size: 14px;
      line-height: 40px;
      font-weight: 400;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <span>This page could not be found.</span>
  </div>
</body>
</html>`;

      return new NextResponse(html, {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/monitor/:path*'],
};
