require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3009;

app.use(cors());
app.use(bodyParser.json());

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

app.post('/api/wallet', async (req, res) => {
  const { address, balance, withdrawable } = req.body;
  try {
    await pool.query('INSERT INTO wallets (address, walletbalance, totalwithdrawable) VALUES ($1, $2, $3)', [address, balance, withdrawable]);
    res.json({ message: 'Data inserted successfully' });
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
  

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
