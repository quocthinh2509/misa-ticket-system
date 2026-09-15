import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

// 1. PATCH: Cập nhật thông tin thành viên (Họ tên, Vai trò, Phòng ban)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const targetUserId = params.id;
    const supabase = createClient();

    // Xác thực người dùng hiện tại
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // Kiểm tra quyền Admin
    const { data: currentProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError || currentProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa thành viên' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { full_name, role, department } = body;

    if (!full_name || !full_name.trim()) {
      return NextResponse.json(
        { error: 'Họ và tên không được để trống' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Vai trò chỉ có thể là Admin hoặc Agent' },
        { status: 400 }
      );
    }

    // Bảo vệ an toàn: Admin đang đăng nhập không thể tự hạ quyền của chính mình
    if (currentUser.id === targetUserId && role && role !== 'admin') {
      return NextResponse.json(
        { error: 'Bạn không thể tự hạ quyền Quản trị viên của chính mình' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const updatePayload: {
      full_name: string;
      role?: string;
      department?: string;
    } = {
      full_name: full_name.trim(),
      department: department ? department.trim() : '',
    };

    if (role) {
      updatePayload.role = role;
    }

    // Cập nhật trong public.users
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Không thể cập nhật thông tin thành viên' },
        { status: 500 }
      );
    }

    // Đồng bộ user_metadata trong auth.users
    try {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          full_name: full_name.trim(),
          role: role || updatedUser.role,
          department: department ? department.trim() : '',
        },
      });
    } catch (authSyncErr) {
      console.warn('Cảnh báo: Không thể đồng bộ metadata auth.users:', authSyncErr);
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Cập nhật thông tin thành viên thành công',
    });
  } catch (error: any) {
    console.error('Lỗi khi cập nhật thành viên:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi cập nhật thành viên' },
      { status: 500 }
    );
  }
}

// 2. DELETE: Xóa thành viên khỏi hệ thống
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const targetUserId = params.id;
    const supabase = createClient();

    // Xác thực người dùng hiện tại
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // Kiểm tra quyền Admin
    const { data: currentProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError || currentProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên (Admin) mới có quyền xóa thành viên' },
        { status: 403 }
      );
    }

    // Bảo vệ an toàn: Admin không thể tự xóa tài khoản của chính mình
    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { error: 'Bạn không thể tự xóa tài khoản của chính mình' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Gỡ bỏ phân công phụ trách trên các Ticket mà user này đang được assign
    await supabaseAdmin
      .from('tickets')
      .update({ assigned_to: null })
      .eq('assigned_to', targetUserId);

    // Lấy thông tin user trước khi xóa
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    // Thử xóa trong auth.users (nếu có cascade sang public.users)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
      targetUserId
    );

    if (deleteAuthError) {
      console.warn('Lỗi khi xóa trong auth.users:', deleteAuthError.message);
      // Nếu lỗi do ràng buộc dữ liệu hoặc vấn đề khác, thử xóa thẳng trong public.users
      const { error: deletePublicError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', targetUserId);

      if (deletePublicError) {
        // Nếu dính khóa ngoại do user đã tạo ticket/chat log quan trọng:
        // Đổi tên thành [Đã vô hiệu hóa] và vô hiệu hóa role
        await supabaseAdmin
          .from('users')
          .update({
            full_name: `${targetUser?.full_name || 'Thành viên'} (Đã vô hiệu hóa)`,
            role: 'user',
            department: 'Đã nghỉ việc',
          })
          .eq('id', targetUserId);

        return NextResponse.json({
          success: true,
          message:
            'Thành viên đã có lịch sử tạo Ticket/Chat nên hệ thống đã thu hồi quyền và vô hiệu hóa tài khoản an toàn.',
        });
      }
    } else {
      // Đảm bảo xóa luôn trong public.users nếu chưa cascade
      await supabaseAdmin.from('users').delete().eq('id', targetUserId);
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa thành viên thành công',
    });
  } catch (error: any) {
    console.error('Lỗi khi xóa thành viên:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi xóa thành viên' },
      { status: 500 }
    );
  }
}
