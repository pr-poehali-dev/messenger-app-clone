import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import VideoCall from '@/components/VideoCall';
import { api, User, Message, Chat } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<Chat | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [showVideoCall, setShowVideoCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagePollingRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedChat && currentUser && selectedChatUser) {
      loadMessages();
      
      messagePollingRef.current = setInterval(() => {
        loadMessages();
      }, 2000);

      return () => {
        if (messagePollingRef.current) {
          clearInterval(messagePollingRef.current);
        }
      };
    }
  }, [selectedChat, currentUser, selectedChatUser]);

  const loadChats = async () => {
    if (!currentUser) return;
    try {
      const loadedChats = await api.getChats(currentUser.id);
      setChats(loadedChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const loadMessages = async () => {
    if (!currentUser || !selectedChatUser) return;
    try {
      const { messages: loadedMessages } = await api.getMessages(currentUser.id, selectedChatUser.userId);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите имя пользователя',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const user = await api.login(loginUsername.trim());
      setCurrentUser(user);
      setProfileName(user.display_name);
      setProfileBio(user.bio || '');
      setShowLoginDialog(false);
      toast({
        title: 'Добро пожаловать!',
        description: `Вы вошли как ${user.display_name}`,
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось войти',
        variant: 'destructive',
      });
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await api.searchUsers(query.trim());
      const filteredResults = results.filter((user) => user.id !== currentUser?.id);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSelectUser = async (user: User) => {
    if (!currentUser) return;
    
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    
    try {
      const { chatId, messages: loadedMessages } = await api.getMessages(currentUser.id, user.id);
      setSelectedChat(chatId);
      setSelectedChatUser({
        chatId,
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        unreadCount: 0,
      });
      setMessages(loadedMessages);
      await loadChats();
    } catch (error) {
      console.error('Error selecting user:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !currentUser) return;
    
    try {
      const newMessage = await api.sendMessage(selectedChat, currentUser.id, messageText.trim());
      setMessages([...messages, newMessage]);
      setMessageText('');
      await loadChats();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    
    try {
      const updatedUser = await api.updateProfile(currentUser.id, {
        display_name: profileName,
        bio: profileBio,
      });
      setCurrentUser(updatedUser);
      setShowProfileDialog(false);
      toast({
        title: 'Профиль обновлен',
        description: 'Ваши изменения сохранены',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить профиль',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вход в мессенджер</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                placeholder="Введите ваш никнейм"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Войти
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать профиль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Имя</Label>
              <Input
                id="displayName"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bio">О себе</Label>
              <Textarea
                id="bio"
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleUpdateProfile} className="w-full">
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VideoCall
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
        initiator={true}
        recipientName={selectedChatUser?.displayName || ''}
      />

      <div className="flex h-screen bg-background">
        <div className="w-full md:w-96 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Чаты</h1>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowProfileDialog(true)}>
                  <Icon name="User" size={20} />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск пользователей..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isSearching && searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                      {getInitials(user.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{user.display_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                  </div>
                </div>
              ))
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.chatId}
                  onClick={() => {
                    setSelectedChat(chat.chatId);
                    setSelectedChatUser(chat);
                  }}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                    selectedChat === chat.chatId ? 'bg-accent/30' : ''
                  }`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={chat.avatarUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                      {getInitials(chat.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium truncate">{chat.displayName}</h3>
                      <span className="text-xs text-muted-foreground">{formatTime(chat.lastMessageTime)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.lastMessage || 'Нет сообщений'}</p>
                  </div>
                  {chat.unreadCount > 0 && (
                    <div className="bg-primary text-primary-foreground text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedChatUser && selectedChat ? (
            <>
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedChatUser.avatarUrl} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                    {getInitials(selectedChatUser.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="font-semibold">{selectedChatUser.displayName}</h2>
                  <p className="text-xs text-muted-foreground">@{selectedChatUser.username}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowVideoCall(true)}>
                  <Icon name="Video" size={20} />
                </Button>
                <Button variant="ghost" size="icon">
                  <Icon name="MoreVertical" size={20} />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          message.senderId === currentUser?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        <span
                          className={`text-xs mt-1 block ${
                            message.senderId === currentUser?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border">
                <div className="flex items-end gap-2">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Icon name="Paperclip" size={20} />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Введите сообщение..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                    >
                      <Icon name="Smile" size={20} />
                    </Button>
                  </div>
                  <Button onClick={handleSendMessage} size="icon" className="shrink-0">
                    <Icon name="Send" size={20} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Icon name="MessageCircle" size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">Выберите чат или найдите пользователя</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Index;
