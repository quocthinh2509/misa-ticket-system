import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST: Gắn nhãn vào ticket
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const ticketId = params.id;
    const body = await request.json();
    const { tag_id } = body;

    if (!tag_id) {
      return NextResponse.json({ error: 'Thiếu tag_id' }, { status: 400 });
    }

    // Insert into ticket_tags
    const { data, error } = await supabase
      .from('ticket_tags')
      .insert({
        ticket_id: ticketId,
        tag_id: tag_id,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Ticket đã có nhãn này' }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Lấy thông tin tag để trả về
    const { data: tag } = await supabase
      .from('tags')
      .select('*')
      .eq('id', tag_id)
      .single();

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Gỡ nhãn khỏi ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const ticketId = params.id;
    const { searchParams } = new URL(request.url);
    let tagId = searchParams.get('tag_id');

    if (!tagId) {
      const body = await request.json().catch(() => ({}));
      tagId = body.tag_id;
    }

    if (!tagId) {
      return NextResponse.json({ error: 'Thiếu tag_id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ticket_tags')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('tag_id', tagId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
