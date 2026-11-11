do $$ begin
if exists(select 1 from reports where ref='R-101') then return; end if;
insert into reports(ref,title,source_url,publisher,published_on,tlp,restrictions,owner,summary,review_due,reviewed_on) values
 ('R-101','Fictional supplier phishing exercise','https://example.org/exercises/supplier','Demo CERT',current_date-8,'TLP:AMBER','Need-to-know within organisation and clients','Mara','Synthetic exercise. No real attack or attribution is asserted.',current_date-2,null),
 ('R-102','Fictional gateway advisory','https://example.org/exercises/gateway','Demo Research',current_date-3,'TLP:CLEAR','','Alex','Synthetic gateway investigation for briefing practice.',current_date+5,current_date-1),
 ('R-103','Fictional partner report','https://example.org/exercises/partner','Demo Partner',current_date-10,null,'Confirm original sharing permission','','Unclassified exercise evidence, held from briefing drafts.',current_date-1,null);
insert into indicators(ref,kind,value,status,confidence,expires_on,reviewer,rationale,reviewed_on) values
 ('I-101','domain','supplier-login.example','unreviewed',null,current_date+14,'','',null),
 ('I-102','ipv4','192.0.2.20','accepted',80,current_date-1,'Mara','Fictional exercise evidence accepted for review practice',current_date-10),
 ('I-103','domain','gateway.example','accepted',70,current_date+5,'Alex','Synthetic report corroborated in the exercise',current_date-2),
 ('I-104','ipv4','198.51.100.10','unreviewed',null,current_date+30,'','',null);
insert into report_indicators(report_id,indicator_id,source_context)
select r.id,i.id,'Fictional exercise context' from reports r,indicators i
where (r.ref='R-101' and i.ref in ('I-101','I-102')) or (r.ref='R-102' and i.ref in ('I-102','I-103'));
insert into requirements(ref,name,question,owner,priority,review_due) values
 ('Q-101','Supplier exposure','Which reported supplier campaigns require an internal check?','Mara',1,current_date+2),
 ('Q-102','Gateway exposure','Which gateway reports have a documented relevance decision?','Alex',2,current_date-1),
 ('Q-103','Remote access','What evidence covers our remote access intelligence question?','Alex',1,current_date+3);
insert into assessments(ref,requirement_id,report_id,disposition,rationale,reviewer,reviewed_on)
select 'AS-101',q.id,r.id,'relevant','Exercise gateway matches the scenario technology list','Alex',current_date-2
from requirements q,reports r where q.ref='Q-102' and r.ref='R-102';
insert into actions(ref,report_id,name,owner,due_on,status,evidence)
select 'A-101',id,'Confirm supplier exposure with the system owner','Mara',current_date-2,'open','' from reports where ref='R-101';
insert into actions(ref,report_id,name,owner,due_on,status,evidence)
select 'A-102',id,'Recheck expired exercise indicator','',current_date-1,'open','' from reports where ref='R-101';
insert into actions(ref,report_id,name,owner,due_on,status,evidence)
select 'A-103',id,'Record gateway owner assessment','Alex',current_date+2,'done','Exercise note confirmed no deployed gateway in scope' from reports where ref='R-102';
insert into notes(report_id,author,body) select id,'Mara','Synthetic training data only. Confirm facts before making a real decision.' from reports where ref='R-101';
end $$;
