import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// Global variable to store the Prisma client instance
let prisma: PrismaClient;

/**
 * Creates and returns a Prisma client instance
 * @returns PrismaClient instance
 */
export const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: ['query', 'error', 'info', 'warn'],
    errorFormat: 'pretty',
  });
};

/**
 * Initializes the database connection
 * @returns PrismaClient instance
 */
export const initializeDatabase = (): PrismaClient => {
  if (prisma) {
    return prisma;
  }

  prisma = createPrismaClient();

  // Prisma will handle logging internally based on the log configuration

  return prisma;
};

/**
 * Returns the Prisma client instance
 * @returns PrismaClient instance
 */
export const getDatabase = (): PrismaClient => {
  if (!prisma) {
    logger.error('Database accessed before initialization');
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
};

/**
 * Disconnects from the database
 */
export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null as any;
  }
};

/**
 * Health check for the database connection
 * @returns Promise<boolean> - true if connection is healthy
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const db = getDatabase();
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ msg: 'Database health check failed:', error: error instanceof Error ? error.message : String(error) });
    return false;
  }
};

/**
 * Executes a database transaction
 * @param callback - Function to execute within the transaction
 * @returns Promise with the result of the transaction
 */
export const executeTransaction = async <T>(
  callback: (tx: any) => Promise<T>
): Promise<T> => {
  const db = getDatabase();
  try {
    logger.debug({ operation: 'transaction_start' }, 'Starting database transaction');
    const result = await db.$transaction(callback) as Promise<T>;
    logger.debug({ operation: 'transaction_success' }, 'Database transaction completed successfully');
    return result;
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      operation: 'transaction_failed'
    }, 'Database transaction failed');

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Database transaction failed: ${error.message}`);
    }
    throw new Error('Database transaction failed: Unknown error');
  }
};

// Export the PrismaClient type for use in other modules
export type { PrismaClient };