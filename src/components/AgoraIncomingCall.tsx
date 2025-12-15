import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface AgoraIncomingCallProps {
  callData: {
    id: number;
    callerId: number;
    receiverId: number;
    callType: 'audio' | 'video';
    signalData: { channelName: string };
    callerDisplayName: string;
    callerAvatar?: string;
  } | null;
  onAccept: () => void;
  onReject: () => void;
}

const AgoraIncomingCall = ({ callData, onAccept, onReject }: AgoraIncomingCallProps) => {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Входящий звонок...');
  const [remoteUsers, setRemoteUsers] = useState<Set<number>>(new Set());
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isAccepted && callData) {
      acceptCall();
    }
  }, [isAccepted, callData]);

  const cleanup = async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (localAudioTrack) {
      localAudioTrack.close();
    }
    
    if (localVideoTrack) {
      localVideoTrack.close();
    }
    
    if (client) {
      await client.leave();
    }
    
    setIsAccepted(false);
    setRemoteUsers(new Set());
  };

  const acceptCall = async () => {
    if (!callData) return;

    try {
      setConnectionStatus('Получение токена...');
      
      const { channelName } = callData.signalData;
      const { token, appId } = await api.getAgoraToken(channelName, callData.receiverId);
      
      setConnectionStatus('Подключение к каналу...');
      await client.join(appId, channelName, token, callData.receiverId);
      
      setConnectionStatus('Включение устройств...');
      
      if (callData.callType === 'video') {
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
      } else {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'speech_standard',
          AEC: true,
          ANS: true,
          AGC: true,
        });
        
        setLocalAudioTrack(audioTrack);
        await client.publish([audioTrack]);
      }
      
      await api.updateCall(callData.id, 'accepted');
      
      setConnectionStatus('Подключено');
      
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video') {
          const remoteVideoTrack = user.videoTrack;
          if (remoteVideoTrack && remoteVideoRef.current) {
            remoteVideoTrack.play(remoteVideoRef.current);
          }
          setRemoteUsers(prev => new Set(prev).add(user.uid as number));
        }
        
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack?.play();
          
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
          handleEndCall();
        }
      });
      
    } catch (error) {
      console.error('Error accepting call:', error);
      setConnectionStatus('Ошибка подключения');
      toast({
        title: 'Ошибка',
        description: 'Не удалось принять звонок',
        variant: 'destructive',
      });
      handleReject();
    }
  };

  const handleAccept = () => {
    setIsAccepted(true);
    onAccept();
  };

  const handleReject = async () => {
    if (callData) {
      await api.updateCall(callData.id, 'rejected');
    }
    await cleanup();
    onReject();
  };

  const handleEndCall = async () => {
    if (callData) {
      await api.updateCall(callData.id, 'ended');
    }
    await cleanup();
    onReject();
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

  if (!callData) return null;

  if (callData.callType === 'video' && isAccepted) {
    return (
      <Dialog open={true} onOpenChange={handleEndCall}>
        <DialogContent className="max-w-4xl h-[80vh] p-0">
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
              onClick={handleEndCall}
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
  }

  if (callData.callType === 'audio' && isAccepted) {
    return (
      <Dialog open={true} onOpenChange={handleEndCall}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <Avatar className="h-32 w-32">
              <AvatarImage src={callData.callerAvatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-medium">
                {getInitials(callData.callerDisplayName)}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{callData.callerDisplayName}</h2>
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
                onClick={handleEndCall}
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
              >
                <Icon name="PhoneOff" size={24} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={handleReject}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <Avatar className="h-32 w-32 ring-4 ring-green-500 ring-offset-4 animate-pulse">
            <AvatarImage src={callData.callerAvatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-medium">
              {getInitials(callData.callerDisplayName)}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{callData.callerDisplayName}</h2>
            <p className="text-muted-foreground text-lg">
              {callData.callType === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок'}
            </p>
          </div>

          <div className="flex gap-6">
            <Button
              onClick={handleReject}
              variant="destructive"
              size="icon"
              className="h-16 w-16 rounded-full"
            >
              <Icon name="PhoneOff" size={28} />
            </Button>
            
            <Button
              onClick={handleAccept}
              size="icon"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
            >
              <Icon name="Phone" size={28} />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Phone" size={16} className="animate-bounce" />
            <span className="animate-pulse">Входящий звонок...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgoraIncomingCall;
