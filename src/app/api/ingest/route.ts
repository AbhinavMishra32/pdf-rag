import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	return NextResponse.json({ ok: true, message: 'Ingest endpoint placeholder' });
}

