import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X, LoaderCircle } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prior = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (prior instanceof HTMLElement) prior.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Area({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <LoaderCircle size={18} className="spin" />
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
  button = "Delete",
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  button?: string;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="danger" onClick={onConfirm}>
          {button}
        </button>
      </div>
    </Modal>
  );
}
