import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Phone,
  Calendar,
  FileBadge,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { ASSETS } from '../assets/assets';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { OTPInput } from '../components/auth/OTPInput';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';

export const RegisterPage: React.FC = () => {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { registerInit, registerVerify, resendRegisterOtp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Step 1: Submit Registration Details
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields (Name, Email, Password).');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your password.');
      return;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const res = await registerInit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        registrationNumber: registrationNumber.trim() || undefined
      });

      if (res.requiresOtp) {
        setStep('otp');
        setSuccessMessage('An account activation OTP has been sent to your email.');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to initialize registration. Email may already be registered.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Registration OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await registerVerify({
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Invalid or expired OTP.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setError('');
      await resendRegisterOtp(email.trim().toLowerCase());
      setSuccessMessage('A fresh OTP has been dispatched to your email.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to resend OTP.'));
    }
  };

  return (
    <div className="min-h-[85vh] bg-gov-surface flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block p-1 focus:outline-none">
            <img
              src={ASSETS.logo}
              alt="MahaSetu"
              className="h-12 w-auto object-contain mx-auto rounded-md"
            />
          </Link>
          <div className="pt-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gov-dark">
              New Citizen Registration (नागरिक नोंदणी)
            </h2>
            <p className="text-xs text-gov-textSecondary mt-1">
              {step === 'details'
                ? 'Create your verified single sign-on profile for Maharashtra Government services'
                : 'Enter the 6-digit activation code sent to your email'}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gov-border shadow-portal p-6 sm:p-8 space-y-6">
          {/* Alerts */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 'details' ? (
            /* Step 1: Citizen Details Form */
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <Input
                label="Full Name (As per Aadhaar / Official ID) *"
                type="text"
                placeholder="e.g. Ramesh Shankar Patil"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User size={16} />}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="ramesh@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={16} />}
                  required
                />
                <Input
                  label="Mobile Number (Optional)"
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone size={16} />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Date of Birth (Optional)"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  leftIcon={<Calendar size={16} />}
                />
                <Input
                  label="Citizen Reference / Aadhaar Token (Optional)"
                  type="text"
                  placeholder="e.g. CIT-MH-99120"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  leftIcon={<FileBadge size={16} />}
                />
              </div>

              <Input
                label="Create Password (Min. 8 characters) *"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  if (error === 'Passwords do not match.' && value === confirmPassword) {
                    setError('');
                  }
                }}
                leftIcon={<Lock size={16} />}
                helperText="Must be at least 8 characters"
                autoComplete="new-password"
                required
              />

              <Input
                label="Confirm Password *"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setConfirmPassword(value);
                  if (error === 'Passwords do not match.' && value === password) {
                    setError('');
                  }
                }}
                leftIcon={<Lock size={16} />}
                autoComplete="new-password"
                required
              />

              <div className="p-3 bg-gov-surface rounded-lg border border-gov-border text-xs text-gov-textSecondary flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  By registering, you consent to secure OTP verification under the DPDP Act 2023.
                </span>
              </div>

              <Button
                variant="primary"
                type="submit"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight size={16} />}
              >
                Continue to OTP Activation
              </Button>
            </form>
          ) : (
            /* Step 2: Account Activation OTP */
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <span className="text-xs text-gov-textSecondary block">Activation code dispatched to:</span>
                <span className="font-semibold text-gov-blue text-sm font-mono block">{email}</span>
              </div>

              <div className="py-2">
                <OTPInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                  isLoading={isLoading}
                />
              </div>

              <div className="space-y-2.5">
                <Button
                  variant="primary"
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={otp.length !== 6}
                >
                  Activate Account & Sign In
                </Button>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-gov-border">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('details');
                      setOtp('');
                      setError('');
                    }}
                    className="text-gov-textSecondary hover:text-gov-blue flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back to details
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-gov-blue hover:text-gov-dark font-semibold cursor-pointer"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Login Link */}
          <div className="pt-4 border-t border-gov-border text-center text-xs text-gov-textSecondary">
            <span>Already have a citizen account? </span>
            <Link to="/login" className="font-semibold text-gov-blue hover:text-gov-dark">
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
