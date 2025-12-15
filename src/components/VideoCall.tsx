import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface VideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  initiator: boolean;
  recipientName: string;
  onSignal?: (signal: SimplePeer.SignalData) => void;
  incomingSignal?: SimplePeer.SignalData;
}

const VideoCall = ({ isOpen, onClose, initiator, recipientName, onSignal, incomingSignal }: VideoCallProps) => {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const initPeer = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        const peerInstance = new SimplePeer({
          initiator,
          trickle: false,
          stream: mediaStream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        peerInstance.on('signal', (signal) => {
          if (onSignal) {
            onSignal(signal);
          }
        });

        peerInstance.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        peerInstance.on('error', (err) => {
          console.error('Peer error:', err);
        });

        setPeer(peerInstance);

        if (incomingSignal && !initiator) {
          peerInstance.signal(incomingSignal);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
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
    };
  }, [isOpen, initiator]);

  useEffect(() => {
    if (peer && incomingSignal && initiator) {
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

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      peer.destroy();
    }
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
                <p className="text-lg">Соединение...</p>
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
