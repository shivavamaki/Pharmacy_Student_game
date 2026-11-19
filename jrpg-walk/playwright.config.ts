import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',
 timeout:35_000,
 expect:{timeout:15_000},
 retries: process.env.CI?1:0,
 reporter: process.env.CI?'github':'list',
 use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
 projects:[
  {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1366,height:900}}},
  {name:'android-touch-emulation',use:{...devices['Pixel 7'],browserName:'chromium'}}
 ],
 webServer:[
  {
   command:'npm run dev -- --host 127.0.0.1',
   url:'http://127.0.0.1:5173/jrpg/walk/',
   reuseExistingServer:!process.env.CI,
   timeout:90_000
  },
  {
   command:'python3 -m http.server 8070 --bind 127.0.0.1 --directory ../frontend',
   url:'http://127.0.0.1:8070/jrpg/lobby/',
   reuseExistingServer:!process.env.CI,
   timeout:60_000
  }
 ]
});
