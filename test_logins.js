import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually since we are in node
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

const testEmails = [
  'admin@gmail.com',
  'admin12@gmail.com',
  'staff@gmail.com',
  'parent@xample.com'
];

const testPasswords = [
  'password',
  'password123',
  'admin123',
  'Admin@123',
  'school123',
  'admin12',
  '12345678',
  '123456'
];

async function run() {
  console.log('Testing login credentials...');
  for (const email of testEmails) {
    for (const password of testPasswords) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (!error && data?.session) {
          console.log(`\n🎉 SUCCESSFUL LOGIN FOUND!`);
          console.log(`Email: ${email}`);
          console.log(`Password: ${password}`);
          return;
        }
      } catch (err) {
        // ignore
      }
    }
  }
  console.log('\n❌ No working default credentials found.');
}

run();
