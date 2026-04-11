import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  // TODO: handle incoming WhatsApp webhook events
  return NextResponse.json({ status: 'ok' })
}
