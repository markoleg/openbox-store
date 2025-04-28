import { createClient } from "@supabase/supabase-js";

// export const supabase = createClient(
// 	process.env.SUPABASE_URL!,
// 	process.env.SUPABASE_ANON_KEY!
// );
export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
