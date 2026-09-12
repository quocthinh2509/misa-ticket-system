import { NextRequest, NextResponse } from 'next/server';
import { getFileStream } from '@/lib/drive';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    if (!fileId) {
      return NextResponse.json({ error: 'Thiếu fileId' }, { status: 400 });
    }

    const { meta, stream } = await getFileStream(fileId);

    const headers = new Headers();
    headers.set('Content-Type', meta.mimeType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
    if (meta.name) {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(meta.name)}"`);
    }

    // Convert node stream to web stream
    return new Response(stream as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Lỗi stream file từ Google Drive:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải tệp tin' }, { status: 500 });
  }
}
