const { getDatabase } = require('../config/database');
const { logMovement } = require('../services/stockService');

async function getProducts(req, res) {
  try {
    const db = await getDatabase();
    const { q, category_id, status, low_stock } = req.query;

    let sql = `
      SELECT p.*, c.name AS category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (category_id && category_id !== 'all') {
      sql += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (status === 'active') {
      sql += ` AND p.is_active = 1`;
    } else if (status === 'inactive') {
      sql += ` AND p.is_active = 0`;
    }

    if (low_stock === 'true') {
      sql += ` AND p.stock <= p.min_stock`;
    }

    sql += ` ORDER BY p.name ASC`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getProducts error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk.' });
  }
}

async function getProductByBarcode(req, res) {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Barcode tidak boleh kosong.' });
    }

    const cleanCode = code.trim();
    const db = await getDatabase();

    // 1. Pencarian utama pada tabel products (barcode atau code)
    let [rows] = await db.query(
      `SELECT p.*, c.name AS category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE LOWER(TRIM(p.barcode)) = LOWER(?) 
          OR LOWER(TRIM(p.code)) = LOWER(?)
          OR REPLACE(REPLACE(LOWER(TRIM(p.barcode)), '(', ''), ')', '') = REPLACE(REPLACE(LOWER(?), '(', ''), ')', '')
          OR REPLACE(REPLACE(LOWER(TRIM(p.code)), '(', ''), ')', '') = REPLACE(REPLACE(LOWER(?), '(', ''), ')', '')
       LIMIT 1`,
      [cleanCode, cleanCode, cleanCode, cleanCode]
    );

    // 2. Jika belum ditemukan, coba variasi format (leading zero, strip tanda baca)
    if (rows.length === 0) {
      const candidates = [];
      if (cleanCode.startsWith('0')) {
        candidates.push(cleanCode.replace(/^0+/, ''));
      } else {
        candidates.push('0' + cleanCode);
      }
      candidates.push(cleanCode.replace(/[\s()-]/g, ''));

      for (const alt of candidates) {
        if (!alt) continue;
        const [altRows] = await db.query(
          `SELECT p.*, c.name AS category_name 
           FROM products p 
           LEFT JOIN categories c ON p.category_id = c.id 
           WHERE LOWER(TRIM(p.barcode)) = LOWER(?) 
              OR LOWER(TRIM(p.code)) = LOWER(?)
              OR REPLACE(REPLACE(LOWER(TRIM(p.barcode)), '(', ''), ')', '') = REPLACE(REPLACE(LOWER(?), '(', ''), ')', '')
           LIMIT 1`,
          [alt, alt, alt]
        );
        if (altRows.length > 0) {
          rows = altRows;
          break;
        }
      }
    }

    // 3. Jika belum ditemukan di tabel products, periksa multi-satuan (product_units)
    if (rows.length === 0) {
      const [unitRows] = await db.query(
        `SELECT p.*, c.name AS category_name, 
                u.id AS unit_id, u.unit_name, u.conversion_factor, u.sell_price AS unit_sell_price
         FROM product_units u
         JOIN products p ON u.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE LOWER(TRIM(u.barcode)) = LOWER(?)
         LIMIT 1`,
        [cleanCode]
      );
      if (unitRows.length > 0) {
        const uProd = unitRows[0];
        uProd.sell_price = uProd.unit_sell_price;
        uProd.selected_unit_id = uProd.unit_id;
        uProd.selected_unit_name = uProd.unit_name;
        uProd.selected_conversion_factor = uProd.conversion_factor;
        rows = [uProd];
      }
    }

    // 4. Jika belum ditemukan, periksa tabel barcode tambahan (product_barcodes)
    if (rows.length === 0) {
      const [altBarcodeRows] = await db.query(
        `SELECT p.*, c.name AS category_name, pb.unit_id
         FROM product_barcodes pb
         JOIN products p ON pb.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE LOWER(TRIM(pb.barcode)) = LOWER(?)
         LIMIT 1`,
        [cleanCode]
      );
      if (altBarcodeRows.length > 0) {
        rows = altBarcodeRows;
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Produk dengan barcode '${cleanCode}' tidak ditemukan.` });
    }

    const prod = rows[0];
    if (!prod.is_active) {
      return res.status(400).json({ 
        success: false, 
        message: `Produk '${prod.name}' berstatus nonaktif. Aktifkan produk di menu Data Produk terlebih dahulu.` 
      });
    }

    res.json({ success: true, data: prod });
  } catch (err) {
    console.error('getProductByBarcode error:', err);
    res.status(500).json({ success: false, message: 'Gagal mencari produk melalui barcode.' });
  }
}

