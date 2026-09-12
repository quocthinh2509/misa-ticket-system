import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadFileToDrive, createTicketFolder } from '@/lib/drive';

export const dynamic = 'force-dynamic';
// Vercel Pro cho phép tới 60s, thiết lập maxDuration theo tài liệu spec
export const maxDuration = 60;

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

    // Lấy thông tin ticket để lấy drive_folder_id
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, drive_folder_id')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: 'Không tìm thấy ticket' }, { status: 404 });
    }

    let folderId = ticket.drive_folder_id;
    if (!folderId) {
      // Nếu chưa có folder thì tạo mới trên Drive
      folderId = await createTicketFolder(ticket.id);
      const adminClient = createAdminClient();
      await adminClient
        .from('tickets')
        .update({ drive_folder_id: folderId })
        .eq('id', ticket.id);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const messageText = (formData.get('message') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file để upload' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type || 'application/octet-stream';

    // Upload lên Google Drive
    const driveResult = await uploadFileToDrive({
      folderId,
      fileName,
      mimeType,
      buffer,
    });

    const adminClient = createAdminClient();

    // 1. Tạo tin nhắn chat với message_type là file_ref
    const { data: chatLog, error: chatErr } = await adminClient
      .from('chat_logs')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        message: messageText.trim() || `Đã đính kèm tệp: ${fileName}`,
        message_type: 'file_ref',
      })
      .select(`
        *,
        sender:users!sender_id(id, full_name, email, role)
      `)
      .single();

    if (chatErr) {
      console.error('Lỗi tạo chat log cho file:', chatErr);
    }

    // 2. Lưu thông tin vào bảng attachments
    const { data: attachment, error: attachErr } = await adminClient
      .from('attachments')
      .insert({
        ticket_id: ticketId,
        chat_log_id: chatLog?.id || null,
        drive_file_id: driveResult.fileId,
        file_name: fileName,
        file_type: mimeType,
        uploaded_by: user.id,
      })
      .select('*')
      .single();

    if (attachErr) {
      console.error('Lỗi tạo attachment record:', attachErr);
      return NextResponse.json({ error: attachErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        attachment: {
          ...attachment,
          drive: driveResult,
        },
        chatLog,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API /attachments upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
