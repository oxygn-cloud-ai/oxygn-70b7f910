import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yoxudmifddtjrrqiunaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlveHVkbWlmZGR0anJycWl1bmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYyOTY5NzIsImV4cCI6MjA0MTg3Mjk3Mn0.stJR9YuNFfDAy8p3qGTc7NFn00nMn4lItmD-mVlqN1s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test the connection with improved error handling
const testConnection = async () => {
  try {
    console.log('Supabase API Call:', {
      table: 'projects',
      action: 'select',
      query: 'Select * limit 1',
    });

    const { data, error, status } = await supabase
      .from('projects')
      .select('*')
      .limit(1);

    console.log('Supabase API Response:', {
      data,
      error,
      status,
    });

    if (error) {
      throw error;
    }

    if (status === 200) {
      console.log('Supabase connection successful');
    } else {
      console.warn(`Supabase connection returned unexpected status: ${status}`);
    }
  } catch (error) {
    console.error('Supabase connection error:', error);
    if (error.message === 'Failed to fetch') {
      console.error('Network error: Make sure you have an active internet connection and the Supabase server is accessible.');
    } else if (error.code === 'ECONNABORTED') {
      console.error('Connection timeout: The request to Supabase took too long to respond.');
    } else if (error.code === 'ERR_INSUFFICIENT_RESOURCES') {
      console.error('Insufficient resources: The browser or system ran out of memory or other resources needed to complete the request.');
    }
  }
};

testConnection();
