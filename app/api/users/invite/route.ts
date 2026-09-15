import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Kiểm tra phiên đăng nhập hiện tại
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // 2. Xác thực quyền Admin
    const { data: currentProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError || currentProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên (Admin) mới có quyền tạo và mời thành viên' },
        { status: 403 }
      );
    }

    // 3. Đọc dữ liệu đầu vào
    const body = await request.json();
    const { email, full_name, role = 'agent', department = '' } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ Email và Họ tên thành viên' },
        { status: 400 }
      );
    }

    if (!['admin', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Vai trò không hợp lệ. Chỉ có thể chọn Agent hoặc Admin' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = full_name.trim();
    const cleanDepartment = department ? department.trim() : '';

    const supabaseAdmin = createAdminClient();

    // 4. Kiểm tra xem email đã tồn tại trong public.users chưa
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Tài khoản với địa chỉ email này đã tồn tại trong hệ thống' },
        { status: 400 }
      );
    }

    // 5. Xác định URL chuyển hướng kích hoạt
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get('origin') ||
      'http://localhost:3000';
    const redirectTo = `${origin}/set-password`;

    // 6. Gửi email mời kích hoạt qua Supabase Auth Admin
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
        data: {
          full_name: cleanFullName,
          role,
          department: cleanDepartment,
        },
        redirectTo,
      });

    if (inviteError) {
      return NextResponse.json(
        { error: `Không thể gửi thư mời: ${inviteError.message}` },
        { status: 400 }
      );
    }

    // 7. Tạo thêm Direct Invite Link phòng trường hợp SMTP chậm hoặc admin muốn gửi trực tiếp
    let directInviteLink: string | null = null;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: cleanEmail,
        options: {
          redirectTo,
          data: {
            full_name: cleanFullName,
            role,
            department: cleanDepartment,
          },
        },
      });

      if (linkData?.properties?.action_link) {
        directInviteLink = linkData.properties.action_link;
      }
    } catch (err) {
      console.warn('Không thể tạo direct invite link:', err);
    }

    // 8. Đảm bảo dữ liệu đã được lưu vào public.users
    if (inviteData?.user) {
      await supabaseAdmin.from('users').upsert({
        id: inviteData.user.id,
        email: cleanEmail,
        full_name: cleanFullName,
        role,
        department: cleanDepartment,
      });
    }

    return NextResponse.json({
      success: true,
      user: inviteData.user,
      directInviteLink,
      message: `Đã gửi thư mời kích hoạt tài khoản tới ${cleanEmail}`,
    });
  } catch (error: any) {
    console.error('Lỗi khi mời thành viên:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi mời thành viên' },
      { status: 500 }
    );
  }
}
