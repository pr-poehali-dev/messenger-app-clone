import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';

interface IncomingCallProps {
  callData: {
    id: number;
    callerId: number;
    receiverId: number;
    callType: 'audio' | 'video';
    signalData: any;
    callerDisplayName: string;
    callerAvatar?: string;
  } | null;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCall = ({ callData, onAccept, onReject }: IncomingCallProps) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Входящий звонок...');
  const [isAccepted, setIsAccepted] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
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

  const cleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      peer.destroy();
    }
    setIsAccepted(false);
    setIsConnected(false);
  };

  const acceptCall = async () => {
    if (!callData) return;

    try {
      setConnectionStatus('Получение доступа к устройствам...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: callData.callType === 'video',
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      setStream(mediaStream);
      if (callData.callType === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
      setConnectionStatus('Установка соединения...');

      const peerInstance = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });

      peerInstance.on('signal', async (signal) => {
        try {
          await api.updateCall(callData.id, 'accepted', signal);
        } catch (error) {
          console.error('Error sending answer signal:', error);
        }
      });

      peerInstance.on('stream', (remoteStream) => {
        if (callData.callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(err => console.error('Error playing audio:', err));
        }
        
        setIsConnected(true);
        setConnectionStatus('Подключено');
        callStartTimeRef.current = Date.now();
        
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
            setCallDuration(duration);
          }
        }, 1000);
      });

      peerInstance.on('connect', () => {
        setConnectionStatus('Соединено');
      });

      peerInstance.on('error', (err) => {
        console.error('Peer error:', err);
        setConnectionStatus('Ошибка соединения');
      });

      peerInstance.on('close', () => {
        handleEndCall();
      });

      setPeer(peerInstance);
      
      if (callData.signalData) {
        peerInstance.signal(callData.signalData);
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      setConnectionStatus('Ошибка доступа к устройствам');
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
    cleanup();
    onReject();
  };

  const handleEndCall = async () => {
    if (callData) {
      await api.updateCall(callData.id, 'ended');
    }
    cleanup();
    onReject();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
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
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white"
            />

            {!isConnected && (
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
          <audio ref={remoteAudioRef} autoPlay />
          
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
                {isConnected ? formatDuration(callDuration) : connectionStatus}
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
          <Avatar className="h-32 w-32">
            <AvatarImage src={callData.callerAvatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-medium">
              {getInitials(callData.callerDisplayName)}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{callData.callerDisplayName}</h2>
            <p className="text-muted-foreground">
              {callData.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
            </p>
          </div>

          <div className="flex gap-4">
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
              variant="default"
              size="icon"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
            >
              <Icon name="Phone" size={28} />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Icon name="Phone" size={16} className="animate-bounce" />
            <span>Входящий звонок...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCall;
