const url = "https://nrlwfsmquwceathtxjgo.supabase.co/functions/v1/login-by-email";
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || 'FICTITIOUS_ANON_KEY_FOR_TEST'}`
  },
  body: JSON.stringify({ email: "invalid@email.com" })
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Body:", await r.text());
}).catch(e => console.error(e));
