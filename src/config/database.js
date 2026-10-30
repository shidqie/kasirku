const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getSupabase, isSupabaseConfigured } = require('./supabase');

dotenv.config();

let dbInstance = null;
let activeClient = 'sqlite'; // 'supabase' | 'postgres' | 'mysql' | 'sqlite'

/**
 * Konversi placeholder SQL '?' menjadi format parameter PostgreSQL '$1, $2, ...'
 */
function toPgQuery(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Inisialisasi Database SQLite (Lokal & Offline)
 */
function initSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(process.env.SQLITE_FILE || './database/kasirku.sqlite');
  
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqliteDb = new sqlite3.Database(dbPath);

  const adapter = {
    client: 'sqlite',
    supabase: null,
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
          sqliteDb.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve([rows]);
          });
        } else {
          sqliteDb.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve([{
              insertId: this.lastID,
              affectedRows: this.changes
            }]);
          });
        }
      });
    },
    async transaction(callback) {
      await this.query('BEGIN TRANSACTION');
      try {
        const result = await callback(this);
        await this.query('COMMIT');
        return result;
      } catch (err) {
        await this.query('ROLLBACK');
        throw err;
      }
    }
  };

  bootstrapSqliteSchema(adapter);
  return adapter;
}

/**
 * Inisialisasi Database PostgreSQL / Supabase
 */
async function initPostgres(connString) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: connString,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Uji koneksi pertama kali
  const client = await pool.connect();
  client.release();

  const supabaseClient = getSupabase();

  const adapter = {
    client: 'supabase',
    supabase: supabaseClient,
    async query(sql, params = []) {
      let pgSql = toPgQuery(sql);
      const trimmed = pgSql.trim();
      const isInsert = /^INSERT\s+/i.test(trimmed);
      if (isInsert && !/RETURNING/i.test(trimmed)) {
        pgSql += ' RETURNING id';
      }

      const res = await pool.query(pgSql, params);
      const isSelect = /^(SELECT|SHOW|PRAGMA)/i.test(trimmed);
      if (isSelect) {
        return [res.rows];
      }
      return [{
        insertId: res.rows && res.rows[0] ? res.rows[0].id : null,
        affectedRows: res.rowCount,
        rows: res.rows
      }];
    },
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txAdapter = {
          client: 'supabase',
          supabase: supabaseClient,
          async query(sql, params = []) {
            let pgSql = toPgQuery(sql);
            const trimmed = pgSql.trim();
            const isInsert = /^INSERT\s+/i.test(trimmed);
            if (isInsert && !/RETURNING/i.test(trimmed)) {
              pgSql += ' RETURNING id';
            }
            const res = await client.query(pgSql, params);
            if (/^(SELECT|SHOW|PRAGMA)/i.test(trimmed)) {
              return [res.rows];
            }
            return [{
              insertId: res.rows && res.rows[0] ? res.rows[0].id : null,
              affectedRows: res.rowCount,
              rows: res.rows
            }];
          }
        };
        const result = await callback(txAdapter);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };

  return adapter;
}

/**
 * Bootstrap SQLite Schema & Seed Data jika belum ada
 */
