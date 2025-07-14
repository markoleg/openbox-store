-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.items (
  liked boolean DEFAULT false,
  search_parameter_id integer,
  title text,
  price real,
  link text UNIQUE,
  seller_name text,
  feedback_percentage real,
  feedback_score integer,
  shipping_cost real,
  image_url text,
  hidden boolean,
  id integer NOT NULL DEFAULT nextval('items_id_seq'::regclass),
  condition text,
  model text,
  more_aspects ARRAY,
  total_price real,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_link_fkey FOREIGN KEY (link) REFERENCES public.scraped_links(link),
  CONSTRAINT items_search_parameter_id_fkey FOREIGN KEY (search_parameter_id) REFERENCES public.searchparameters(id)
);
CREATE TABLE public.scraped_links (
  description text,
  favorite boolean DEFAULT false,
  desired_price real,
  link text NOT NULL,
  first_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  count integer DEFAULT 1,
  CONSTRAINT scraped_links_pkey PRIMARY KEY (link)
);
CREATE TABLE public.searchparameters (
  categoryid text,
  keywords text,
  model text,
  condition integer,
  minprice real,
  id integer NOT NULL DEFAULT nextval('searchparameters_id_seq'::regclass),
  maxprice real,
  brand text,
  rate integer,
  banned ARRAY,
  seller text,
  more_aspects ARRAY,
  CONSTRAINT searchparameters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.zzk_keyword_stats (
  keyword text NOT NULL,
  usage_count integer DEFAULT 0,
  CONSTRAINT zzk_keyword_stats_pkey PRIMARY KEY (keyword)
);
CREATE TABLE public.zzk_messages (
  sender_id bigint NOT NULL,
  group_id bigint,
  message_text text NOT NULL,
  keywords ARRAY,
  timestamp timestamp without time zone NOT NULL,
  id integer NOT NULL DEFAULT nextval('zzk_messages_id_seq'::regclass),
  rounded_hour timestamp without time zone DEFAULT date_trunc('hour'::text, "timestamp"),
  group_name text,
  CONSTRAINT zzk_messages_pkey PRIMARY KEY (id),
  CONSTRAINT zzk_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.zzk_senders(sender_id)
);
CREATE TABLE public.zzk_params (
  stat_keys ARRAY,
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  keywords ARRAY,
  minuskeys ARRAY,
  minususers ARRAY,
  CONSTRAINT zzk_params_pkey PRIMARY KEY (id)
);
CREATE TABLE public.zzk_senders (
  sender_id bigint NOT NULL,
  username text,
  first_name text,
  last_name text,
  status text,
  message_count integer DEFAULT 0,
  CONSTRAINT zzk_senders_pkey PRIMARY KEY (sender_id)
);
CREATE TABLE public.zzk_user_keyword_stats (
  sender_id bigint NOT NULL,
  keyword text NOT NULL,
  usage_count integer DEFAULT 0,
  CONSTRAINT zzk_user_keyword_stats_pkey PRIMARY KEY (sender_id, keyword),
  CONSTRAINT zzk_user_keyword_stats_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.zzk_senders(sender_id)
);



<!-- functions -->
global_keyword_stats_by_day:
  select
    unnest(keywords) as keyword,
    date_trunc('day', timestamp)::date as day,
    count(*) as count
  from zzk_messages
  where timestamp between from_date and to_date
  group by keyword, day
  order by day

user_keyword_stats_by_day:
  SELECT
    m.sender_id,
    s.username,
    unnest(m.keywords) AS keyword,
    date_trunc('day', m.timestamp)::date AS day,
    COUNT(*) AS count
  FROM zzk_messages m
  JOIN zzk_senders s ON s.sender_id = m.sender_id
  WHERE m.sender_id = sender_id_input
    AND m.timestamp BETWEEN from_date AND to_date
  GROUP BY m.sender_id, s.username, keyword, day
  ORDER BY day
