import type { ComponentChildren, Ref } from 'preact';
import { IconButton } from './IconButton';

interface BottomSheetProps {
  title: string;
  dialogRef: Ref<HTMLDialogElement>;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * A bottom sheet built on <dialog>, so focus trapping, Escape and the backdrop come
 * from the browser. Opening is imperative (dialog.showModal()) so callers can focus
 * an input in the same tap, which iOS requires to raise the keyboard.
 */
export function BottomSheet({ title, dialogRef, onClose, children }: BottomSheetProps) {
  return (
    <dialog
      ref={dialogRef}
      class="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close();
      }}
    >
      <div class="card">
        <span class="card-grab" aria-hidden="true" />
        <div class="card-head">
          <h2 class="card-title">{title}</h2>
          <IconButton icon="close" label="Close" onClick={(e) => ((e.currentTarget as HTMLElement).closest('dialog') as HTMLDialogElement).close()} />
        </div>
        {children}
      </div>
    </dialog>
  );
}
