import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTicketFolder } from '@/lib/drive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Dùng admin client để có thể đọc tickets bất kể RLS
    const adminClient = createAdminClient();

    // Build query
    const { data: rawTickets, error } = await adminClient
      .from('tickets')
      .select(`
        *,
        creator:users!created_by(id, full_name, email, department, role),
        assignee:users!assigned_to(id, full_name, email, department, role),
        ticket_tags(
          tag:tags(id, name, color)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi truy vấn tickets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform ticket_tags into a clean tags array
    const tickets = (rawTickets || []).map((t: any) => ({
      ...t,
      tags: (t.ticket_tags || []).map((tt: any) => tt.tag).filter(Boolean),
    }));

    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error('API /tickets GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority, tag_ids = [], guest_name, guest_email } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Tiêu đề không được để trống' }, { status: 400 });
    }

    // Kiểm tra xem có user đăng nhập không
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Nếu không có user, yêu cầu guest_name
    if (!user && !guest_name?.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập tên của bạn' }, { status: 400 });
    }

    // Dùng admin client để bypass RLS
    const adminClient = createAdminClient();

    // 1. Insert ticket row
    const insertPayload: any = {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || 'medium',
      status: 'open',
    };

    if (user) {
      insertPayload.created_by = user.id;
    } else {
      // Guest ticket
      insertPayload.created_by = null;
      insertPayload.guest_name = guest_name.trim();
      insertPayload.guest_email = guest_email?.trim() || null;
    }

    const { data: ticket, error: insertError } = await adminClient
      .from('tickets')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError || !ticket) {
      console.error('Lỗi tạo ticket:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Không thể tạo ticket' },
        { status: 500 }
      );
    }

    // 1.1 Gắn các tags ban đầu (nếu có chọn)
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      const tagInserts = tag_ids.map((tagId: string) => ({
        ticket_id: ticket.id,
        tag_id: tagId,
      }));
      await adminClient.from('ticket_tags').insert(tagInserts);
    }

    // 2. Tạo folder con trên Google Drive qua Service Account
    let driveFolderId: string | null = null;
    try {
      driveFolderId = await createTicketFolder(ticket.id);

      // Cập nhật drive_folder_id vào ticket
      await adminClient
        .from('tickets')
        .update({ drive_folder_id: driveFolderId })
        .eq('id', ticket.id);

      ticket.drive_folder_id = driveFolderId;
    } catch (driveErr: any) {
      console.warn('Lỗi khi tạo Google Drive folder cho ticket:', driveErr);
      // Vẫn tiếp tục nếu Drive tạm thời lỗi
    }

    // 3. Tạo tin nhắn system log đầu tiên
    try {
      const creatorName = user
        ? (await supabase.from('users').select('full_name').eq('id', user.id).single()).data?.full_name || 'Người dùng'
        : guest_name?.trim() || 'Khách';

      await adminClient.from('chat_logs').insert({
        ticket_id: ticket.id,
        sender_id: user?.id || null,
        message: `Ticket đã được khởi tạo bởi ${creatorName} với trạng thái Mới tạo.`,
        message_type: 'system',
      });
    } catch (logErr) {
      console.warn('Không thể ghi log khởi tạo:', logErr);
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    console.error('API /tickets POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
