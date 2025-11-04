import { Pool, Client, PoolConfig } from 'pg';
import { MongoClient, Db, Collection } from 'mongodb';
import { RedisClientType, createClient } from 'redis';
import * as fs from 'fs';
import * as path from 'path';
import { TestConfiguration } from './test-config';

/**
 * Database Setup and Management for Testing
 */
export interface DatabaseSetup {
  postgres: PostgresSetup;
  mongodb: MongoSetup;
  redis: RedisSetup;
  migrations: MigrationManager;
  seeds: SeedManager;
  cleanup: CleanupManager;
}

export interface PostgresSetup {
  pool: Pool;
  client: Client;
  config: PoolConfig;
  isInitialized: boolean;
}

export interface MongoSetup {
  client: MongoClient;
  db: Db;
  collections: Map<string, Collection>;
  isInitialized: boolean;
}

export interface RedisSetup {
  client: RedisClientType;
  isInitialized: boolean;
  defaultDb: number;
}

export interface Migration {
  id: string;
  name: string;
  version: string;
  up: (client: Pool) => Promise<void>;
  down: (client: Pool) => Promise<void>;
  timestamp: Date;
}

export interface Seed {
  name: string;
  dependencies: string[];
  run: (postgres: PostgresSetup, mongodb: MongoSetup, redis: RedisSetup) => Promise<void>;
  cleanup: (postgres: PostgresSetup, mongodb: MongoSetup, redis: RedisSetup) => Promise<void>;
}

/**
 * Database Setup Manager
 */
export class DatabaseSetupManager {
  private postgres: PostgresSetup;
  private mongodb: MongoSetup;
  private redis: RedisSetup;
  private migrations: MigrationManager;
  private seeds: SeedManager;
  private cleanup: CleanupManager;
  private config: TestConfiguration;

  constructor(config: TestConfiguration) {
    this.config = config;
    this.postgres = {
      pool: {} as Pool,
      client: {} as Client,
      config: this.getPostgresConfig(),
      isInitialized: false
    };
    this.mongodb = {
      client: {} as MongoClient,
      db: {} as Db,
      collections: new Map(),
      isInitialized: false
    };
    this.redis = {
      client: {} as RedisClientType,
      isInitialized: false,
      defaultDb: config.services.redis.db
    };
    this.migrations = new MigrationManager(this.postgres);
    this.seeds = new SeedManager(this.postgres, this.mongodb, this.redis);
    this.cleanup = new CleanupManager(this.postgres, this.mongodb, this.redis, config.database.cleanup);
  }

  /**
   * Initialize all database connections
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing database connections...');

      // Initialize PostgreSQL
      await this.initializePostgres();

      // Initialize MongoDB
      await this.initializeMongoDB();

      // Initialize Redis
      await this.initializeRedis();

      console.log('✅ All database connections initialized');

    } catch (error) {
      console.error('❌ Failed to initialize databases:', error);
      throw error;
    }
  }

  /**
   * Clean up all database connections
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up database connections...');

      // Clean up PostgreSQL
      if (this.postgres.isInitialized) {
        await this.postgres.pool.end();
        await this.postgres.client.end();
        this.postgres.isInitialized = false;
      }

      // Clean up MongoDB
      if (this.mongodb.isInitialized) {
        await this.mongodb.client.close();
        this.mongodb.isInitialized = false;
      }

      // Clean up Redis
      if (this.redis.isInitialized) {
        await this.redis.client.quit();
        this.redis.isInitialized = false;
      }

      console.log('✅ Database connections cleaned up');

    } catch (error) {
      console.error('❌ Failed to cleanup databases:', error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL setup
   */
  getPostgres(): PostgresSetup {
    return this.postgres;
  }

  /**
   * Get MongoDB setup
   */
  getMongoDB(): MongoSetup {
    return this.mongodb;
  }

  /**
   * Get Redis setup
   */
  getRedis(): RedisSetup {
    return this.redis;
  }

  /**
   * Get migration manager
   */
  getMigrations(): MigrationManager {
    return this.migrations;
  }

  /**
   * Get seed manager
   */
  getSeeds(): SeedManager {
    return this.seeds;
  }

  /**
   * Get cleanup manager
   */
  getCleanup(): CleanupManager {
    return this.cleanup;
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    if (!this.config.database.migrations.enabled) {
      console.log('⏭️  Migrations disabled');
      return;
    }

    await this.migrations.runMigrations();
  }

