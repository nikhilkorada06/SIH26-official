export interface AppConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  nodeEnv: string;
  mockEduPort: number;
  mockEmpPort: number;
  isProduction: boolean;
}

export function validateAndLoadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const port = Number(process.env.PORT) || 5000;
  const mongoUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET;
  const mockEduPort = Number(process.env.MOCK_EDU_PORT) || 4001;
  const mockEmpPort = Number(process.env.MOCK_EMP_PORT) || 4002;

  if (isProduction) {
    if (!mongoUri) {
      throw new Error('FATAL: MONGODB_URI must be configured in production');
    }
    if (!jwtSecret || jwtSecret === 'replace-this-with-a-long-random-secret' || jwtSecret.length < 16) {
      throw new Error('FATAL: A secure JWT_SECRET of at least 16 characters must be configured in production');
    }
  } else {
    if (!mongoUri) {
      console.warn('WARN: MONGODB_URI is not set. Using fallback for local development: mongodb://127.0.0.1:27018/sih_demo');
    }
    if (!jwtSecret) {
      console.warn('WARN: JWT_SECRET is not set. Using dev default secret for local SIH testing.');
    }
  }

  return {
    port,
    mongoUri: mongoUri || 'mongodb://127.0.0.1:27018/sih_demo',
    jwtSecret: jwtSecret || 'dev-sih-jwt-secret-key-1234567890',
    nodeEnv,
    mockEduPort,
    mockEmpPort,
    isProduction
  };
}
