import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yoxudmifddtjrrqiunaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlveHVkbWlmZGR0anJycWl1bmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYyOTY5NzIsImV4cCI6MjA0MTg3Mjk3Mn0.stJR9YuNFfDAy8p3qGTc7NFn00nMn4lItmD-mVlqN1s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});

// Add error handling
supabase.from('projects').select('*').then(
  (response) => {
    if (response.error) {
      console.error('Supabase error:', response.error);
    } else {
      console.log('Supabase connection successful');
    }
  },
  (error) => {
    console.error('Supabase connection error:', error);
  }
);
