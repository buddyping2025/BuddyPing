// Type declarations for env vars inlined by
// `babel-plugin-transform-inline-environment-variables`. These are read
// only via `process.env.NAME`. No `dotenv` is loaded at runtime.

declare const process: {
  env: {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    ONESIGNAL_APP_ID?: string;
    GOOGLE_WEB_CLIENT_ID?: string;
    [key: string]: string | undefined;
  };
};
