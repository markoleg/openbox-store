import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy GET link from old Telegram messages. A GET must not change anything:
 * it now leads to the authorized confirmation page, where the ban is applied
 * explicitly (and journaled) with a POST scoped to the named search.
 */
export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const searchId = searchParams.get("searchId");
	const link = searchParams.get("link");
	if (!searchId || !link) return new NextResponse("Missing searchId or link", { status: 400 });
	const target = new URL("/zhezhemon/confirm", req.nextUrl.origin);
	target.searchParams.set("action", "ban");
	target.searchParams.set("link", link);
	target.searchParams.set("searchId", searchId);
	return NextResponse.redirect(target, 303);
}
