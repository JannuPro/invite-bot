const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://vrjswggzotjmwbfcvmnz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyanN3Z2d6b3RqbXdiZmN2bW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NjU5NDEsImV4cCI6MjA2OTA0MTk0MX0.HfZclErOJ4bmZTf9FGm_AV6hQP5tkeSBTMp4MmTlLYw';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyanN3Z2d6b3RqbXdiZmN2bW56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ2NTk0MSwiZXhwIjoyMDY5MDQxOTQxfQ.H8jeSvkxI48zroHoYXnpcyr84dFoUam9bw7hdXjXrTY';

// Create client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create anon client for user operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase, supabaseAnon };