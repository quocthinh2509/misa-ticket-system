import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'MISA Ticket & Chat Log System',
  description: 'Hệ thống quản lý ticket và hỗ trợ kỹ thuật trực tuyến MISA',
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
