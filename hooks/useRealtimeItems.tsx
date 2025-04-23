import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/SupaBaseClient"; // Assuming you have a Supabase client setup



export interface Item {
	id: number;
	title: string;
	price: number;
	link: string;
	search_parameter_id: number;
	[key: string]: any;
}

export function useRealtimeItems(searchId?: number) {
	const [items, setItems] = useState<Item[]>([]);

	useEffect(() => {

		const fetchInitial = async () => {
			let query = supabase
				.from("items")
				.select("*")
				.order("price", { ascending: true });

			// Додаємо фільтр, тільки якщо searchId визначений
			if (searchId !== undefined) {
				query = query.eq("search_parameter_id", searchId);
			}

			const { data, error } = await query;

			if (data) {
				setItems(data);
			}
		};

		fetchInitial();

		const channel = supabase
			.channel(`realtime-items-${searchId ? searchId : 'all'}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "items",
					// filter: `search_parameter_id=eq.${searchId}`,
					...(searchId && { filter: `search_parameter_id=eq.${searchId}` }),
				},
				(payload) => {
					setItems((prev) => [payload.new as Item, ...prev]);
					const playNotificationSound = () => {
						const audio = new Audio("/sounds/notification.mp3"); // шлях до файлу в public/
						audio.play().catch(e => console.warn("Can't play sound:", e));
					};
					toast.info(
						<p>
							NEW:{" "}
							<a
								href={(payload.new as Item).link}
								target="_blank"
								rel="noopener noreferrer"
								style={{ color: "#00d084", textDecoration: "underline" }}
							>
								{(payload.new as Item).title}
							</a>
							<br />
							<b>
								{(payload.new as Item).condition === 1000
									? "New"
									: (payload.new as Item).condition === 1500
										? "OpenBox"
										: "Used"}
							</b>
							{" "}
							<span>
								for <b>
									${(payload.new as Item).price}
								</b>
							</span>
							{" "}
							<span style={{ color: 'var(--primary)' }}>
								{(payload.new as Item).shipping_cost > 0
									? `+ ${payload.new.shipping_cost} shipping`
									: ""}
							</span>
							<br />
							<span>
								<b>
									{(payload.new as Item).seller_name}
								</b>
								{' '}
								<span>
									{payload.new.feedback_percentage}%{'('}{payload.new.feedback_score}{')'}
								</span>
							</span>
						</p>,
						{
							className: "custom-toast",
							progressClassName: "Toastify__progress-bar",
						}
					);
					playNotificationSound();
				}
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "items",
					// filter: `search_parameter_id=eq.${searchId}`,
					...(searchId && { filter: `search_parameter_id=eq.${searchId}` }),
				},
				(payload) => {
					setItems((prev) =>
						prev.map((item) =>
							item.id === payload.new.id ? { ...item, ...payload.new } : item
						)
					);
				}
			)
			.on(
				"postgres_changes",
				{
					event: "DELETE",
					schema: "public",
					table: "items",
					// filter: `search_parameter_id=eq.${searchId}`,
					...(searchId && { filter: `search_parameter_id=eq.${searchId}` }),
				},
				(payload) => {
					setItems((prev) =>
						prev.filter((item) => item.id !== Number(payload.old.id))
					);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [searchId]);

	return items;
}
