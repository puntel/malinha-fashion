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
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("sb_publishable_Lg1n7k7Ih3ETsxNpD3pkvQ_06_i7x_V"),
  },
});
