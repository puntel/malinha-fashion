import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nrlwfsmquwceathtxjgo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHdmc21xdXdjZWF0aHR4amdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTY3MTgsImV4cCI6MjA4NzQzMjcxOH0.lLfUQ9mi4da9azM8PywQt8EkehdDYv_YK7WOGuutuGE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Invoking create-payment-intent...');
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { email: 'nova_loja@exemplo.com', name: 'Nova Loja' }
  });
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
