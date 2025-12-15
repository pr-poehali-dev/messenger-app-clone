import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AudioCallProps {
  isOpen: boolean;
  onClose: () => void;
  initiator: boolean;
  recipientName: string;
  recipientAvatar?: string;
  onSignal?: (signal: SimplePeer.SignalData) => void;
  incomingSignal?: SimplePeer.SignalData;
}

const AudioCall = ({ isOpen, onClose, initiator, recipientName, recipientAvatar, onSignal, incomingSignal }: AudioCallProps) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Соединение...');
  
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setCallDuration(0);
      setIsConnected(false);
      setConnectionStatus('Соединение...');
      return;
    }

    const initPeer = async () => {
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
          initiator,
          trickle: false,
          stream: mediaStream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
            ],
          },
        });

        peerInstance.on('signal', (signal) => {
          console.log('Signal generated:', signal.type);
          if (onSignal) {
            onSignal(signal);
          }
        });

        peerInstance.on('stream', (remoteStream) => {
          console.log('Remote stream received');
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(err => console.error('Error playing remote audio:', err));
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
          console.log('Peer connected');
          setConnectionStatus('Соединено');
        });

        peerInstance.on('error', (err) => {
          console.error('Peer error:', err);
          setConnectionStatus('Ошибка соединения');
        });

        peerInstance.on('close', () => {
          console.log('Peer connection closed');
          setConnectionStatus('Звонок завершен');
        });

        setPeer(peerInstance);

        if (incomingSignal && !initiator) {
          console.log('Signaling incoming signal (receiver)');
          peerInstance.signal(incomingSignal);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setConnectionStatus('Ошибка доступа к микрофону');
      }
    };

    initPeer();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (peer) {
        peer.destroy();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isOpen, initiator]);

  useEffect(() => {
    if (peer && incomingSignal && initiator) {
      console.log('Signaling incoming signal (initiator)');
      peer.signal(incomingSignal);
    }
  }, [incomingSignal, peer, initiator]);

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      peer.destroy();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
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
        <audio ref={localAudioRef} autoPlay muted />
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
