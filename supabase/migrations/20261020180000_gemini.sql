-- Edge Function gemini (R5; ADR 0009, 0010).

-- Contexto da Frase: a frase anterior e a seguinte, que o aparelho grava com a parte local da Carta
-- e a função manda ao Gemini só como contexto.
alter table public.batch_items
  add column sentence_before text,
  add column sentence_after text;

-- Teto diário: soma n chamadas ao dia de hoje (UTC) e devolve o total, ou null sem somar se passar
-- do teto. Atômico: duas gerações ao mesmo tempo não furam o teto.
create function public.gemini_reservar(p_user uuid, p_n integer, p_teto integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  insert into public.gemini_usage as u (user_id, day, calls)
  values (p_user, (now() at time zone 'utc')::date, 0)
  on conflict (user_id, day) do nothing;

  update public.gemini_usage as u
     set calls = u.calls + p_n, modified_at = now()
   where u.user_id = p_user
     and u.day = (now() at time zone 'utc')::date
     and u.calls + p_n <= p_teto
  returning u.calls into total;

  return total;
end;
$$;

-- Trava da Carta (ADR 0010): pendente ou erro viram gerando. Uma trava com mais de 5 minutos é de
-- uma geração que morreu e pode ser retomada. Devolve a Carta travada, ou nada se outra chamada já
-- está gerando (ou a Carta não existe). modified_at nunca anda para trás (LWW do touch_row).
create function public.gemini_travar(p_user uuid, p_id uuid)
returns setof public.batch_items
language sql
security definer
set search_path = ''
as $$
  update public.batch_items as b
     set state = 'gerando',
         error_reason = null,
         modified_at = greatest(now(), b.modified_at + interval '1 millisecond')
   where b.user_id = p_user
     and b.id = p_id
     and b.deleted_at is null
     and (
       b.state in ('pendente', 'erro')
       or (b.state = 'gerando' and b.updated_at < now() - interval '5 minutes')
     )
  returning b.*;
$$;

-- Só a Edge Function (service_role) chama.
revoke execute on function public.gemini_reservar(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.gemini_travar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gemini_reservar(uuid, integer, integer) to service_role;
grant execute on function public.gemini_travar(uuid, uuid) to service_role;
