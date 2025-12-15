import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface AgoraAudioCallProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  recipientId: number;
  recipientName: string;
  recipientAvatar?: string;
}

const AgoraAudioCall = ({ isOpen, onClose, currentUserId, recipientId, recipientName, recipientAvatar }: AgoraAudioCallProps) => {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Инициализация...');
  const [remoteUsers, setRemoteUsers] = useState<Set<number>>(new Set());
  
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    initCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const cleanup = async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (localAudioTrack) {
      localAudioTrack.close();
    }
    
    if (client) {
      await client.leave();
    }
    
    if (callIdRef.current) {
      await api.endCall(callIdRef.current);
    }
    
    setCallDuration(0);
    setIsConnected(false);
    setConnectionStatus('Инициализация...');
    setRemoteUsers(new Set());
  };

  const initCall = async () => {
    try {
      setConnectionStatus('Создание звонка...');
      
      const channelName = `call_${Math.min(currentUserId, recipientId)}_${Math.max(currentUserId, recipientId)}`;
      
      const newCallId = await api.createCall(currentUserId, recipientId, 'audio', { channelName });
      callIdRef.current = newCallId;
      
      setConnectionStatus('Получение токена...');
      const { token, appId } = await api.getAgoraToken(channelName, currentUserId);
      
      setConnectionStatus('Подключение к каналу...');
      await client.join(appId, channelName, token, currentUserId);
      
      setConnectionStatus('Включение микрофона...');
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'speech_standard',
        AEC: true,
        ANS: true,
        AGC: true,
      });
      setLocalAudioTrack(audioTrack);
      
      await client.publish([audioTrack]);
      
      setIsConnected(true);
      setConnectionStatus('Ожидание ответа...');
      
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack?.play();
          
          setRemoteUsers(prev => new Set(prev).add(user.uid as number));
          setConnectionStatus('Подключено');
          
          if (!callStartTimeRef.current) {
            callStartTimeRef.current = Date.now();
            durationIntervalRef.current = setInterval(() => {
              if (callStartTimeRef.current) {
                const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
                setCallDuration(duration);
              }
            }, 1000);
          }
        }
      });
      
      client.on('user-unpublished', (user) => {
        setRemoteUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.uid as number);
          return newSet;
        });
      });
      
      client.on('user-left', (user) => {
        setRemoteUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.uid as number);
          return newSet;
        });
        
        if (remoteUsers.size === 0) {
          toast({
            title: 'Звонок завершен',
            description: 'Собеседник покинул звонок',
          });
          endCall();
        }
      });
      
    } catch (error) {
      console.error('Error initializing call:', error);
      setConnectionStatus('Ошибка подключения');
      toast({
        title: 'Ошибка',
        description: 'Не удалось установить соединение',
        variant: 'destructive',
      });
    }
  };

  const toggleMute = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const endCall = async () => {
    await cleanup();
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={endCall}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <Avatar className="h-32 w-32">
            <AvatarImage src={recipientAvatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-medium">
              {getInitials(recipientName)}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{recipientName}</h2>
            <p className="text-muted-foreground">
              {remoteUsers.size > 0 ? formatDuration(callDuration) : connectionStatus}
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={toggleMute}
              variant={isMuted ? 'destructive' : 'secondary'}
              size="icon"
              className="h-14 w-14 rounded-full"
            >
              <Icon name={isMuted ? 'MicOff' : 'Mic'} size={24} />
            </Button>
            
            <Button
              onClick={endCall}
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full"
            >
              <Icon name="PhoneOff" size={24} />
            </Button>
          </div>

          {remoteUsers.size === 0 && isConnected && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-pulse">●</div>
              <span>Ожидание ответа...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgoraAudioCall;
