import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// PATCH: Cập nhật nhãn (chỉ Admin)
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

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên mới có quyền chỉnh sửa nhãn' },
        { status: 403 }
      );
    }

    const tagId = params.id;
    const body = await request.json();
    const { name, color } = body;

    const updatePayload: any = {};
    if (name && name.trim()) updatePayload.name = name.trim();
    if (color && color.trim()) updatePayload.color = color.trim();

    const adminClient = createAdminClient();
    const { data: updatedTag, error } = await adminClient
      .from('tags')
      .update(updatePayload)
      .eq('id', tagId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag: updatedTag });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Xóa nhãn (chỉ Admin)
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

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên mới có quyền xóa nhãn' },
        { status: 403 }
      );
    }

    const tagId = params.id;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
