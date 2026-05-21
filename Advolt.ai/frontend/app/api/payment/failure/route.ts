import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.redirect(new URL('/dashboard/payment/failure', process.env.NEXT_PUBLIC_APP_URL || 'https://ad-sage-i4cs.vercel.app'), 303);
}

export async function GET() {
  return NextResponse.redirect(new URL('/dashboard/payment/failure', process.env.NEXT_PUBLIC_APP_URL || 'https://ad-sage-i4cs.vercel.app'), 303);
}
