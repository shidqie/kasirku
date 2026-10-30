const { z } = require('zod');

// Schema Login
const loginSchema = z.object({
  username: z.string({ required_error: 'Username wajib diisi' }).trim().min(3, 'Username minimal 3 karakter'),
  password: z.string({ required_error: 'Password wajib diisi' }).min(4, 'Password minimal 4 karakter')
});

// Schema Produk
const productSchema = z.object({
  category_id: z.coerce.number({ required_error: 'Kategori wajib dipilih' }).int().positive(),
  code: z.string({ required_error: 'Kode produk wajib diisi' }).trim().min(1, 'Kode produk tidak boleh kosong'),
  barcode: z.string().trim().optional().nullable(),
  name: z.string({ required_error: 'Nama produk wajib diisi' }).trim().min(2, 'Nama produk minimal 2 karakter'),
  cost_price: z.coerce.number().min(0, 'Harga modal tidak boleh negatif').default(0),
  sell_price: z.coerce.number({ required_error: 'Harga jual wajib diisi' }).min(0, 'Harga jual tidak boleh negatif'),
  base_unit: z.string({ required_error: 'Satuan dasar wajib diisi' }).trim().min(1, 'Satuan dasar tidak boleh kosong'),
  stock: z.coerce.number().min(0, 'Stok tidak boleh negatif').default(0),
  min_stock: z.coerce.number().min(0, 'Batas minimum stok tidak boleh negatif').default(5),
  is_active: z.coerce.number().int().min(0).max(1).default(1)
});

// Schema Detail Item Transaksi
const transactionItemSchema = z.object({
  product_id: z.coerce.number({ required_error: 'ID Produk wajib disertakan' }).int().positive(),
  unit_id: z.coerce.number().int().positive().optional().nullable(),
  quantity: z.coerce.number({ required_error: 'Jumlah barang wajib diisi' }).positive('Jumlah beli harus lebih dari 0'),
  unit_price: z.coerce.number().min(0).optional()
});

// Schema Checkout Transaksi Penjualan
const transactionSchema = z.object({
  items: z.array(transactionItemSchema).min(1, 'Keranjang belanja minimal berisi 1 barang'),
  cash_received: z.coerce.number({ required_error: 'Jumlah uang tunai wajib diisi' }).min(0, 'Uang tunai tidak valid'),
  payment_method: z.enum(['cash', 'qris', 'transfer']).default('cash'),
  notes: z.string().trim().optional().nullable(),
  cashier_id: z.coerce.number().int().optional().nullable(),
  cashier_name: z.string().trim().optional().nullable(),
  customer_name: z.string().trim().optional().nullable().default('Umum')
});

// Schema Stok Masuk (Kulakan)
const stockEntrySchema = z.object({
  supplier_name: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(
    z.object({
      product_id: z.coerce.number().int().positive(),
      quantity: z.coerce.number().positive('Jumlah stok masuk harus lebih dari 0'),
      unit_cost: z.coerce.number().min(0, 'Harga beli tidak boleh negatif')
    })
  ).min(1, 'Minimal terdapat 1 barang masuk')
});

// Schema Penyesuaian Stok (Stock Opname)
const stockAdjustmentSchema = z.object({
  product_id: z.coerce.number({ required_error: 'ID Produk wajib dipilih' }).int().positive(),
  actual_stock: z.coerce.number().min(0, 'Stok aktual tidak boleh negatif'),
  notes: z.string().trim().optional().nullable()
});

// Schema Arus Kas / Modal Awal
const cashFlowSchema = z.object({
  type: z.enum(['modal_awal', 'kas_masuk', 'kas_keluar'], {
    required_error: 'Tipe arus kas wajib dipilih'
  }),
  amount: z.coerce.number({ required_error: 'Nominal wajib diisi' }).positive('Nominal harus lebih dari 0'),
  category: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

/**
 * Helper validasi request body menggunakan Zod
 */
function validateBody(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validasi input gagal';
    const err = new Error(message);
    err.status = 400;
    err.issues = result.error.issues;
    throw err;
  }
  return result.data;
}

module.exports = {
  loginSchema,
  productSchema,
  transactionSchema,
  stockEntrySchema,
  stockAdjustmentSchema,
  cashFlowSchema,
  validateBody
};