async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const product = rows[0];

    // Ambil multi-satuan jika ada
    const [units] = await db.query('SELECT * FROM product_units WHERE product_id = ? ORDER BY id ASC', [id]);
    product.units = units;

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('getProductById error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail produk.' });
  }
}

async function getNextProductCode(db) {
  const [rows] = await db.query('SELECT code FROM products');
  const existingCodes = new Set(rows.map(r => (r.code || '').trim()));
  let maxNum = 0;
  for (const r of rows) {
    if (r.code) {
      const match = r.code.match(/PRD-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `PRD-${String(nextNum).padStart(3, '0')}`;
  while (existingCodes.has(candidate)) {
    nextNum++;
    candidate = `PRD-${String(nextNum).padStart(3, '0')}`;
  }
  return candidate;
}

async function getNextCode(req, res) {
  try {
    const db = await getDatabase();
    const nextCode = await getNextProductCode(db);
    res.json({ success: true, next_code: nextCode });
  } catch (err) {
    console.error('getNextCode error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghasilkan kode produk otomatis.' });
  }
}

async function createProduct(req, res) {
  try {
    const {
      category_id,
      code,
      barcode,
      name,
      cost_price,
      sell_price,
      base_unit,
      stock,
      min_stock
    } = req.body;

    const db = await getDatabase();
    const finalCode = (code && code.trim()) ? code.trim() : await getNextProductCode(db);

    if (!name || !sell_price || !base_unit || !category_id) {
      return res.status(400).json({
        success: false,
        message: 'Kategori, nama produk, harga jual, dan satuan dasar wajib diisi.'
      });
    }

    const [existingCode] = await db.query('SELECT id FROM products WHERE code = ?', [finalCode]);
    if (existingCode.length > 0) {
      return res.status(400).json({ success: false, message: `Kode produk '${finalCode}' sudah digunakan.` });
    }

    if (barcode && barcode.trim()) {
      const [existingBarcode] = await db.query('SELECT id FROM products WHERE barcode = ?', [barcode.trim()]);
      if (existingBarcode.length > 0) {
        return res.status(400).json({ success: false, message: `Barcode '${barcode}' sudah digunakan produk lain.` });
      }
    }

    const parsedStock = parseFloat(stock) || 0.0;
    const parsedMinStock = parseFloat(min_stock) || 5.0;
    const parsedCost = parseFloat(cost_price) || 0.0;
    const parsedSell = parseFloat(sell_price) || 0.0;

    const [result] = await db.query(
      `INSERT INTO products 
       (category_id, code, barcode, name, cost_price, sell_price, base_unit, stock, min_stock, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        category_id,
        finalCode,
        barcode ? barcode.trim() : null,
        name.trim(),
        parsedCost,
        parsedSell,
        base_unit.trim(),
        parsedStock,
        parsedMinStock
      ]
    );

    const newProductId = result.insertId;

    if (parsedStock > 0) {
      await logMovement(db, {
        productId: newProductId,
        type: 'penyesuaian',
        quantity: parsedStock,
        balanceAfter: parsedStock,
        notes: 'Stok awal produk baru'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan.',
      data: { id: newProductId }
    });
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan produk baru.' });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      category_id,
      code,
      barcode,
      name,
      cost_price,
      sell_price,
      base_unit,
      min_stock,
      is_active
    } = req.body;

    const db = await getDatabase();
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    if (barcode && barcode.trim()) {
      const [duplicate] = await db.query(
        'SELECT id FROM products WHERE barcode = ? AND id != ?',
        [barcode.trim(), id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ success: false, message: `Barcode '${barcode}' sudah dipakai produk lain.` });
      }
    }

    await db.query(
      `UPDATE products SET 
         category_id = ?,
         code = ?,
         barcode = ?,
         name = ?,
         cost_price = ?,
         sell_price = ?,
         base_unit = ?,
         min_stock = ?,
         is_active = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        category_id || existing[0].category_id,
        code ? code.trim() : existing[0].code,
        barcode !== undefined ? (barcode ? barcode.trim() : null) : existing[0].barcode,
        name ? name.trim() : existing[0].name,
        cost_price !== undefined ? parseFloat(cost_price) : existing[0].cost_price,
        sell_price !== undefined ? parseFloat(sell_price) : existing[0].sell_price,
        base_unit ? base_unit.trim() : existing[0].base_unit,
        min_stock !== undefined ? parseFloat(min_stock) : existing[0].min_stock,
        is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
        id
      ]
    );

    res.json({ success: true, message: 'Data produk berhasil diperbarui.' });
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data produk.' });
  }
}

async function toggleProductStatus(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const [rows] = await db.query('SELECT is_active FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const newStatus = rows[0].is_active ? 0 : 1;
    await db.query('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

    res.json({
      success: true,
      message: `Produk berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`,
      is_active: newStatus
    });
  } catch (err) {
    console.error('toggleProductStatus error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengubah status produk.' });
  }
}

// Multi-Satuan Produk (product_units)
async function getProductUnits(req, res) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const [rows] = await db.query('SELECT * FROM product_units WHERE product_id = ? ORDER BY id ASC', [id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getProductUnits error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data multi-satuan produk.' });
  }
}

async function createProductUnit(req, res) {
  try {
    const { id } = req.params;
    const { unit_name, conversion_factor, sell_price, barcode } = req.body;

    if (!unit_name || !conversion_factor || !sell_price) {
      return res.status(400).json({ success: false, message: 'Nama satuan, faktor konversi, dan harga jual wajib diisi.' });
    }

    const db = await getDatabase();
    const [result] = await db.query(
      `INSERT INTO product_units (product_id, unit_name, conversion_factor, sell_price, barcode) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        unit_name.trim(),
        parseFloat(conversion_factor),
        parseFloat(sell_price),
        barcode ? barcode.trim() : null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Satuan produk berhasil ditambahkan.',
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error('createProductUnit error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan satuan produk.' });
  }
}

async function deleteProductUnit(req, res) {
  try {
    const { unitId } = req.params;
    const db = await getDatabase();
    await db.query('DELETE FROM product_units WHERE id = ?', [unitId]);
    res.json({ success: true, message: 'Satuan produk berhasil dihapus.' });
  } catch (err) {
    console.error('deleteProductUnit error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus satuan produk.' });
  }
}

async function getCategories(req, res) {
  try {
    const db = await getDatabase();
    const [rows] = await db.query('SELECT * FROM categories ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getCategories error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data kategori.' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
    }

    const db = await getDatabase();
    const [existing] = await db.query('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Kategori sudah ada.' });
    }

    const [result] = await db.query(
      'INSERT INTO categories (name, description, is_active) VALUES (?, ?, 1)',
      [name.trim(), description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Kategori berhasil ditambahkan.',
      data: { id: result.insertId, name: name.trim() }
    });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan kategori.' });
  }
}

async function getStoreSettings(req, res) {
  try {
    const db = await getDatabase();
    const [rows] = await db.query('SELECT * FROM store_settings LIMIT 1');
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    console.error('getStoreSettings error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil informasi toko.' });
  }
}

async function updateStoreSettings(req, res) {
  try {
    const { store_name, address, phone, receipt_header, receipt_footer } = req.body;
    if (!store_name) {
      return res.status(400).json({ success: false, message: 'Nama toko tidak boleh kosong.' });
    }

    const db = await getDatabase();
    await db.query(
      `UPDATE store_settings SET 
         store_name = ?,
         address = ?,
         phone = ?,
         receipt_header = ?,
         receipt_footer = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [store_name.trim(), address || '', phone || '', receipt_header || '', receipt_footer || '']
    );

    res.json({ success: true, message: 'Informasi toko berhasil disimpan.' });
  } catch (err) {
    console.error('updateStoreSettings error:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui informasi toko.' });
  }
}

module.exports = {
  getProducts,
  getProductByBarcode,
  getProductById,
  getNextCode,
  createProduct,
  updateProduct,
  toggleProductStatus,
  getProductUnits,
  createProductUnit,
  deleteProductUnit,
  getCategories,
  createCategory,
  getStoreSettings,
  updateStoreSettings
};
