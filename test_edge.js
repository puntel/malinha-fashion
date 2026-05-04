async function run() {
  const res = await fetch("https://nrlwfsmquwceathtxjgo.supabase.co/functions/v1/create-payment-intent", {
    method: "POST",
    headers: {
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHdmc21xdXdjZWF0aHR4amdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTY3MTgsImV4cCI6MjA4NzQzMjcxOH0.lLfUQ9mi4da9azM8PywQt8EkehdDYv_YK7WOGuutuGE",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@exemplo.com", name: "Test" })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
run();
