import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		"Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables"
	);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: Request) {
	try {
		const { data, error } = await supabase.from("items").select("*");

		if (error) {
			console.error("Error fetching data from Supabase:", error);
			return NextResponse.json(
				{ error: "Failed to fetch data from Supabase" },
				{ status: 500 }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error in API route:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
