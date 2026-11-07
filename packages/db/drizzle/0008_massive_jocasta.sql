CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_conversations_id_owner_unique" UNIQUE("id","owner_id")
);
--> statement-breakpoint
CREATE TABLE "assistant_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message" text NOT NULL,
	"response" jsonb,
	CONSTRAINT "assistant_turns_message_bounded" CHECK (length(trim("assistant_turns"."message")) between 1 and 8000 and octet_length("assistant_turns"."message") <= 16000),
	CONSTRAINT "assistant_turns_response_bounded" CHECK ("assistant_turns"."response" is null or (jsonb_typeof("assistant_turns"."response") = 'object' and octet_length("assistant_turns"."response"::text) <= 262144))
);
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_turns" ADD CONSTRAINT "assistant_turns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_turns" ADD CONSTRAINT "assistant_turns_owner_conversation_fk" FOREIGN KEY ("conversation_id","owner_id") REFERENCES "public"."assistant_conversations"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_conversations_owner_idx" ON "assistant_conversations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "assistant_turns_owner_time_idx" ON "assistant_turns" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_turns_conversation_time_idx" ON "assistant_turns" USING btree ("conversation_id","created_at");
--> statement-breakpoint
-- Private history is readable only under the caller JWT. Direct mutations are
-- revoked: narrow RPCs serialize quota admission and complete a turn once.
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY assistant_conversations_owner_read ON public.assistant_conversations FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY assistant_turns_owner_read ON public.assistant_turns FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);
REVOKE ALL ON public.assistant_conversations, public.assistant_turns FROM anon, authenticated;
GRANT SELECT ON public.assistant_conversations, public.assistant_turns TO authenticated;

-- SECURITY DEFINER is deliberately limited to this two-table conversation
-- store. It never reads operational records and never accepts an owner ID.
CREATE FUNCTION public.begin_assistant_turn(conversation_id uuid, user_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE caller uuid := auth.uid(); cid uuid := conversation_id; tid uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'assistant_unauthorized'; END IF;
  IF user_message IS NULL OR length(trim(user_message)) NOT BETWEEN 1 AND 8000 OR octet_length(user_message) > 16000 THEN RAISE EXCEPTION 'assistant_invalid_message'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('altair-assistant:' || caller::text, 0));
  IF cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.assistant_conversations c WHERE c.id = cid AND c.owner_id = caller) THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF (SELECT count(*) FROM public.assistant_turns t WHERE t.owner_id = caller AND t.created_at > now() - interval '1 minute') >= 6
    OR (SELECT count(*) FROM public.assistant_turns t WHERE t.owner_id = caller AND t.created_at > now() - interval '24 hours') >= 30 THEN RAISE EXCEPTION 'assistant_rate_limited'; END IF;
  IF cid IS NULL THEN
    IF (SELECT count(*) FROM public.assistant_conversations c WHERE c.owner_id = caller) >= 100 THEN RAISE EXCEPTION 'assistant_conversation_limit'; END IF;
    INSERT INTO public.assistant_conversations(owner_id) VALUES (caller) RETURNING id INTO cid;
  ELSIF (SELECT count(*) FROM public.assistant_turns t WHERE t.conversation_id = cid AND t.owner_id = caller) >= 200 THEN RAISE EXCEPTION 'assistant_conversation_limit'; END IF;
  INSERT INTO public.assistant_turns(owner_id,conversation_id,message) VALUES(caller,cid,user_message) RETURNING id INTO tid;
  RETURN jsonb_build_object('conversationId',cid,'turnId',tid);
END $$;
REVOKE ALL ON FUNCTION public.begin_assistant_turn(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_assistant_turn(uuid,text) TO authenticated;

CREATE FUNCTION public.finish_assistant_turn(turn_id uuid, result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE caller uuid := auth.uid(); previous jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'assistant_unauthorized'; END IF;
  SELECT t.response INTO previous FROM public.assistant_turns t WHERE t.id = turn_id AND t.owner_id = caller FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF previous IS NOT NULL THEN RAISE EXCEPTION 'assistant_turn_completed'; END IF;
  IF result IS NULL OR jsonb_typeof(result) <> 'object' OR octet_length(result::text) > 262144 THEN RAISE EXCEPTION 'assistant_invalid_result'; END IF;
  UPDATE public.assistant_turns SET response = result, updated_at = now() WHERE id = turn_id AND owner_id = caller;
  RETURN jsonb_build_object('id',turn_id);
END $$;
REVOKE ALL ON FUNCTION public.finish_assistant_turn(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_assistant_turn(uuid,jsonb) TO authenticated;
