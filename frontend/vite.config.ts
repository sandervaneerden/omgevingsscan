import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


export default defineConfig({

  plugins: [
    react()
  ],


  server: {

    proxy: {

      "/overpass": {

        target:
          "https://overpass-api.de",

        changeOrigin:
          true,

        rewrite:
          (path) =>
            path.replace(
              /^\/overpass/,
              "/api/interpreter"
            )

      }

    }

  }

});