  /**
   * Run database seeds
   */
  async runSeeds(): Promise<void> {
    if (!this.config.database.seeds.enabled) {
      console.log('⏭️  Seeds disabled');
      return;
    }

    await this.seeds.runSeeds(this.config.database.seeds.data);
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    console.log('🔄 Resetting databases...');
    await this.cleanup.runCleanup();
    await this.runMigrations();
    await this.runSeeds();
    console.log('✅ Database reset complete');
  }

  // Private helper methods

  private getPostgresConfig(): PoolConfig {
    const pgConfig = this.config.database.postgres;
    return {
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
      user: pgConfig.username,
      password: pgConfig.password,
      ssl: pgConfig.ssl,
      max: pgConfig.maxConnections,
      idleTimeoutMillis: pgConfig.idleTimeoutMillis,
      connectionTimeoutMillis: pgConfig.connectionTimeoutMillis
    };
  }

  private async initializePostgres(): Promise<void> {
    this.postgres.pool = new Pool(this.postgres.config);
    this.postgres.client = new Client(this.postgres.config);

    try {
      // Test connection
      await this.postgres.pool.query('SELECT NOW()');
      await this.postgres.client.connect();

      this.postgres.isInitialized = true;
      console.log('✅ PostgreSQL initialized');

    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }

  private async initializeMongoDB(): Promise<void> {
    const mongoConfig = this.config.database.mongodb;

    try {
      this.mongodb.client = new MongoClient(mongoConfig.uri, mongoConfig.options);
      await this.mongodb.client.connect();
      this.mongodb.db = this.mongodb.client.db(mongoConfig.database);

      // Test connection
      await this.mongodb.db.admin().ping();

      this.mongodb.isInitialized = true;
      console.log('✅ MongoDB initialized');

    } catch (error) {
      console.error('❌ Failed to initialize MongoDB:', error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    const redisConfig = this.config.services.redis;

    try {
      this.redis.client = createClient({
        socket: {
          host: redisConfig.host || 'localhost',
          port: redisConfig.port || 6379
        },
        password: redisConfig.password,
        database: redisConfig.db
      }) as RedisClientType;

      await this.redis.client.connect();

      // Test connection
      await this.redis.client.ping();

      this.redis.isInitialized = true;
      console.log('✅ Redis initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      throw error;
    }
  }
}

/**
 * Migration Manager
 */
export class MigrationManager {
  private migrations: Map<string, Migration> = new Map();
  private postgres: PostgresSetup;

  constructor(postgres: PostgresSetup) {
    this.postgres = postgres;
    this.loadMigrations();
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    if (!this.postgres.isInitialized) {
      throw new Error('PostgreSQL not initialized');
    }

    console.log('🔄 Running database migrations...');

    // Create migrations table if it doesn't exist
    await this.createMigrationsTable();

    // Get executed migrations
    const executedMigrations = await this.getExecutedMigrations();

    // Run pending migrations
    const pendingMigrations = Array.from(this.migrations.values())
      .filter(migration => !executedMigrations.has(migration.id))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const migration of pendingMigrations) {
      console.log(`📦 Running migration: ${migration.name}`);

      try {
        await migration.up(this.postgres.pool);
        await this.recordMigration(migration);
        console.log(`✅ Migration completed: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Migration failed: ${migration.name}`, error);
        throw error;
      }
    }

    console.log('✅ All migrations completed');
  }

  /**
   * Rollback last migration
   */
  async rollbackMigration(): Promise<void> {
    if (!this.postgres.isInitialized) {
      throw new Error('PostgreSQL not initialized');
    }

    const executedMigrations = await this.getExecutedMigrations();
    if (executedMigrations.size === 0) {
      console.log('⏭️  No migrations to rollback');
      return;
    }

    // Get last executed migration
    const lastMigrationId = Array.from(executedMigrations).sort().pop();
    if (!lastMigrationId) {
      return;
    }

    const migration = this.migrations.get(lastMigrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${lastMigrationId}`);
    }

    console.log(`🔄 Rolling back migration: ${migration.name}`);

    try {
      await migration.down(this.postgres.pool);
      await this.removeMigrationRecord(lastMigrationId);
      console.log(`✅ Migration rolled back: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Migration rollback failed: ${migration.name}`, error);
      throw error;
    }
  }

  // Private helper methods

  private loadMigrations(): void {
    const migrationsPath = path.join(__dirname, '../migrations');

    if (!fs.existsSync(migrationsPath)) {
      console.log('📁 No migrations directory found, creating it...');
      fs.mkdirSync(migrationsPath, { recursive: true });
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    for (const file of migrationFiles) {
      try {
        const migrationPath = path.join(migrationsPath, file);
        const migrationModule = require(migrationPath);

        if (migrationModule.default && typeof migrationModule.default === 'function') {
          // Handle CommonJS exports
          this.loadMigrationFromFunction(file, migrationModule.default);
        } else if (migrationModule.up && typeof migrationModule.up === 'function') {
          // Handle ES modules with up/down functions
          this.loadMigrationFromObject(file, migrationModule);
        }
      } catch (error) {
        console.error(`❌ Failed to load migration: ${file}`, error);
      }
    }

    console.log(`📦 Loaded ${this.migrations.size} migrations`);
  }

  private loadMigrationFromFunction(file: string, migrationFunc: any): void {
    const parts = file.replace(/\.(ts|js)$/, '').split('_');
    const version = parts[0];
    const name = parts.slice(1).join(' ').replace(/-/g, ' ');

    const migration: Migration = {
      id: file.replace(/\.(ts|js)$/, ''),
      name,
      version,
      up: migrationFunc,
      down: async (client: Pool) => {
        // Generate down function based on up function
        console.log(`⚠️  No down function provided for migration: ${name}`);
      },
      timestamp: new Date()
    };

    this.migrations.set(migration.id, migration);
  }

  private loadMigrationFromObject(file: string, migrationModule: any): void {
    const parts = file.replace(/\.(ts|js)$/, '').split('_');
    const version = parts[0];
    const name = parts.slice(1).join(' ').replace(/-/g, ' ');

    const migration: Migration = {
      id: file.replace(/\.(ts|js)$/, ''),
      name,
      version,
      up: migrationModule.up,
      down: migrationModule.down || async (client: Pool) => {
        console.log(`⚠️  No down function provided for migration: ${name}`);
      },
      timestamp: new Date()
    };

    this.migrations.set(migration.id, migration);
  }

  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.postgres.pool.query(query);
  }

  private async getExecutedMigrations(): Promise<Set<string>> {
    const query = 'SELECT id FROM migrations';
    const result = await this.postgres.pool.query(query);
    return new Set(result.rows.map((row: any) => row.id));
  }

  private async recordMigration(migration: Migration): Promise<void> {
    const query = `
      INSERT INTO migrations (id, name, version)
      VALUES ($1, $2, $3)
    `;
    await this.postgres.pool.query(query, [migration.id, migration.name, migration.version]);
  }

  private async removeMigrationRecord(migrationId: string): Promise<void> {
    const query = 'DELETE FROM migrations WHERE id = $1';
    await this.postgres.pool.query(query, [migrationId]);
  }
}

/**
 * Seed Manager
 */
export class SeedManager {
  private seeds: Map<string, Seed> = new Map();
  private postgres: PostgresSetup;
  private mongodb: MongoSetup;
  private redis: RedisSetup;

  constructor(postgres: PostgresSetup, mongodb: MongoSetup, redis: RedisSetup) {
    this.postgres = postgres;
    this.mongodb = mongodb;
    this.redis = redis;
    this.loadSeeds();
  }

  /**
   * Run all seeds
   */
  async runSeeds(seedNames?: string[]): Promise<void> {
    const seedsToRun = seedNames || Array.from(this.seeds.keys());
    console.log('🌱 Running database seeds...');

    // Run seeds in dependency order
    const orderedSeeds = this.resolveDependencies(seedsToRun);

    for (const seedName of orderedSeeds) {
      const seed = this.seeds.get(seedName);
      if (!seed) {
        console.warn(`⚠️  Seed not found: ${seedName}`);
        continue;
      }

      console.log(`🌱 Running seed: ${seed.name}`);

      try {
        await seed.run(this.postgres, this.mongodb, this.redis);
        console.log(`✅ Seed completed: ${seed.name}`);
      } catch (error) {
        console.error(`❌ Seed failed: ${seed.name}`, error);
        throw error;
      }
    }

    console.log('✅ All seeds completed');
  }

  /**
   * Cleanup specific seeds
   */
  async cleanupSeeds(seedNames?: string[]): Promise<void> {
    const seedsToCleanup = seedNames || Array.from(this.seeds.keys());
    console.log('🧹 Cleaning database seeds...');

    // Cleanup in reverse dependency order
    const orderedSeeds = this.resolveDependencies(seedsToCleanup).reverse();

    for (const seedName of orderedSeeds) {
      const seed = this.seeds.get(seedName);
      if (!seed) {
        console.warn(`⚠️  Seed not found: ${seedName}`);
        continue;
      }

      console.log(`🧹 Cleaning seed: ${seed.name}`);

      try {
        await seed.cleanup(this.postgres, this.mongodb, this.redis);
        console.log(`✅ Seed cleaned: ${seed.name}`);
      } catch (error) {
        console.error(`❌ Seed cleanup failed: ${seed.name}`, error);
        throw error;
      }
    }

    console.log('✅ All seeds cleaned');
  }

  // Private helper methods

  private loadSeeds(): void {
    const seedsPath = path.join(__dirname, '../seeds');

    if (!fs.existsSync(seedsPath)) {
      console.log('📁 No seeds directory found, creating it...');
      fs.mkdirSync(seedsPath, { recursive: true });
      return;
    }

    const seedFiles = fs.readdirSync(seedsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of seedFiles) {
      try {
        const seedPath = path.join(seedsPath, file);
        const seedModule = require(seedPath);

        if (seedModule.default && typeof seedModule.default === 'object') {
          const seed: Seed = {
            name: seedModule.name || file.replace(/\.(ts|js)$/, ''),
            dependencies: seedModule.dependencies || [],
            run: seedModule.run || async () => {},
            cleanup: seedModule.cleanup || async () => {}
          };
          this.seeds.set(seed.name, seed);
        }
      } catch (error) {
        console.error(`❌ Failed to load seed: ${file}`, error);
      }
    }

    console.log(`🌱 Loaded ${this.seeds.size} seeds`);
  }

  private resolveDependencies(seedNames: string[]): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (seedName: string) => {
      if (visited.has(seedName)) {
        return;
      }
      if (visiting.has(seedName)) {
        throw new Error(`Circular dependency detected involving: ${seedName}`);
      }

      visiting.add(seedName);
      const seed = this.seeds.get(seedName);
      if (seed) {
        for (const dep of seed.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(seedName);
      visited.add(seedName);
      resolved.push(seedName);
    };

    for (const seedName of seedNames) {
      visit(seedName);
    }

    return resolved;
  }
}

/**
 * Cleanup Manager
 */
export class CleanupManager {
  private postgres: PostgresSetup;
  private mongodb: MongoSetup;
  private redis: RedisSetup;
  private config: any;

  constructor(
    postgres: PostgresSetup,
    mongodb: MongoSetup,
    redis: RedisSetup,
    config: any
  ) {
    this.postgres = postgres;
    this.mongodb = mongodb;
    this.redis = redis;
    this.config = config;
  }

  /**
   * Run cleanup operations
   */
  async runCleanup(): Promise<void> {
    if (!this.config.enabled) {
      console.log('⏭️  Cleanup disabled');
      return;
    }

    console.log('🧹 Running database cleanup...');

    switch (this.config.strategy) {
      case 'drop':
        await this.dropTables();
        break;
      case 'truncate':
        await this.truncateTables();
        break;
      case 'rollback':
        await this.rollbackTransactions();
        break;
      default:
        console.log('⚠️  Unknown cleanup strategy');
    }

    // Clear Redis if enabled
    if (this.redis.isInitialized) {
      await this.redis.client.flushDb();
      console.log('✅ Redis cleared');
    }

    console.log('✅ Database cleanup completed');
  }

  // Private helper methods

  private async dropTables(): Promise<void> {
    if (!this.postgres.isInitialized) {
      return;
    }

    const tables = this.config.tables || [
      'transactions',
      'balances',
      'positions',
      'proposals',
      'votes',
      'analytics'
    ];

    for (const table of tables) {
      try {
        await this.postgres.pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`🗑️  Dropped table: ${table}`);
      } catch (error) {
        console.warn(`⚠️  Failed to drop table: ${table}`, error);
      }
    }
  }

  private async truncateTables(): Promise<void> {
    if (!this.postgres.isInitialized) {
      return;
    }

    const tables = this.config.tables || [
      'transactions',
      'balances',
      'positions',
      'proposals',
      'votes',
      'analytics'
    ];

    // Disable foreign key constraints
    await this.postgres.pool.query('SET session_replication_role = replica;');

    for (const table of tables) {
      try {
        await this.postgres.pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        console.log(`🧹 Truncated table: ${table}`);
      } catch (error) {
        console.warn(`⚠️  Failed to truncate table: ${table}`, error);
      }
    }

    // Re-enable foreign key constraints
    await this.postgres.pool.query('SET session_replication_role = DEFAULT;');
  }

  private async rollbackTransactions(): Promise<void> {
    // This would typically be handled by test frameworks
    // For now, we'll just clear volatile data
    await this.truncateTables();
  }
}

/**
 * Export default database setup manager
 */
export default DatabaseSetupManager;