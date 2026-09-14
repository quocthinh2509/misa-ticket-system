import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;
    const adminClient = createAdminClient();

    const { data: messages, error } = await adminClient
      .from('chat_logs')
      .select(`
        *,
        sender:users!sender_id(id, full_name, email, role),
        attachments:attachments(id, drive_file_id, file_name, file_type, created_at)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error: any) {
    console.error('API /chat GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ticketId = params.id;
    const body = await request.json();
    const { message, message_type = 'text' } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Nội dung tin nhắn không được để trống' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Nếu đã đăng nhập thì lấy user.id, nếu là khách thì sender_id là null
    const senderId = user ? user.id : null;

    const { data: chatLog, error } = await adminClient
      .from('chat_logs')
      .insert({
        ticket_id: ticketId,
        sender_id: senderId,
        message: message.trim(),
        message_type: message_type,
      })
      .select(`
        *,
        sender:users!sender_id(id, full_name, email, role)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cập nhật updated_at của ticket để hiển thị ticket vừa có hoạt động mới
    await adminClient
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return NextResponse.json({ message: chatLog }, { status: 201 });
  } catch (error: any) {
    console.error('API /chat POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
