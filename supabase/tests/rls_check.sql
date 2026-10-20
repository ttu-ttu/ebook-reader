-- Verificação manual do RLS: outro usuário não lê os seus dados.
-- Colar no SQL Editor do painel do Supabase depois de criar a sua conta. O script cria uma linha de
-- teste em books para o primeiro usuário cadastrado (você), conta como você e como um usuário
-- qualquer, e apaga a linha. Esperado no resultado: dono = 1 e outro = 0.

create temporary table rls_result (dono bigint, outro bigint);
grant all on rls_result to authenticated;

insert into public.books (user_id, id, title, modified_at)
select id, 'rls-check', 'rls-check', now() from auth.users order by created_at limit 1;

-- Como você.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from auth.users order by created_at limit 1), 'role', 'authenticated'
  )::text,
  false
);
set role authenticated;
insert into rls_result select count(*), null from public.books where id = 'rls-check';
reset role;

-- Como um usuário que não existe.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
  false
);
set role authenticated;
update rls_result set outro = (select count(*) from public.books where id = 'rls-check');
reset role;

delete from public.books where id = 'rls-check';
select * from rls_result;
