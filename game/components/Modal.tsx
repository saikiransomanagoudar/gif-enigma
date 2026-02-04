import React, { useEffect, useState } from 'react';
import { colors } from '../lib/styles';
import { ComicText } from '../lib/fonts';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
  shake?: boolean;
  confirmDisabled?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  isOpen,
  onClose,
  onConfirm,
  children,
  shake,
  confirmDisabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAnimationComplete(false);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !visible) return null;

  const handleClose = () => {
    setAnimationComplete(false);
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md transition-opacity duration-300"
      onClick={handleClose}
    >
      <div
        className={`pointer-events-none transform ${
          !animationComplete ? 'transition-transform duration-300' : ''
        } ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          tabIndex={-1}
          className="pointer-events-auto w-[360px] max-w-[90vw] rounded-xl p-4 select-none focus:outline-none"
          style={{
            backgroundColor: colors.cardBackground,
            boxShadow: `0 8px 20px rgba(${colors.primary.replace('#', '')}, 0.5)`,
            border: `2px solid ${colors.primary}`,
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              {title.includes('Select a GIF for') && title !== "Select a GIF of your choice" ? (
                <ComicText size={0.8} color={colors.textPrimary}>
                  Select a GIF for <span style={{ color: '#FBBF24' }} className="truncate">{title.replace('Select a GIF for ', '')}</span>
                </ComicText>
              ) : (
                <ComicText size={0.8} color={colors.textPrimary}>
                  {title}
                </ComicText>
              )}
            </div>
            <button
              onClick={handleClose}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-gray-700 text-white transition-all duration-200 hover:rotate-90 hover:bg-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="mb-3">{children}</div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`rounded-full px-3 py-1.5 duration-200 ${
                confirmDisabled 
                  ? 'cursor-not-allowed opacity-50' 
                  : 'cursor-pointer hover:scale-105'
              }`}
              style={{ 
                backgroundColor: confirmDisabled ? '#6B7280' : colors.primary 
              }}
            >
              <ComicText size={0.5} color="white">
                Confirm
              </ComicText>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
