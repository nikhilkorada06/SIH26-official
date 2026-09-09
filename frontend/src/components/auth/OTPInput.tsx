import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  error?: string;
  isLoading?: boolean;
  onResend?: () => Promise<void>;
  resendCooldownSeconds?: number;
  isExpired?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  isLoading = false,
  onResend,
  resendCooldownSeconds = 60,
  isExpired = false
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState<number>(resendCooldownSeconds);
  const [isResending, setIsResending] = useState<boolean>(false);

  // Split string into array of single characters
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto-focus the first empty box on mount
  useEffect(() => {
    const firstEmptyIndex = digits.findIndex((d) => !d);
    const focusIndex = firstEmptyIndex === -1 ? length - 1 : firstEmptyIndex;
    inputRefs.current[focusIndex]?.focus();
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index: number, val: string) => {
    // Only accept numbers
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal && val !== '') return;

    const newDigits = [...digits];
    // If user typed a single character
    if (cleanVal.length === 1) {
      newDigits[index] = cleanVal;
      const combined = newDigits.join('');
      onChange(combined);

      // Auto advance to next box
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (combined.length === length && onComplete) {
        onComplete(combined);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pastedData) return;

    onChange(pastedData);
    const targetIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[targetIndex]?.focus();

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData);
    }
  };

  const handleResendClick = async () => {
    if (cooldown > 0 || isResending || !onResend) return;
    try {
      setIsResending(true);
      await onResend();
      setCooldown(resendCooldownSeconds);
      // Clear current input
      onChange('');
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* 6-box OTP digits */}
      <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
        {Array.from({ length }, (_, i) => {
          const isFilled = !!digits[i];
          return (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[i] || ''}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isLoading}
              className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all duration-150 focus:outline-none select-none ${
                error
                  ? 'border-rose-400 bg-rose-50/40 text-rose-700 focus:ring-2 focus:ring-rose-200'
                  : isFilled
                  ? 'border-gov-blue bg-gov-light/30 text-gov-navy'
                  : 'border-slate-300 bg-white text-slate-800 focus:border-saffron-500 focus:ring-2 focus:ring-saffron-100 hover:border-slate-400'
              }`}
            />
          );
        })}
      </div>

      {/* Error / Expiration Banner */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 animate-fade-in">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resend & Timer Area */}
      {onResend && (
        <div className="flex items-center justify-between w-full max-w-xs pt-1 text-xs text-slate-500">
          <span>Didn't receive OTP?</span>
          {cooldown > 0 ? (
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <span>Resend in {cooldown}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendClick}
              disabled={isResending}
              className="text-saffron-600 hover:text-saffron-700 font-bold hover:underline inline-flex items-center gap-1 focus:outline-none"
            >
              <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
              <span>Resend OTP</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
