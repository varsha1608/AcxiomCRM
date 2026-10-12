const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true
    });
    console.log(`[AcxiomCRM] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[AcxiomCRM] Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
