import bcrypt from 'bcryptjs'
import { getPostgresPool } from '../config/database'

async function createDemoUser() {
  const pool = getPostgresPool()
  
  try {
    // Check if demo user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['demo@example.com']
    )

    let userId: number

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id
      console.log('Demo user already exists with ID:', userId)
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash('demo123', 10)

      // Create demo user
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, username, email, role`,
        ['demo', 'demo@example.com', hashedPassword, 'trader', true]
      )

      const user = result.rows[0]
      userId = user.id
      console.log('Demo user created successfully:', {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      })
    }

    // Check if balance already exists
    const existingBalance = await pool.query(
      'SELECT id FROM balances WHERE user_id = $1 AND asset = $2',
      [userId, 'USDT']
    )

    if (existingBalance.rows.length > 0) {
      console.log('Demo user balance already exists')
    } else {
      // Create initial balance for demo user
      await pool.query(
        `INSERT INTO balances (user_id, asset, available, locked, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [userId, 'USDT', 10000.00, 0.00]
      )

      console.log('Demo user balance created: 10,000 USDT available')
    }

  } catch (error) {
    console.error('Error creating demo user:', error)
  } finally {
    await pool.end()
  }
}

createDemoUser()
