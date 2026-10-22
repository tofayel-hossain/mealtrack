import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  description: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  description,
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '750px' }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Bazar Receipt</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
              title="Open in new tab"
            >
              <ExternalLink size={14} /> Open
            </a>
            <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="modal-body"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#070a11',
            padding: '1rem',
            minHeight: '350px',
          }}
        >
          <img
            src={imageUrl}
            alt={description}
            style={{
              maxWidth: '100%',
              maxHeight: '65vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
          />
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Transparent Proof of Purchase (Stored in Supabase Storage)
          </span>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
