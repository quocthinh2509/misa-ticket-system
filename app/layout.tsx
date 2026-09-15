import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'TLT Ticket & Chat Log System - Tú Lộc Tech',
  description: 'Hệ thống quản lý ticket và hỗ trợ kỹ thuật trực tuyến Tú Lộc Tech (TLT)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${inter.className} h-full bg-slate-50 flex flex-col text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
