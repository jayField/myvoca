import type { KeyboardEvent, PointerEvent } from 'react';
import { GripIcon } from './Icons';

/**
 * The grip for moving one block: drag it with a mouse or finger, or focus it and press ↑/↓.
 * The list does the moving; this only reports where the pointer went.
 */
export function DragHandle({
  label,
  onStart,
  onMove,
  onEnd,
  onStep,
}: {
  label: string;
  onStart: (clientY: number) => void;
  onMove: (clientY: number) => void;
  onEnd: () => void;
  onStep: (delta: -1 | 1) => void;
}) {
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStart(e.clientY);
  }

  function key(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    onStep(e.key === 'ArrowUp' ? -1 : 1);
  }

  return (
    <button
      type="button"
      className="icon-btn drag-handle"
      aria-label={`${label} 순서 바꾸기 (위아래 화살표)`}
      title="끌어서 순서 바꾸기"
      onPointerDown={down}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && onMove(e.clientY)}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onKeyDown={key}
    >
      <GripIcon />
    </button>
  );
}
