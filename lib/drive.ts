import { google } from 'googleapis';
import { Readable } from 'stream';

function getGoogleAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  // Ưu tiên 1: Dùng OAuth2 với Refresh Token (dành cho tài khoản cá nhân @gmail.com)
  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3001/oauth2callback'
    );
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    return oauth2Client;
  }

  // Ưu tiên 2: Dùng Service Account (dành cho Google Workspace Shared Drive)
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  throw new Error('Thiếu cấu hình Google Drive Auth trong .env.local (Cần GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN hoặc Service Account)');
}

export function getDriveService() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Tạo thư mục con trên Google Drive cho ticket: Ticket_{ticketId}
 */
export async function createTicketFolder(ticketId: string): Promise<string> {
  const drive = getDriveService();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  const fileMetadata: any = {
    name: `Ticket_${ticketId}`,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (rootFolderId) {
    fileMetadata.parents = [rootFolderId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  const folderId = response.data.id;
  if (!folderId) {
    throw new Error('Không thể tạo folder trên Google Drive');
  }

  return folderId;
}

/**
 * Upload tệp tin lên thư mục Google Drive được chỉ định
 */
export async function uploadFileToDrive({
  folderId,
  fileName,
  mimeType,
  buffer,
}: {
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const drive = getDriveService();

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileMetadata: any = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: mimeType,
    body: stream,
  };

  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, mimeType, webViewLink, webContentLink, thumbnailLink',
    supportsAllDrives: true,
  });

  const fileId = uploadRes.data.id;
  if (!fileId) {
    throw new Error('Upload file lên Google Drive thất bại');
  }

  // Cấp quyền xem cho bất kỳ ai có link (anyone with link can view) để hiển thị ảnh trên web app
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch (permError) {
    console.warn('Không thể gán quyền anyone reader cho file:', permError);
  }

    return {
    fileId: fileId,
    fileName: uploadRes.data.name || fileName,
    mimeType: uploadRes.data.mimeType || mimeType,
    webViewLink: uploadRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: uploadRes.data.webContentLink,
    viewUrl: `https://drive.google.com/uc?id=${fileId}`,
  };
}

/**
 * Lấy stream tệp tin từ Google Drive để hiển thị ảnh trực tiếp không lo lỗi CORS/auth
 */
export async function getFileStream(fileId: string) {
  const drive = getDriveService();
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  });

  const res = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  return {
    meta: meta.data,
    stream: res.data as any,
  };
}
