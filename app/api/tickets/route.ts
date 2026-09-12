import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTicketFolder } from '@/lib/drive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // Get current user role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'user';

    // Build query
    let query = supabase
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

    // Users can only view their own tickets; agents and admins can view all
    if (role === 'user') {
      query = query.eq('created_by', user.id);
    }

    const { data: rawTickets, error } = await query;

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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, priority, tag_ids = [] } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Tiêu đề không được để trống' }, { status: 400 });
    }

    // 1. Insert ticket row
    const { data: ticket, error: insertError } = await supabase
      .from('tickets')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'medium',
        created_by: user.id,
        status: 'open',
      })
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
      await supabase.from('ticket_tags').insert(tagInserts);
    }

    // 2. Tạo folder con trên Google Drive qua Service Account
    let driveFolderId: string | null = null;
    try {
      driveFolderId = await createTicketFolder(ticket.id);

      // Cập nhật drive_folder_id vào ticket (dùng admin client để đảm bảo update được)
      const adminClient = createAdminClient();
      await adminClient
        .from('tickets')
        .update({ drive_folder_id: driveFolderId })
        .eq('id', ticket.id);

      ticket.drive_folder_id = driveFolderId;
    } catch (driveErr: any) {
      console.warn('Lỗi khi tạo Google Drive folder cho ticket:', driveErr);
      // Vẫn tiếp tục nếu Drive tạm thời lỗi, admin có thể retry sau
    }

    // 3. Tạo tin nhắn system log đầu tiên
    try {
      const adminClient = createAdminClient();
      await adminClient.from('chat_logs').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        message: `Ticket đã được khởi tạo với trạng thái Mới tạo.`,
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
