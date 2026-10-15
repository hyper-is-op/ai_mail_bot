import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconContainerClassName?: string;
  hideCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconContainerClassName,
  hideCloseButton = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  headerActions,
  footer,
  children,
  maxWidth = 'max-w-2xl',
  className,
  bodyClassName,
}) => {
  // ESC key dismissal
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (closeOnBackdropClick) {
                onClose();
              }
            }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-40"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              "win11-card w-full max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden text-foreground",
              maxWidth,
              className
            )}
          >
            {/* Header */}
            {(title || icon) && (
              <div className="px-5 py-4 border-b border-border bg-card/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <div className={cn("p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0", iconContainerClassName)}>
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {typeof title === 'string' ? (
                      <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{title}</h3>
                    ) : (
                      title
                    )}
                    {subtitle && (
                      typeof subtitle === 'string' ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                      ) : (
                        subtitle
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  {!hideCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                      title="Close dialog (Esc)"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Content Body */}
            <div className={cn("flex-1 overflow-y-auto", bodyClassName)}>
              {children}
            </div>

            {/* Optional Sticky Footer */}
            {footer && (
              <div className="px-5 py-3.5 border-t border-border bg-card/60 flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