async function bootstrapSqliteSchema(adapter) {
  try {
    await adapter.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'kasir',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        receipt_header TEXT,
        receipt_footer TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0.00,
        sell_price REAL NOT NULL DEFAULT 0.00,
        base_unit TEXT NOT NULL,
        stock REAL NOT NULL DEFAULT 0.00,
        min_stock REAL NOT NULL DEFAULT 5.00,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS product_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        unit_name TEXT NOT NULL,
        conversion_factor REAL NOT NULL,
        sell_price REAL NOT NULL,
        barcode TEXT UNIQUE
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS product_barcodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        unit_id INTEGER,
        barcode TEXT NOT NULL UNIQUE,
        notes TEXT
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        cashier_id INTEGER,
        cashier_name TEXT,
        customer_name TEXT DEFAULT 'Umum',
        total_amount REAL NOT NULL DEFAULT 0.00,
        cash_received REAL NOT NULL DEFAULT 0.00,
        change_amount REAL NOT NULL DEFAULT 0.00,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS transaction_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        unit_id INTEGER,
        product_name_snapshot TEXT NOT NULL,
        unit_snapshot TEXT NOT NULL,
        quantity REAL NOT NULL,
        conversion_factor_snapshot REAL DEFAULT 1.0,
        base_quantity REAL DEFAULT 1.0,
        cost_price_snapshot REAL NOT NULL DEFAULT 0.00,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS stock_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_number TEXT NOT NULL UNIQUE,
        entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        supplier_name TEXT,
        total_cost REAL DEFAULT 0.00,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS stock_entry_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_cost REAL NOT NULL,
        subtotal REAL NOT NULL
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        balance_after REAL NOT NULL,
        reference_id TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS cash_flows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrasi kolom baru jika tabel SQLite sudah ada sebelumnya
    try { await adapter.query('ALTER TABLE transaction_details ADD COLUMN unit_id INTEGER'); } catch (e) {}
    try { await adapter.query('ALTER TABLE transaction_details ADD COLUMN conversion_factor_snapshot REAL DEFAULT 1.0'); } catch (e) {}
    try { await adapter.query('ALTER TABLE transaction_details ADD COLUMN base_quantity REAL DEFAULT 1.0'); } catch (e) {}
    try { await adapter.query("ALTER TABLE transactions ADD COLUMN customer_name TEXT DEFAULT 'Umum'"); } catch (e) {}

    // Cek seed user default jika kosong
    const [existingUsers] = await adapter.query('SELECT COUNT(*) AS count FROM users');
    if (existingUsers[0].count === 0) {
      await adapter.query(
        `INSERT INTO users (username, password, name, role) VALUES 
         ('pemilik', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'H. Ahmad (Pemilik Toko)', 'pemilik'),
         ('kasir', '$2a$10$wQ9zUq6O.QZ7rB2/f1xPZ.1lFeqj141Kj00GZf905g2Z11V.d9j8O', 'Kasir Toko Berkah', 'kasir')`
      );

      await adapter.query(
        `INSERT INTO store_settings (store_name, address, phone, receipt_header, receipt_footer) VALUES 
         ('Toko Kelontong Berkah', 'Jl. Pasar Baru No. 12, Bandung', '0812-3456-7890', 'Menyediakan Sembako & Kebutuhan Harian Murah', 'Terima kasih atas kunjungan Anda!')`
      );

      const categories = [
        ['Sembako', 'Beras, gula, minyak goreng, tepung, dan telur'],
        ['Minuman', 'Air mineral, teh, kopi, dan minuman kemasan'],
        ['Bumbu Dapur', 'Garam, penyedap rasa, kecap, dan rempah instan'],
        ['Makanan Ringan', 'Mi instan, biskuit, dan makanan ringan'],
        ['Perlengkapan Rumah', 'Sabun mandi, deterjen, dan kebutuhan rumah tangga']
      ];
      for (const cat of categories) {
        await adapter.query('INSERT INTO categories (name, description) VALUES (?, ?)', cat);
      }

      const products = [
        [1, 'PRD-001', '899123456001', 'Beras Ramos Super (per kg)', 13500, 15000, 'kg', 50.0, 10.0],
        [1, 'PRD-002', '899123456002', 'Minyak Goreng Sawit (per liter)', 15000, 17500, 'liter', 30.0, 5.0],
        [1, 'PRD-003', '899123456003', 'Gula Pasir Putih (per kg)', 14000, 16000, 'kg', 25.0, 5.0],
        [1, 'PRD-004', '899123456004', 'Telur Ayam Negeri (per kg)', 26000, 28500, 'kg', 18.5, 5.0],
        [1, 'PRD-005', '899123456005', 'Tepung Terigu Segitiga Biru 1kg', 10500, 12000, 'bungkus', 20.0, 4.0],
        [4, 'PRD-006', '899886620022', 'Indomie Goreng Original 85g', 2900, 3500, 'bungkus', 80.0, 20.0],
        [4, 'PRD-007', '899886620039', 'Indomie Kuah Ayam Bawang 75g', 2800, 3300, 'bungkus', 60.0, 15.0],
        [2, 'PRD-008', '899990900101', 'Aqua Air Mineral 600ml', 2500, 3500, 'botol', 48.0, 12.0],
        [2, 'PRD-009', '899275311201', 'Kopi Kapal Api Spesial Mix 10x24g', 12500, 15000, 'renceng', 15.0, 3.0],
        [3, 'PRD-010', '899274512301', 'Kecap Manis Bango 135ml Refill', 7500, 9000, 'pouch', 14.0, 3.0],
        [5, 'PRD-011', '899999912001', 'Sabun Mandi Lifebuoy Total 10 110g', 3800, 4800, 'pcs', 24.0, 6.0],
        [5, 'PRD-012', '899889912345', 'Deterjen Rinso Molto Bubuk 770g', 19000, 22000, 'bungkus', 10.0, 2.0]
      ];

      for (const p of products) {
        await adapter.query(
          `INSERT INTO products 
           (category_id, code, barcode, name, cost_price, sell_price, base_unit, stock, min_stock) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          p
        );
      }
      console.log('✅ SQLite Schema & Seed data toko kelontong berhasil diinisialisasi.');
    }
  } catch (err) {
    console.error('Error bootstrapping SQLite schema:', err);
  }
}

/**
 * Inisialisasi Database Connection Pool
 */
async function getDatabase() {
  if (dbInstance) return dbInstance;

  const clientChoice = (process.env.DB_CLIENT || '').toLowerCase();
  const pgConnString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  // 1. Coba koneksi ke Supabase / PostgreSQL jika dipilih atau jika connection string tersedia
  if (clientChoice === 'supabase' || clientChoice === 'postgres' || pgConnString) {
    if (pgConnString) {
      try {
        dbInstance = await initPostgres(pgConnString);
        activeClient = 'supabase';
        console.log('✅ Terhubung ke Supabase PostgreSQL Database.');
        return dbInstance;
      } catch (pgErr) {
        console.warn('⚠️ Gagal terhubung ke Supabase PostgreSQL (' + pgErr.message + '). Beralih ke fallback...');
      }
    }
  }

  // 2. Coba MySQL jika diminta
  if (clientChoice === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kasirku',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      const conn = await pool.getConnection();
      conn.release();
      console.log('✅ Terhubung ke MySQL Database:', process.env.DB_NAME);

      dbInstance = {
        client: 'mysql',
        supabase: getSupabase(),
        query: (sql, params) => pool.query(sql, params),
        async transaction(callback) {
          const connection = await pool.getConnection();
          await connection.beginTransaction();
          try {
            const result = await callback(connection);
            await connection.commit();
            return result;
          } catch (err) {
            await connection.rollback();
            throw err;
          } finally {
            connection.release();
          }
        }
      };
      activeClient = 'mysql';
      return dbInstance;
    } catch (mysqlErr) {
      console.warn('⚠️ Gagal terhubung ke MySQL (' + mysqlErr.message + '). Beralih otomatis ke SQLite lokal...');
    }
  }

  // 3. Fallback ke SQLite Lokal
  dbInstance = initSqlite();
  activeClient = 'sqlite';
  console.log('✅ Menggunakan SQLite Database Lokal:', process.env.SQLITE_FILE || './database/kasirku.sqlite');
  return dbInstance;
}

module.exports = {
  getDatabase,
  getClient: () => activeClient
};
