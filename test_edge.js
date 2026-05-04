async function run() {
  const res = await fetch("https://nrlwfsmquwceathtxjgo.supabase.co/functions/v1/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ type: "ping" })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
run();
