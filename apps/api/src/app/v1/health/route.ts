import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'earthropy-api',
    version: process.env.npm_package_version ?? 'dev',
    time: new Date().toISOString(),
  });
}
