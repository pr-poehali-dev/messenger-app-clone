const API_URLS = {
  auth: 'https://functions.poehali.dev/af7f6ab3-98ff-4091-a107-e1f453824a68',
  chats: 'https://functions.poehali.dev/cb03a0c9-cd90-421d-ba3e-3eef147370f0',
  users: 'https://functions.poehali.dev/eb960cd0-7038-464e-8626-1797e286081d',
  messages: 'https://functions.poehali.dev/abd31001-0799-468b-9713-72247f86ac24',
  calls: 'https://functions.poehali.dev/778f4fa7-2d82-476f-8d0c-4fc3ad17535f',
};

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
}

export interface Message {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
  isRead: boolean;
}

export interface Chat {
  chatId: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  lastSeen?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export const api = {
  async login(username: string): Promise<User> {
    const response = await fetch(API_URLS.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    return data.user;
  },

  async searchUsers(query: string): Promise<User[]> {
    const response = await fetch(`${API_URLS.users}?search=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.data;
  },

  async updateProfile(userId: number, updates: Partial<User>): Promise<User> {
    const response = await fetch(API_URLS.users, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        displayName: updates.display_name,
        bio: updates.bio,
        avatarUrl: updates.avatar_url,
      }),
    });
    const data = await response.json();
    return data.user;
  },

  async getChats(userId: number): Promise<Chat[]> {
    const response = await fetch(`${API_URLS.chats}?userId=${userId}`);
    const data = await response.json();
    return data.chats;
  },

  async getMessages(user1Id: number, user2Id: number): Promise<{ chatId: number; messages: Message[] }> {
    const response = await fetch(`${API_URLS.messages}?user1Id=${user1Id}&user2Id=${user2Id}`);
    const data = await response.json();
    return data;
  },

  async sendMessage(chatId: number, senderId: number, content: string): Promise<Message> {
    const response = await fetch(API_URLS.messages, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, senderId, content }),
    });
    const data = await response.json();
    return data.message;
  },

  async createCall(callerId: number, receiverId: number, callType: 'audio' | 'video', signalData: any): Promise<number> {
    const response = await fetch(API_URLS.calls, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callerId, receiverId, callType, signalData }),
    });
    const data = await response.json();
    return data.callId;
  },

  async getIncomingCall(userId: number): Promise<any> {
    const response = await fetch(`${API_URLS.calls}?userId=${userId}`);
    const data = await response.json();
    return data.call;
  },

  async updateCall(callId: number, status?: string, answerSignal?: any): Promise<void> {
    await fetch(API_URLS.calls, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, status, answerSignal }),
    });
  },

  async endCall(callId: number): Promise<void> {
    await fetch(`${API_URLS.calls}?callId=${callId}`, {
      method: 'DELETE',
    });
  },
};