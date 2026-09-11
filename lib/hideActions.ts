/** "до 11.09" or "до подешевшання" - which mode a hidden lot is in. */
export function describeHide(hiddenUntil?: string | null): string {
	if (!hiddenUntil) return "до подешевшання";
	const date = new Date(hiddenUntil);
	if (Number.isNaN(date.getTime())) return "до подешевшання";
	return `до ${date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}`;
}
