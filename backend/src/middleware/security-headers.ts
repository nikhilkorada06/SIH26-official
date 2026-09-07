import { NextFunction, Request, Response } from 'express';

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // Disable legacy buggy XSS auditor in modern browsers
  res.setHeader('X-XSS-Protection', '0');

  // Restrict referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Isolate browsing context
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Minimal baseline CSP suitable for API backend
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");

  // HSTS when in production or HTTPS
  if (process.env.NODE_ENV === 'production' || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Ensure X-Powered-By is stripped
  res.removeHeader('X-Powered-By');

  next();
}
