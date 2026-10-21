import { canSpeak, speak } from '../speech';
import { SpeakerIcon } from './Icons';

export function SpeakButton({ text, className = 'icon-btn' }: { text: string; className?: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className={className}
      aria-label={`${text} 발음 듣기`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      <SpeakerIcon />
    </button>
  );
}
