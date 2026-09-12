import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Đọc .env.local
const envPath = path.resolve('.env.local');
let envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVal(key) {
  const match = envContent.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)?$`, 'm'));
  if (match) {
    return (match[1] || '').trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

const clientId = getEnvVal('GOOGLE_CLIENT_ID');
const clientSecret = getEnvVal('GOOGLE_CLIENT_SECRET');

if (!clientId || !clientSecret) {
  console.error('\n❌ LỖI: Chưa tìm thấy GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong .env.local!');
  console.log('👉 Vui lòng dán GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào file .env.local trước khi chạy script này.\n');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3001/oauth2callback';

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Bắt buộc để luôn cấp refresh_token
  scope: SCOPES,
});

console.log('\n=============================================================');
console.log('🔗 ĐANG MỞ TRÌNH DUYỆT ĐỂ XÁC THỰC GOOGLE DRIVE...');
console.log('Nếu trình duyệt không tự mở, hãy copy đường link sau dán vào trình duyệt:');
console.log(authUrl);
console.log('=============================================================\n');

// Mở trình duyệt trên Windows
exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/oauth2callback')) {
    const url = new URL(req.url, 'http://localhost:3001');
    const code = url.searchParams.get('code');

    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
          res.end('<h1>Khong lay duoc refresh_token, vui long thu lai</h1>');
          return;
        }

        console.log('\n✅ LẤY REFRESH TOKEN THÀNH CÔNG!');
        console.log('Refresh Token:', refreshToken);

        // Tự động ghi vào file .env.local
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
        }

        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('✅ Đã tự động cập nhật GOOGLE_REFRESH_TOKEN vào .env.local!\n');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #16a34a;">🎉 Xác thực Google Drive thành công!</h1>
            <p>Mã Refresh Token đã được tự động lưu vào <code>.env.local</code> của dự án.</p>
            <p>Bạn có thể đóng tab này và quay lại ứng dụng.</p>
          </div>
        `);

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 2000);
      } catch (err) {
        console.error('Lỗi khi đổi token:', err.message);
        res.end('Loi: ' + err.message);
      }
    }
  }
});

server.listen(3001, () => {
  console.log('Đang lắng nghe phản hồi tại http://localhost:3001/oauth2callback ...');
});
