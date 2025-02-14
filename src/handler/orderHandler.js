// Saat membuat order baru
const createOrder = async (connection, orderData) => {
  try {
    const [result] = await connection.execute(
      `INSERT INTO orders (
        no_meja, 
        id_user, 
        tanggal, 
        status_order,
        total_harga,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderData.no_meja,
        orderData.id_user,
        orderData.tanggal,
        'pending',
        0.00,
        new Date(),
        new Date()
      ]
    );
    return result;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}; 