import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const authCookie = request.cookies.get(process.env.PASSWORD_COOKIE_NAME!);
	const path = request.nextUrl.pathname;

	if (path.startsWith("/api/") || path === "/login") {
		return NextResponse.next();
	}

	if (!authCookie || authCookie.value !== "true") {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
