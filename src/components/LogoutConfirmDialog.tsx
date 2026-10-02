'use client';

import { LogOut, X, Loader2 } from 'lucide-react';

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoggingOut: boolean;
}

export default function LogoutConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  isLoggingOut,
}: LogoutConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          disabled={isLoggingOut}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5 text-red-600 ml-0.5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mt-1">
              Sign Out
            </h3>
            <p className="text-sm text-gray-500 mt-1.5">
              Are you sure you want to sign out of your account?
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={onCancel}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 min-w-[90px] justify-center"
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
