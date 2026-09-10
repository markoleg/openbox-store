import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifyOwnerSession } from './lib/ownerSession';

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;

	if (path.startsWith("/api/") || path === "/login") {
		return NextResponse.next();
	}

	let authorized = false;
	try {
		authorized = await verifyOwnerSession(request.cookies.get(sessionCookieName())?.value);
	} catch { /* Missing configuration fails closed. */ }
	if (!authorized) {
		const login = new URL('/login', request.url);
		login.searchParams.set('next', path + request.nextUrl.search);
		return NextResponse.redirect(login);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*$).*)"],
};
//
