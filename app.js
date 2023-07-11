require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const CronJob = require('cron').CronJob;

const app = express();
const port = 3009;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
});

// Define the cron job
const job = new CronJob('0 0 * * *', function() { // This will run daily at 00:00
  updateWallets();
}, null, true, 'America/Los_Angeles'); // Set your time zone

// The function to update wallets
async function updateWallets() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all wallets
    const res = await client.query('SELECT * FROM wallets');
    const wallets = res.rows;

    // Iterate over wallets and update totalwithdrawable
    for (let wallet of wallets) {
        let new_totalwithdrawable = wallet.walletbalance * 1.02; // Increase by 2%
        
        // Update the database
        await client.query('UPDATE wallets SET totalwithdrawable = $1 WHERE address = $2', 
            [new_totalwithdrawable, wallet.address]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating wallets:', error);
  } finally {
    client.release();
  }
}

job.start(); // Start the cron job


app.post('/api/wallet', async (req, res) => {
  const { address, balance, withdrawable } = req.body;
  try {
    const result = await pool.query('SELECT * FROM wallets WHERE address = $1', [address]);

    if (result.rows.length > 0) {
      // Wallet address exists, update the record
      await pool.query('UPDATE wallets SET walletbalance = $1, totalwithdrawable = $2 WHERE address = $3', [
        balance,
        withdrawable,
        address
      ]);
      res.json({ message: 'Data updated successfully' });
    } else {
      // Wallet address doesn't exist, insert a new record
      await pool.query('INSERT INTO wallets (address, walletbalance, totalwithdrawable) VALUES ($1, $2, $3)', [
        address,
        balance,
        withdrawable
      ]);
      res.json({ message: 'Data inserted successfully' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/wallet/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const result = await pool.query('SELECT * FROM wallets WHERE address = $1', [walletAddress]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'Wallet not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress;

    // Query to get transactions for a specific wallet
    const query = `
        SELECT * FROM transactions 
        WHERE wallet_address = $1
        ORDER BY timestamp DESC;
    `;

    const { rows } = await pool.query(query, [walletAddress]);

    res.json(rows);
  } catch (error) {
    console.error(`Error in API: ${error.message}`);
    res.status(500).json({ error: 'An error occurred while fetching transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  const { wallet_address, status, type, value } = req.body;
  try {
    await pool.query(
      'INSERT INTO transactions (id, wallet_address, status, type, value) VALUES (DEFAULT, $1, $2, $3, $4)',
      [wallet_address, status, type, value]
    );
    res.json({ message: 'Transaction added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/transactions', async (req, res) => {
  const { id, wallet_address, status, type, value } = req.body;
  try {
    await pool.query(
      'UPDATE transactions SET status = $1, type = $2, value = $3 WHERE id = $4 AND wallet_address = $5',
      [status, type, value, id, wallet_address]
    );
    res.json({ message: 'Transaction updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
