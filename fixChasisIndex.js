// fixChassisIndex.js
// Run this script ONCE to fix the chassis number index issue
// Usage: node fixChassisIndex.js

require('dotenv').config();
const mongoose = require('mongoose');

async function fixChassisIndex() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('vehicles');

    console.log('\n📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // Check if the problematic index exists
    const hasChassisIndex = indexes.some(idx => idx.key && idx.key.chassisNumber);
    
    if (hasChassisIndex) {
      console.log('\n🔧 Dropping old chassisNumber index...');
      try {
        await collection.dropIndex('chassisNumber_1');
        console.log('✅ Old index dropped successfully');
      } catch (err) {
        if (err.codeName === 'IndexNotFound') {
          console.log('ℹ  Index already removed');
        } else {
          throw err;
        }
      }
    } else {
      console.log('\nℹ  No problematic index found');
    }

    console.log('\n🔧 Creating new sparse index for chassisNumber...');
    await collection.createIndex(
      { chassisNumber: 1 }, 
      { sparse: true, background: true }
    );
    console.log('✅ New sparse index created');

    console.log('\n📊 Verifying indexes...');
    const newIndexes = await collection.indexes();
    console.log('Updated indexes:', JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Migration completed successfully!');
    console.log('👉 Customers can now add multiple vehicles without chassis numbers');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

fixChassisIndex();