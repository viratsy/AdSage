'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';
import { Mic, Link, Loader2, Square } from 'lucide-react';

interface Props {
  adId: string;
  transcript?: string | null;
}

export default function VideoTranscript({ adId, transcript }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'recording' | 'recorded' | 'url'>('idle');
  const [videoUrl, setVideoUrl] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribeUrl = useMutation({
    mutationFn: () => aiApi.transcribe(adId, videoUrl),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ad', adId] }); setVideoUrl(''); setMode('idle'); },
  });

  const transcribeAudio = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error('No audio');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });
      return aiApi.transcribe(adId, '', base64);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ad', adId] }); setAudioBlob(null); setMode('idle'); },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      // Only keep audio tracks
      stream.getVideoTracks().forEach((t) => t.stop());
      const audioStream = new MediaStream(stream.getAudioTracks());
      streamRef.current = audioStream;

      if (audioStream.getAudioTracks().length === 0) {
        alert('No audio detected. Make sure to check "Share audio" in the dialog.');
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setMode('recorded');
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setMode('recording');
      setSeconds(0);

      // Countdown
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 74) { stopRecording(); return 75; }
          return s + 1;
        });
      }, 1000);

      // Auto-stop at 75s (1 min 15 sec)
      setTimeout(() => stopRecording(), 75000);
    } catch (err) {
      console.error('Recording failed:', err);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Already has transcript
  if (transcript) {
    return (
      <div className="rounded-xl p-5 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Video Transcript</p>
        <p className="text-sm leading-relaxed">{transcript}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Video Transcript</p>

      {mode === 'idle' && (
        <div className="flex gap-2">
          <button onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors hover:ring-1 hover:ring-indigo-500"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Mic size={12} /> Record Audio
          </button>
          <button onClick={() => setMode('url')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors hover:ring-1 hover:ring-indigo-500"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Link size={12} /> Get from Video URL
          </button>
        </div>
      )}

      {mode === 'recording' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm">Recording... {75 - seconds}s remaining</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Go play the video ad, then come back and stop.</p>
          <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white" style={{ background: '#ef4444' }}>
            <Square size={10} /> Stop Recording
          </button>
        </div>
      )}

      {mode === 'recorded' && (
        <div className="space-y-3">
          <p className="text-sm text-green-400">Audio recorded ({Math.round((audioBlob?.size || 0) / 1024)}KB)</p>
          <div className="flex gap-2">
            <button onClick={() => transcribeAudio.mutate()} disabled={transcribeAudio.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {transcribeAudio.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
              {transcribeAudio.isPending ? 'Transcribing...' : 'Transcribe · 30 tokens'}
            </button>
            <button onClick={() => { setAudioBlob(null); setMode('idle'); }} className="px-3 py-2 rounded-lg text-xs text-gray-400" style={{ border: '1px solid var(--border)' }}>Discard</button>
          </div>
          {transcribeAudio.isError && <p className="text-xs text-red-400">Failed. Tokens refunded.</p>}
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Paste video URL..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <button onClick={() => transcribeUrl.mutate()} disabled={transcribeUrl.isPending || !videoUrl.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 whitespace-nowrap" style={{ background: 'var(--accent)' }}>
              {transcribeUrl.isPending ? 'Transcribing...' : 'Transcribe · 30 tokens'}
            </button>
          </div>
          <button onClick={() => setMode('idle')} className="text-xs text-gray-400 hover:text-white">← Back</button>
          {transcribeUrl.isError && <p className="text-xs text-red-400">Failed. Tokens refunded.</p>}
        </div>
      )}
    </div>
  );
}
