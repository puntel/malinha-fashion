const url = "https://nrlwfsmquwceathtxjgo.supabase.co/functions/v1/login-by-email";
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHdmc21xdXdjZWF0aHR4amdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTY3MTgsImV4cCI6MjA4NzQzMjcxOH0.lLfUQ9mi4da9azM8PywQt8EkehdDYv_YK7WOGuutuGE'
  },
  body: JSON.stringify({ email: "invalid@email.com" })
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Body:", await r.text());
}).catch(e => console.error(e));
