import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export const BaseDrawer: React.FC<BaseDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerActions,
  children,
  maxWidth = 'max-w-[560px]',
  className,
}) => {
  // ESC key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs z-40"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden text-foreground",
              maxWidth,
              className
            )}
          >
            {/* Header */}
            {(title || icon) && (
              <div className="p-5 border-b border-border bg-card/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {typeof title === 'string' ? (
                      <h3 className="text-base font-bold text-foreground truncate">{title}</h3>
                    ) : (
                      title
                    )}
                    {subtitle && (
                      typeof subtitle === 'string' ? (
                        <p className="text-xs text-muted-foreground truncate max-w-[340px] mt-0.5">{subtitle}</p>
                      ) : (
                        subtitle
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  <button
                    onClick={onClose}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                    title="Close drawer (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Content Slot */}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
