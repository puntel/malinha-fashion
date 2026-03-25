import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://nrlwfsmquwceathtxjgo.supabase.co"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHdmc21xdXdjZWF0aHR4amdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTY3MTgsImV4cCI6MjA4NzQzMjcxOH0.lLfUQ9mi4da9azM8PywQt8EkehdDYv_YK7WOGuutuGE"),
  },
});
