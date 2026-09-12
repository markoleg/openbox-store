import {defineConfig} from '@playwright/test';
if(process.env.REVIEW_LOCAL_INTEGRATION!=='1' || !process.env.REVIEW_TEST_SERVICE_JWT || !process.env.REVIEW_TEST_ANON_JWT)throw new Error('Start through the tracker isolated-DB test harness.');
export default defineConfig({
  testDir:'./tests/integration',testMatch:'*.spec.ts',workers:1,timeout:120000,
  outputDir:'./node_modules/.cache/review-integration-tests',
  use:{baseURL:'http://127.0.0.1:3218',viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:[
    {command:'node tests/integration/restProxy.mjs',url:'http://127.0.0.1:54835/health',reuseExistingServer:false,timeout:20000},
    {command:'npm run devs -- --hostname 127.0.0.1 --port 3218',url:'http://127.0.0.1:3218/login',reuseExistingServer:false,timeout:120000,
      env:{OWNER_SESSION_SECRET:'local-integration-owner-secret-not-production',PASSWORD_COOKIE_NAME:'review_integration_session',PASSWORD:'local-integration-password',
        REVIEW_COMMANDS_ENABLED:'true',SUPABASE_SERVICE_ROLE_KEY:process.env.REVIEW_TEST_SERVICE_JWT,
        NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54835',NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.REVIEW_TEST_ANON_JWT,
        BOT_TOKEN:'',TELEGRAM_WEBHOOK_SECRET:'',TELEGRAM_ALLOWED_USER_IDS:'',
      }},
  ],
});
