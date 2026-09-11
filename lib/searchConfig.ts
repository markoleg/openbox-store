/** The search configuration off the form, in the shape the save RPC accepts. */
export function searchConfigFromForm(formData: FormData): Record<string, unknown> {
	const text = (name: string) => formData.get(name)?.toString() ?? '';
	const aspects: string[] = [];
	let index = 0;
	while (formData.has(`aspect_key_${index}`)) {
		const key = text(`aspect_key_${index}`).trim();
		const value = text(`aspect_value_${index}`).trim();
		if (key && value) aspects.push(`${key}:${value}`);
		index++;
	}
	const config: Record<string, unknown> = {
		categoryid: text('categoryid'), keywords: text('keywords'), brand: text('brand'), model: text('model'),
		condition: text('condition'), minprice: text('minprice'), maxprice: text('maxprice'), rate: text('rate'),
		seller: text('seller'), more_aspects: aspects,
	};
	// One hidden JSON field rather than indexed inputs: a variant rule is a
	// nested object. A malformed value must not wipe a working config, so it is
	// left out and the server keeps the stored filters.
	const raw = formData.get('filters');
	if (typeof raw === 'string' && raw !== '') {
		try {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config.filters = parsed;
		} catch (e) {
			console.error('Ignoring unparsable filters payload:', e);
		}
	}
	return config;
}

/** Banned links typed into the form (indexed inputs), trimmed and deduplicated. */
export function bannedLinksFromForm(formData: FormData): string[] {
	const links: string[] = [];
	let index = 0;
	while (formData.has(`banned_link_${index}`)) {
		const link = formData.get(`banned_link_${index}`)?.toString().trim();
		if (link) links.push(link);
		index++;
	}
	return Array.from(new Set(links));
}
