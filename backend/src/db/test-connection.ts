import { db } from './index.js';
import { users } from './schema.js';

async function test() {
  try {
    console.log('Testing Turso connection...');
    const result = await db.select().from(users).limit(1);
    console.log('Connection successful! Found users:', result.length);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

test();
