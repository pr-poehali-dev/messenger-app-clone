import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface VideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  recipientId: number;
  recipientName: string;
}

const VideoCall = ({ isOpen, onClose, currentUserId, recipientId, recipientName }: VideoCallProps) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Инициализация...');
  const [callId, setCallId] = useState<number | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
    setConnectionStatus('Инициализация...');
    setCallId(null);
  };

  const initCall = async () => {
    try {
      setConnectionStatus('Получение доступа к камере...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
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
          const newCallId = await api.createCall(currentUserId, recipientId, 'video', signal);
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
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setConnectionStatus('Подключено');
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
      setConnectionStatus('Ошибка доступа к камере');
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

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    cleanup();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={endCall}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Видеозвонок с {recipientName}</DialogTitle>
        </DialogHeader>
        
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

          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Icon name="Phone" size={48} className="mx-auto mb-4" />
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

export default VideoCall;
