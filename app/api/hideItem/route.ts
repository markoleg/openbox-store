import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy GET link from old Telegram messages. A GET must not change anything:
 * it now leads to the authorized confirmation page, where the command is
 * applied explicitly (and journaled) with a POST.
 */
export async function GET(req: NextRequest) {
	const link = new URL(req.url).searchParams.get("link");
	if (!link) return NextResponse.json({ error: "Missing 'link' parameter" }, { status: 400 });
	const target = new URL("/zhezhemon/confirm", req.nextUrl.origin);
	target.searchParams.set("action", "hide");
	target.searchParams.set("link", link);
	return NextResponse.redirect(target, 303);
}
