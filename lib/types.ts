export type UserRole = 'admin' | 'agent' | 'user';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type MessageType = 'text' | 'system' | 'file_ref';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string | null;
  created_at?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_by?: string | null;
  assigned_to?: string | null;
  drive_folder_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  creator?: UserProfile;
  assignee?: UserProfile | null;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface ChatLog {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  message_type: MessageType;
  created_at: string;
  // Joined fields
  sender?: UserProfile;
  attachment?: Attachment | null;
  attachments?: Attachment[] | null;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  chat_log_id?: string | null;
  drive_file_id: string;
  file_name: string;
  file_type?: string | null;
  uploaded_by: string;
  created_at: string;
  // Computed / metadata
  view_url?: string;
  download_url?: string;
}
