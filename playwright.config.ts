import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/browser', workers:1, timeout:45000,
  outputDir:'./node_modules/.cache/review-board-tests',
  use:{baseURL:'http://127.0.0.1:3217',viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:{
    command:'npm run devs -- --hostname 127.0.0.1 --port 3217',url:'http://127.0.0.1:3217/login',reuseExistingServer:false,timeout:120000,
    env:{OWNER_SESSION_SECRET:'local-stage-five-test-secret-not-for-production',PASSWORD_COOKIE_NAME:'review_test_session',
      PASSWORD:'local-test-password',REVIEW_COMMANDS_ENABLED:'false',SUPABASE_SERVICE_ROLE_KEY:'local-test-only',
      NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-only'},
  },
});
