import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface AgoraVideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  recipientId: number;
  recipientName: string;
}

const AgoraVideoCall = ({ isOpen, onClose, currentUserId, recipientId, recipientName }: AgoraVideoCallProps) => {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Инициализация...');
  const [remoteUsers, setRemoteUsers] = useState<Set<number>>(new Set());
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
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
    if (localAudioTrack) {
      localAudioTrack.close();
    }
    
    if (localVideoTrack) {
      localVideoTrack.close();
    }
    
    if (client) {
      await client.leave();
    }
    
    if (callIdRef.current) {
      await api.endCall(callIdRef.current);
    }
    
    setConnectionStatus('Инициализация...');
    setRemoteUsers(new Set());
  };

  const initCall = async () => {
    try {
      setConnectionStatus('Создание звонка...');
      
      const channelName = `call_${Math.min(currentUserId, recipientId)}_${Math.max(currentUserId, recipientId)}`;
      
      const newCallId = await api.createCall(currentUserId, recipientId, 'video', { channelName });
      callIdRef.current = newCallId;
      
      setConnectionStatus('Получение токена...');
      const { token, appId } = await api.getAgoraToken(channelName, currentUserId);
      
      setConnectionStatus('Подключение к каналу...');
      await client.join(appId, channelName, token, currentUserId);
      
      setConnectionStatus('Включение камеры и микрофона...');
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'speech_standard',
          AEC: true,
          ANS: true,
          AGC: true,
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: '480p_1',
        })
      ]);
      
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }
      
      await client.publish([audioTrack, videoTrack]);
      
      setConnectionStatus('Ожидание ответа...');
      
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          const remoteVideoTrack = user.videoTrack;
          if (remoteVideoTrack && remoteVideoRef.current) {
            remoteVideoTrack.play(remoteVideoRef.current);
          }
          setRemoteUsers(prev => new Set(prev).add(user.uid as number));
          setConnectionStatus('Подключено');
        }
        
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack?.play();
        }
      });
      
      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
          setRemoteUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(user.uid as number);
            return newSet;
          });
        }
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

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = async () => {
    await cleanup();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={endCall}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Видеозвонок с {recipientName}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 bg-black relative h-full">
          <div 
            ref={remoteVideoRef}
            className="w-full h-full"
          />
          
          <div 
            ref={localVideoRef}
            className="absolute bottom-4 right-4 w-48 h-36 rounded-lg border-2 border-white overflow-hidden"
          />

          {remoteUsers.size === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Icon name="Video" size={48} className="mx-auto mb-4" />
                <p className="text-lg">{connectionStatus}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 flex justify-center gap-4 bg-background">
          <Button
            onClick={toggleMute}
            variant={isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            <Icon name={isMuted ? 'MicOff' : 'Mic'} size={20} />
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            <Icon name={isVideoOff ? 'VideoOff' : 'Video'} size={20} />
          </Button>
          
          <Button
            onClick={endCall}
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            <Icon name="PhoneOff" size={20} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgoraVideoCall;
