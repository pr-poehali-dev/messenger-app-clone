import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';

interface Chat {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
}

interface Message {
  id: number;
  text: string;
  time: string;
  isMine: boolean;
}

const Index = () => {
  const [selectedChat, setSelectedChat] = useState<number>(1);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const chats: Chat[] = [
    {
      id: 1,
      name: 'Анна Смирнова',
      avatar: 'AS',
      lastMessage: 'Привет! Как дела?',
      time: '14:32',
      unread: 2,
    },
    {
      id: 2,
      name: 'Команда проекта',
      avatar: 'КП',
      lastMessage: 'Встреча перенесена на 15:00',
      time: '13:15',
      unread: 0,
    },
    {
      id: 3,
      name: 'Иван Петров',
      avatar: 'ИП',
      lastMessage: 'Отправил файлы',
      time: '12:48',
      unread: 1,
    },
    {
      id: 4,
      name: 'Мария Иванова',
      avatar: 'МИ',
      lastMessage: 'Спасибо за помощь!',
      time: '11:20',
      unread: 0,
    },
    {
      id: 5,
      name: 'Алексей Козлов',
      avatar: 'АК',
      lastMessage: 'Созвонимся завтра?',
      time: 'Вчера',
      unread: 0,
    },
  ];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Привет! Как дела?',
      time: '14:30',
      isMine: false,
    },
    {
      id: 2,
      text: 'Привет! Всё отлично, спасибо 😊',
      time: '14:31',
      isMine: true,
    },
    {
      id: 3,
      text: 'Ты видел новый дизайн?',
      time: '14:32',
      isMine: false,
    },
    {
      id: 4,
      text: 'Да, выглядит круто! Мне нравится',
      time: '14:32',
      isMine: true,
    },
  ]);

  const currentChat = chats.find((chat) => chat.id === selectedChat);

  const handleSendMessage = () => {
    if (messageText.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        text: messageText,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        isMine: true,
      };
      setMessages([...messages, newMessage]);
      setMessageText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background">
      <div className="w-full md:w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Чаты</h1>
            <Button variant="ghost" size="icon">
              <Icon name="Plus" size={20} />
            </Button>
          </div>
          <div className="relative">
            <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat.id)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                selectedChat === chat.id ? 'bg-accent/30' : ''
              }`}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={chat.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                  {chat.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium truncate">{chat.name}</h3>
                  <span className="text-xs text-muted-foreground">{chat.time}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && (
                <div className="bg-primary text-primary-foreground text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">
                  {chat.unread}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {currentChat && (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentChat.avatar} />
                <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                  {currentChat.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold">{currentChat.name}</h2>
                <p className="text-xs text-muted-foreground">В сети</p>
              </div>
              <Button variant="ghost" size="icon">
                <Icon name="Phone" size={20} />
              </Button>
              <Button variant="ghost" size="icon">
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
                    className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        message.isMine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      <span
                        className={`text-xs mt-1 block ${
                          message.isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}
                      >
                        {message.time}
                      </span>
                    </div>
                  </div>
                ))}
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
        )}
      </div>
    </div>
  );
};

export default Index;
