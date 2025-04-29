import { NextRequest } from "next/server";
import { supabase } from "@/lib/SupaBaseClient";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const searchId = searchParams.get("searchId");
	const link = searchParams.get("link");
	if (!searchId || !link) {
		return new Response("Missing searchId or link", { status: 400 });
	}

	const handleBan = async () => {
		try {
			const { error: hideError } = await supabase
				.from("items")
				.update({ hidden: true })
				.eq("link", link);

			if (hideError) {
				console.error("Error hiding item:", hideError);
				return;
			}

			const { data: searchParamData, error: fetchError } = await supabase
				.from("searchparameters")
				.select("banned")
				.eq("id", searchId)
				.single();

			if (fetchError) {
				console.error("Error fetching search parameter:", fetchError);
				return;
			}

			let bannedList: string[] = [];

			if (searchParamData?.banned) {
				bannedList = Array.isArray(searchParamData.banned)
					? searchParamData.banned
					: [];
			}

			if (!bannedList.includes(link)) {
				bannedList.push(link);
			}

			const { error: updateError } = await supabase
				.from("searchparameters")
				.update({ banned: bannedList })
				.eq("id", searchId);

			if (updateError) {
				console.error("Error updating banned list:", updateError);
			}
		} catch (error) {
			console.error("Unexpected error:", error);
		}
	};
	try {
		await handleBan();
	} catch (error) {
		console.error("Unexpected error:", error);
		return new Response("Error banning item", { status: 500 });
	}
	return new Response("Item banned successfully", { status: 200 });
}
