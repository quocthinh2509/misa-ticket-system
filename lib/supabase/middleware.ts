import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nếu cố truy cập trang /register cũ -> chuyển hướng về /login
  if (request.nextUrl.pathname.startsWith('/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');

  // Public paths – không cần đăng nhập
  const isPublicPath =
    request.nextUrl.pathname === '/tickets' ||
    request.nextUrl.pathname === '/tickets/new' ||
    request.nextUrl.pathname.startsWith('/set-password') ||
    /^\/tickets\/[^/]+/.test(request.nextUrl.pathname);

  // Chỉ bảo vệ các route admin nội bộ (/tags, /users)
  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/tags') ||
    request.nextUrl.pathname.startsWith('/users');

  // Nếu chưa đăng nhập và đang cố truy cập route được bảo vệ
  if (!user && !isAuthPage && !isPublicPath && isProtectedPath && !request.nextUrl.pathname.startsWith('/api')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Nếu đã đăng nhập và đang cố vào trang login
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/tickets';
    return NextResponse.redirect(url);
  }

  return response;
}
