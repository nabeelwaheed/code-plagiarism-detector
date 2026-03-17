const { Pool } = require('pg');

const pool = new Pool({
    //user: process.env.DB_USER || 'bigZ',
    //host: process.env.DB_HOST || 'localhost',
    //database: process.env.DB_NAME || 'testDb',
    //password: process.env.DB_PASSWORD || 'testPassword',
    //port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'schema',
    password: process.env.DB_PASSWORD || 'ForeverBread',
    port: process.env.DB_PORT || 5432,
});

pool.query('SELECT NOW()',(err,res) => {
    if (err) {
        console.error("Database Connection Failed...",err.message);
    } else {
        console.log("Database Connected at:",res.rows[0].now);
    }
})

module.exports = {
    query: (text, params) => pool.query(text, params),
};