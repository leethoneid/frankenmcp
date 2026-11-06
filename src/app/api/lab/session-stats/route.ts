import { NextResponse } from 'next/server';
import { getSessionStats } from '@/lib/router/stats';

export async function GET() {
  try {
    const stats = getSessionStats();
    return NextResponse.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch session statistics';
    return NextResponse.json(
      { error: message || 'Failed to fetch session statistics' },
      { status: 500 }
    );
  }
}
