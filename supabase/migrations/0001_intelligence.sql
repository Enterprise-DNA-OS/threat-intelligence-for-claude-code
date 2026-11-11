create table reports (
 id uuid primary key default gen_random_uuid(), ref text unique not null check (length(trim(ref))>0),
 title text not null check(length(trim(title))>0), source_url text not null unique check(source_url ~ '^https?://'),
 publisher text not null default '', published_on date not null default current_date,
 tlp text check(tlp in ('TLP:CLEAR','TLP:GREEN','TLP:AMBER','TLP:AMBER+STRICT','TLP:RED')),
 restrictions text not null default '', owner text not null default '', summary text not null default '',
 review_due date not null default current_date, reviewed_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table indicators (
 id uuid primary key default gen_random_uuid(), ref text unique not null,
 kind text not null check(kind in ('ipv4','ipv6','domain','url','sha256','sha1','md5','email')),
 value text not null check(length(trim(value))>0), unique(kind,value),
 status text not null default 'unreviewed' check(status in ('unreviewed','accepted','rejected','retired')),
 confidence integer check(confidence between 0 and 100), expires_on date not null default current_date+30,
 reviewer text not null default '', rationale text not null default '', reviewed_on date,
 check(status='unreviewed' or (length(trim(reviewer))>0 and length(trim(rationale))>0 and reviewed_on is not null)),
 check(status<>'accepted' or confidence is not null),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table report_indicators (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references reports(id), indicator_id uuid not null references indicators(id),
 source_context text not null default '', unique(report_id,indicator_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table requirements (
 id uuid primary key default gen_random_uuid(), ref text unique not null, name text not null,
 question text not null check(length(trim(question))>0), owner text not null default '',
 priority integer not null default 3 check(priority between 1 and 5), review_due date not null,
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table assessments (
 id uuid primary key default gen_random_uuid(), ref text unique not null,
 requirement_id uuid not null references requirements(id), report_id uuid not null references reports(id),
 disposition text not null check(disposition in ('relevant','not-relevant','uncertain')),
 rationale text not null check(length(trim(rationale))>0), reviewer text not null check(length(trim(reviewer))>0),
 reviewed_on date not null default current_date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table actions (
 id uuid primary key default gen_random_uuid(), ref text unique not null, report_id uuid not null references reports(id),
 name text not null, owner text not null default '', due_on date not null,
 status text not null default 'open' check(status in ('open','done','cancelled')),
 evidence text not null default '', check(status='open' or length(trim(evidence))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table notes (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references reports(id),
 author text not null check(length(trim(author))>0), body text not null check(length(trim(body))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit_events (
 id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null,
 operation text not null, before_record jsonb, after_record jsonb, at timestamptz not null default now()
);
create function stamp_change() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function audit_change() returns trigger language plpgsql as $$ begin
 insert into audit_events(entity,record_id,operation,before_record,after_record)
 values(TG_TABLE_NAME,new.id,TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;end $$;
do $$ declare t text; begin
 foreach t in array array['reports','indicators','report_indicators','requirements','assessments','actions','notes'] loop
 execute format('create trigger stamp before update on %I for each row execute function stamp_change()',t);
 execute format('create trigger audit after insert or update on %I for each row execute function audit_change()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
end $$;
alter table audit_events enable row level security;
revoke all on audit_events from public;
create view triage_queue as
 select r.ref,r.title,r.owner,r.tlp,r.review_due,(current_date-r.review_due) as overdue_days,
 (select count(*) from report_indicators ri join indicators i on i.id=ri.indicator_id where ri.report_id=r.id and i.status='unreviewed') as unreviewed
 from reports r where r.reviewed_on is null or r.review_due<=current_date;
create view indicator_register as
 select i.ref,i.kind,i.value,i.status,i.confidence,i.expires_on,i.reviewer,
 (select count(*) from report_indicators ri where ri.indicator_id=i.id) as sources
 from indicators i;
create view intelligence_gaps as
 select q.ref,q.name,q.owner,q.priority,q.review_due,
 count(a.id) as assessments,count(a.id) filter(where a.disposition='relevant') as relevant,
 max(a.reviewed_on) as last_assessed
 from requirements q left join assessments a on a.requirement_id=q.id
 where q.status='open' group by q.id;
create view action_register as
 select a.ref,a.name,r.ref as report,a.owner,a.due_on,a.status,a.evidence,
 case when a.status='open' then greatest(0,current_date-a.due_on) else 0 end as overdue_days
 from actions a join reports r on r.id=a.report_id;
create view compliance_findings as
 select ref,'SOURCE-LABEL'::text as rule,'Source sharing label is missing'::text as finding from reports where tlp is null
 union all select ref,'SOURCE-OWNER','No accountable analyst' from reports where trim(owner)=''
 union all select ref,'SOURCE-REVIEW','Source review is overdue' from reports where review_due<current_date
 union all select ref,'INDICATOR-EXPIRY','Accepted indicator has expired' from indicators where status='accepted' and expires_on<current_date
 union all select i.ref,'INDICATOR-SOURCE','Indicator has no linked source' from indicators i where not exists(select 1 from report_indicators ri where ri.indicator_id=i.id)
 union all select ref,'ACTION-OWNER','Open action has no owner' from actions where status='open' and trim(owner)=''
 union all select ref,'REQUIREMENT-OWNER','Open intelligence question has no owner' from requirements where status='open' and trim(owner)='';
