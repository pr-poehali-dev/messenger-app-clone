import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';

interface AudioCallProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  recipientId: number;
  recipientName: string;
  recipientAvatar?: string;
}

const AudioCall = ({ isOpen, onClose, currentUserId, recipientId, recipientName, recipientAvatar }: AudioCallProps) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Инициализация...');
  const [callId, setCallId] = useState<number | null>(null);
  
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const signalCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const cleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (signalCheckIntervalRef.current) {
      clearInterval(signalCheckIntervalRef.current);
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      peer.destroy();
    }
    if (callId) {
      api.endCall(callId).catch(console.error);
    }
    setCallDuration(0);
    setIsConnected(false);
    setConnectionStatus('Инициализация...');
    setCallId(null);
  };

  const initCall = async () => {
    try {
      setConnectionStatus('Получение доступа к микрофону...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      setStream(mediaStream);
      setConnectionStatus('Установка соединения...');

      const peerInstance = new SimplePeer({
        initiator: true,
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
          const newCallId = await api.createCall(currentUserId, recipientId, 'audio', signal);
          setCallId(newCallId);
          setConnectionStatus('Ожидание ответа...');
          
          signalCheckIntervalRef.current = setInterval(async () => {
            try {
              const updatedCall = await api.getIncomingCall(currentUserId);
              if (updatedCall && updatedCall.answerSignal && updatedCall.id === newCallId) {
                clearInterval(signalCheckIntervalRef.current!);
                peerInstance.signal(updatedCall.answerSignal);
              }
            } catch (err) {
              console.error('Error checking for answer:', err);
            }
          }, 1000);
        } catch (error) {
          console.error('Error creating call:', error);
          setConnectionStatus('Ошибка создания звонка');
        }
      });

      peerInstance.on('stream', (remoteStream) => {
        if (remoteAudioRef.current) {
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
        setConnectionStatus('Звонок завершен');
        endCall();
      });

      setPeer(peerInstance);
    } catch (error) {
      console.error('Error accessing media:', error);
      setConnectionStatus('Ошибка доступа к микрофону');
    }
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const endCall = () => {
    cleanup();
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
        <audio ref={remoteAudioRef} autoPlay />
        
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
              onClick={endCall}
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full"
            >
              <Icon name="PhoneOff" size={24} />
            </Button>
          </div>

          {!isConnected && (
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

export default AudioCall;
