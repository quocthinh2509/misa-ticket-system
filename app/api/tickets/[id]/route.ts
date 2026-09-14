import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Dùng admin client để cho phép public access (không cần đăng nhập)
    const adminClient = createAdminClient();
    const ticketId = params.id;

    const { data: ticket, error } = await adminClient
      .from('tickets')
      .select(`
        *,
        creator:users!created_by(id, full_name, email, department, role),
        assignee:users!assigned_to(id, full_name, email, department, role),
        ticket_tags(
          tag:tags(id, name, color)
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { error: error?.message || 'Không tìm thấy ticket' },
        { status: 404 }
      );
    }

    // Format tags
    const formattedTicket = {
      ...ticket,
      tags: ((ticket as any).ticket_tags || []).map((tt: any) => tt.tag).filter(Boolean),
    };

    // Lấy danh sách attachments của ticket này
    const { data: attachments } = await adminClient
      .from('attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      ticket: formattedTicket,
      attachments: attachments || [],
    });
  } catch (error: any) {
    console.error('API /tickets/[id] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
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
    const { status, assigned_to, priority } = body;

    // Lấy thông tin ticket và user profile hiện tại
    const { data: currentTicket } = await supabase
      .from('tickets')
      .select('*, assignee:users!assigned_to(full_name)')
      .eq('id', ticketId)
      .single();

    if (!currentTicket) {
      return NextResponse.json({ error: 'Không tìm thấy ticket' }, { status: 404 });
    }

    const { data: currentProfile } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    const updaterName = currentProfile?.full_name || 'Người dùng';
    const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'agent';

    const updatePayload: any = {};
    const systemLogs: string[] = [];

    // Cập nhật trạng thái
    if (status && status !== currentTicket.status) {
      const statusNames: Record<string, string> = {
        open: 'Mới tạo',
        in_progress: 'Đang xử lý',
        resolved: 'Đã giải quyết',
        closed: 'Đã đóng',
      };
      updatePayload.status = status;
      systemLogs.push(
        `${updaterName} đã chuyển trạng thái sang "${statusNames[status] || status}".`
      );
    }

    // Cập nhật người xử lý (chỉ staff mới được gán)
    if (assigned_to !== undefined && assigned_to !== currentTicket.assigned_to) {
      if (!isStaff) {
        return NextResponse.json(
          { error: 'Chỉ nhân viên hoặc quản trị viên mới có quyền phân công ticket' },
          { status: 403 }
        );
      }
      updatePayload.assigned_to = assigned_to || null;

      if (assigned_to) {
        // Lấy tên người được gán
        const { data: newAssignee } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', assigned_to)
          .single();
        systemLogs.push(
          `${updaterName} đã phân công ticket cho ${newAssignee?.full_name || 'nhân viên mới'}.`
        );
      } else {
        systemLogs.push(`${updaterName} đã hủy phân công người xử lý.`);
      }
    }

    // Cập nhật độ ưu tiên
    if (priority && priority !== currentTicket.priority) {
      const priorityNames: Record<string, string> = {
        low: 'Thấp',
        medium: 'Trung bình',
        high: 'Cao',
        urgent: 'Khẩn cấp',
      };
      updatePayload.priority = priority;
      systemLogs.push(
        `${updaterName} đã thay đổi độ ưu tiên thành "${priorityNames[priority] || priority}".`
      );
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ticket: currentTicket });
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select(`
        *,
        creator:users!created_by(id, full_name, email, department, role),
        assignee:users!assigned_to(id, full_name, email, department, role)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert system logs vào chat_logs để hiển thị realtime trong box chat
    if (systemLogs.length > 0) {
      const adminClient = createAdminClient();
      for (const logMessage of systemLogs) {
        await adminClient.from('chat_logs').insert({
          ticket_id: ticketId,
          sender_id: user.id,
          message: logMessage,
          message_type: 'system',
        });
      }
    }

    return NextResponse.json({ ticket: updatedTicket });
  } catch (error: any) {
    console.error('API /tickets/[id] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
