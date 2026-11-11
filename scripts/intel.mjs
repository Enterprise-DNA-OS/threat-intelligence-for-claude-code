#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv,pick } from './lib/csv.mjs';
import { table as textTable } from './lib/format.mjs';
import { page,table,record,writeOut,esc } from './lib/render.mjs';

export const reads={
 reports:'select ref,title,publisher,tlp,owner,review_due,reviewed_on from reports order by ref',
 indicators:'select * from indicator_register order by ref',
 'morning-triage':'select * from triage_queue order by review_due,ref',
 'unreviewed-indicators':"select * from indicator_register where status='unreviewed' order by expires_on,ref",
 'expiring-indicators':"select * from indicator_register where status='accepted' and expires_on<=current_date+7 order by expires_on,ref",
 'source-overlap':"select * from indicator_register where sources>1 order by sources desc,ref",
 requirements:'select ref,name,question,owner,priority,review_due,status from requirements order by priority,ref',
 'collection-gaps':'select * from intelligence_gaps where relevant=0 or review_due<=current_date order by priority,ref',
 assessments:'select a.ref,q.ref as requirement,r.ref as report,a.disposition,a.reviewer,a.reviewed_on,a.rationale from assessments a join requirements q on q.id=a.requirement_id join reports r on r.id=a.report_id order by a.ref',
 actions:'select * from action_register order by due_on,ref',
 'overdue-actions':"select * from action_register where status='open' and due_on<current_date order by due_on,ref",
 compliance:'select * from compliance_findings order by ref,rule',
 notes:'select r.ref as report,n.author,n.body,n.created_at from notes n join reports r on r.id=n.report_id order by n.created_at',
 audit:'select entity,record_id,operation,at from audit_events order by at desc,id limit 100',
 'source-coverage':'select r.ref,r.title,r.tlp,count(ri.id) as indicators,count(ri.id) filter(where i.status=\'accepted\') as accepted from reports r left join report_indicators ri on ri.report_id=r.id left join indicators i on i.id=ri.indicator_id group by r.id order by r.ref',
 attention:`select 'Report review' as category,ref,title as item,owner,review_due::text as due from triage_queue
 union all select 'Indicator expiry',ref,value,reviewer,expires_on::text from indicators where status='accepted' and expires_on<=current_date+7
 union all select 'Overdue action',ref,name,owner,due_on::text from actions where status='open' and due_on<current_date
 union all select 'Intelligence gap',ref,name,owner,review_due::text from intelligence_gaps where relevant=0
 order by category,ref`
};
const entities={
 report:{table:'reports',name:'title',fields:['ref','title','source_url','publisher','published_on','tlp','restrictions','owner','summary','review_due','reviewed_on']},
 indicator:{table:'indicators',name:'value',fields:['ref','kind','value','expires_on']},
 requirement:{table:'requirements',name:'name',fields:['ref','name','question','owner','priority','review_due','status']},
 action:{table:'actions',name:'name',fields:['ref','report','name','owner','due_on']}
};
const labels=['TLP:CLEAR','TLP:GREEN','TLP:AMBER','TLP:AMBER+STRICT','TLP:RED'];
function parse(args){const positional=[],o={};for(const a of args){if(!a.startsWith('--')){positional.push(a);continue;}const at=a.indexOf('=');const k=(at<0?a.slice(2):a.slice(2,at)).replaceAll('-','_');if(k in o)throw Error('Duplicate option '+k);o[k]=at<0?true:a.slice(at+1);}delete o.json;return {p:positional,o};}
function required(o,...keys){for(const k of keys)if(typeof o[k]!=='string'||!o[k].trim())throw Error('Required --'+k.replaceAll('_','-'));}
function only(o,keys){for(const k of Object.keys(o))if(!keys.includes(k))throw Error('Unknown option --'+k.replaceAll('_','-'));}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Invalid calendar date: '+v);return v;}
function url(v){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))throw Error();return v;}catch{throw Error('Expected http or https source URL');}}
function label(v){if(!labels.includes(v))throw Error('Unknown TLP label');return v;}
function normalized(kind,value){
 const aliases={'ipv4-addr':'ipv4','ipv6-addr':'ipv6','domain-name':'domain','email-addr':'email','sha-256':'sha256','sha-1':'sha1','ip':'ipv4','hostname':'domain'};
 kind=aliases[kind.toLowerCase()]||kind.toLowerCase();value=value.trim().replaceAll('[.]','.').replace(/^hxxps:/i,'https:').replace(/^hxxp:/i,'http:');
 if(['domain','md5','sha1','sha256'].includes(kind))value=value.toLowerCase();
 if(kind==='ipv4'&&isIP(value)!==4||kind==='ipv6'&&isIP(value)!==6)throw Error('Invalid IP address');
 if(kind==='domain'&&(!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)||value.split('.').some(x=>x.length>63)))throw Error('Invalid domain');
 if(kind==='url')url(value);
 if(kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Invalid email indicator');
 const lengths={md5:32,sha1:40,sha256:64};if(lengths[kind]&&!new RegExp('^[a-f0-9]{'+lengths[kind]+'}$').test(value))throw Error('Invalid hash');
 if(!['ipv4','ipv6','domain','url','email',...Object.keys(lengths)].includes(kind))throw Error('Unsupported indicator type: '+kind);
 return {kind,value};
}
async function tx(db,fn,dry=false){await db.exec('BEGIN');try{const out=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return out;}catch(e){await db.exec('ROLLBACK');throw e;}}
export async function resolve(db,entity,needle){
 const e=entities[entity];if(!e)throw Error('Unknown entity '+entity);if(!needle)throw Error('Choose a '+entity);
 const rows=await db.query(`select * from ${e.table} where lower(ref)=lower($1) or lower(${e.name})=lower($1) or left(id::text,length($1))=lower($1) order by ref`,[needle]);
 if(rows.length===1)return rows[0];if(rows.length>1)throw Error('Ambiguous '+entity+': '+rows.map(x=>x.ref+' '+x[e.name]).join('; '));
 const partial=await db.query(`select * from ${e.table} where strpos(lower(${e.name}),lower($1))>0 order by ref`,[needle]);
 if(partial.length===1)return partial[0];if(!partial.length)throw Error('No '+entity+' matches '+needle);
 throw Error('Ambiguous '+entity+': '+partial.map(x=>x.ref+' '+x[e.name]).join('; '));
}
async function mutate(db,cmd,entity,needle,o){
 const e=entities[entity];if(!e)throw Error('Unknown entity '+entity);only(o,e.fields);const data={...o};
 for(const k of Object.keys(data)){if(k.endsWith('_on')||k==='review_due')date(data[k]);if(typeof data[k]!=='string')throw Error('Option requires a value: '+k);}
 if(data.source_url)url(data.source_url);if(data.tlp)label(data.tlp);
 if(data.report){data.report_id=(await resolve(db,'report',data.report)).id;delete data.report;}
 let old;if(cmd==='set')old=await resolve(db,entity,needle);
 if(entity==='indicator'){
  if(cmd==='add'){required(data,'kind','value');Object.assign(data,normalized(data.kind,data.value));}
  else if(data.kind||data.value)throw Error('Indicator identities are immutable; retire it and add a corrected indicator');
 }
 if(cmd==='add'){required(data,'ref');const keys=Object.keys(data);return db.query(`insert into ${e.table} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(data));}
 if(!Object.keys(data).length)throw Error('No changes supplied');if(data.ref&&data.ref!==old.ref)throw Error('References are immutable');
 const keys=Object.keys(data);return db.query(`update ${e.table} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(data),old.id]);
}
async function importFeedly(db,o){
 only(o,['file','source','title','tlp','owner','mapping','dry_run']);required(o,'file','source','title','tlp','owner');url(o.source);label(o.tlp);
 const rows=parseCsv(fs.readFileSync(o.file,'utf8'));if(!rows.length)throw Error('Import file is empty');
 const mapping=o.mapping?JSON.parse(fs.readFileSync(o.mapping,'utf8')):{};only(mapping,['kind','value','context']);
 for(const [k,v] of Object.entries(mapping))if(typeof v!=='string'||!Object.hasOwn(rows[0],v))throw Error('Mapping header missing for '+k);
 const get=(r,k,aliases)=>mapping[k]?r[mapping[k]]:pick(r,...aliases);
 const parsed=rows.map((r,i)=>{try{return {...normalized(get(r,'kind',['Type','Indicator Type','kind']),get(r,'value',['Indicator','Value','IoC'])),context:get(r,'context',['Context','Description','source_context'])};}catch(e){throw Error('CSV row '+(i+2)+': '+e.message);}});
 if(new Set(parsed.map(x=>x.kind+'|'+x.value)).size!==parsed.length)throw Error('Duplicate indicator in import');
 return tx(db,async()=>{
  const old=await db.query('select * from reports where source_url=$1',[o.source]);
  if(old.length&&(old[0].tlp!==o.tlp||old[0].title!==o.title))throw Error('Existing source title or sharing label differs; review it explicitly before re-import');
  const report=old[0]||(await db.query('insert into reports(ref,title,source_url,tlp,owner,publisher) values($1,$2,$3,$4,$5,$6) returning *',['F-'+createHash('sha256').update(o.source).digest('hex').slice(0,12),o.title,o.source,o.tlp,o.owner,'Imported Feedly export']))[0];
  let added=0;
  for(const x of parsed){
   let indicator=(await db.query('select * from indicators where kind=$1 and value=$2',[x.kind,x.value]))[0];
   if(!indicator){indicator=(await db.query('insert into indicators(ref,kind,value) values($1,$2,$3) returning *',['I-'+createHash('sha256').update(x.kind+'|'+x.value).digest('hex').slice(0,12),x.kind,x.value]))[0];added++;}
   await db.query('insert into report_indicators(report_id,indicator_id,source_context) values($1,$2,$3) on conflict(report_id,indicator_id) do update set source_context=excluded.source_context',[report.id,indicator.id,x.context]);
  }
  return {report:report.ref,rows:parsed.length,new_indicators:added,dry_run:!!o.dry_run,analyst_decisions:'preserved'};
 },!!o.dry_run);
}
export async function dossier(db,ref){const r=await resolve(db,'report',ref);return {report:r,indicators:await db.query('select i.ref,i.kind,i.value,i.status,i.confidence,i.expires_on,ri.source_context from report_indicators ri join indicators i on i.id=ri.indicator_id where ri.report_id=$1 order by i.ref',[r.id]),assessments:await db.query('select q.ref as requirement,q.question,a.disposition,a.rationale,a.reviewer from assessments a join requirements q on q.id=a.requirement_id where a.report_id=$1 order by a.ref',[r.id]),actions:await db.query('select ref,name,owner,due_on,status,evidence from actions where report_id=$1 order by ref',[r.id]),notes:await db.query('select author,body,created_at from notes where report_id=$1 order by created_at',[r.id])};}
export function dossierHtml(d){
 const r=d.report;const marking=r.tlp||'UNCLASSIFIED: DO NOT DISTRIBUTE';
 const sections=[{title:marking,note:'Operator working copy. Source restrictions: '+(r.restrictions||'Apply the source sharing label.'),html:record(r,['ref','title','publisher','source_url','published_on','owner','summary','review_due'])},...['indicators','assessments','actions','notes'].map(k=>({title:k,html:table(d[k])}))];
 return page({title:'Intelligence assessment dossier',subtitle:'DRAFT | '+marking,sections}).replace('</style>','\n.tlp-mark{background:#0b0c18;color:#fff;padding:10px;font-size:16px;text-align:right}@media print{.tlp-top{position:fixed;top:0;left:0;right:0}.tlp-bottom{position:fixed;bottom:0;left:0;right:0}@page{margin:22mm 10mm}header{margin-top:12mm}footer{margin-bottom:12mm}}\n</style>').replace('<body>','<body><div class="tlp-mark tlp-top">'+esc(marking)+'</div>').replace('</body>','<div class="tlp-mark tlp-bottom">'+esc(marking)+'</div></body>');
}
const help=`Reads: ${Object.keys(reads).join(', ')}
card <report|indicator|requirement|action> <reference-or-name>
report-pack <report> | weekly-review
add <report|indicator|requirement|action> --ref=... --field=value
set <entity> <reference-or-name> --field=value (hyphenated field names)
link <report> <indicator> [--context=...]
review-indicator <indicator> --status=accepted|rejected|retired --confidence=0..100 --reviewer=... --rationale=... --expires-on=YYYY-MM-DD
assess <requirement> <report> --disposition=relevant|not-relevant|uncertain --reviewer=... --rationale=...
complete-action <action> --evidence=... [--status=done|cancelled]
log <report> --author=... --text=...
import feedly --file=... --source=https://... --title=... --tlp=TLP:CLEAR --owner=... [--mapping=...] [--dry-run]
export [--dir=exports] | restore --file=.../snapshot.json (empty database only)
draft-brief <report> | draft-weekly-review
Every route supports --json. No command fetches, sends, scans or blocks a system.`;
export async function execute(db,args){
 const {p,o}=parse(args);const [cmd='help',a,b]=p;
 if(cmd==='help'){only(o,[]);return {help};}
 if(reads[cmd]){only(o,[]);return db.query(reads[cmd]);}
 if(cmd==='card'){only(o,[]);return [await resolve(db,a,b)];}
 if(cmd==='report-pack'){only(o,[]);return dossier(db,a);}
 if(cmd==='weekly-review'){only(o,[]);return {triage:await db.query(reads['morning-triage']),gaps:await db.query(reads['collection-gaps']),actions:await db.query(reads['overdue-actions'])};}
 if(cmd==='add'||cmd==='set')return tx(db,()=>mutate(db,cmd,a,b,o));
 if(cmd==='link'){only(o,['context']);const r=await resolve(db,'report',a),i=await resolve(db,'indicator',b);return db.query('insert into report_indicators(report_id,indicator_id,source_context) values($1,$2,$3) on conflict(report_id,indicator_id) do update set source_context=excluded.source_context returning *',[r.id,i.id,o.context||'']);}
 if(cmd==='review-indicator'){
  only(o,['status','confidence','reviewer','rationale','expires_on']);required(o,'status','reviewer','rationale','expires_on');date(o.expires_on);
  if(!['accepted','rejected','retired'].includes(o.status))throw Error('Choose accepted, rejected or retired');
  const n=o.confidence===undefined?null:Number(o.confidence);if(n!==null&&(!Number.isInteger(n)||n<0||n>100))throw Error('Confidence must be 0..100');
  const i=await resolve(db,'indicator',a);
  if(o.status==='accepted'){
   if(n===null)throw Error('Accepted indicators need confidence');
   const today=(await db.query('select current_date::text today'))[0].today;if(o.expires_on<today)throw Error('Cannot accept an expired indicator');
   const sources=await db.query('select r.* from reports r join report_indicators ri on ri.report_id=r.id where ri.indicator_id=$1',[i.id]);if(!sources.length||sources.some(x=>!x.tlp))throw Error('Accepted indicators need sources with known sharing labels');
  }
  return db.query('update indicators set status=$1,confidence=$2,reviewer=$3,rationale=$4,expires_on=$5,reviewed_on=current_date where id=$6 returning *',[o.status,n,o.reviewer,o.rationale,o.expires_on,i.id]);
 }
 if(cmd==='assess'){
  only(o,['disposition','reviewer','rationale']);required(o,'disposition','reviewer','rationale');const q=await resolve(db,'requirement',a),r=await resolve(db,'report',b);
  return db.query('insert into assessments(ref,requirement_id,report_id,disposition,reviewer,rationale) values($1,$2,$3,$4,$5,$6) returning *',['AS-'+randomUUID().slice(0,12),q.id,r.id,o.disposition,o.reviewer,o.rationale]);
 }
 if(cmd==='complete-action'){only(o,['evidence','status']);required(o,'evidence');const action=await resolve(db,'action',a);const status=o.status||'done';if(!['done','cancelled'].includes(status))throw Error('Choose done or cancelled');return db.query('update actions set status=$1,evidence=$2 where id=$3 returning *',[status,o.evidence,action.id]);}
 if(cmd==='log'){only(o,['author','text']);required(o,'author','text');const r=await resolve(db,'report',a);return db.query('insert into notes(report_id,author,body) values($1,$2,$3) returning *',[r.id,o.author,o.text]);}
 if(cmd==='import'){if(a!=='feedly')throw Error('Supported import: feedly');return importFeedly(db,o);}
 if(cmd==='export'){
  only(o,['dir']);return tx(db,async()=>{const snapshot={version:1,exported_at:new Date().toISOString(),records:{}};for(const name of ['reports','indicators','requirements','report_indicators','assessments','actions','notes','audit_events'])snapshot.records[name]=await db.query('select * from '+name+' order by id');
   const dir=path.resolve(REPO_ROOT,o.dir||'exports');fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const filename=path.join(dir,'snapshot.json');fs.writeFileSync(filename,JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
   for(const [name,rows] of Object.entries(snapshot.records)){const columns=Object.keys(rows[0]||{});const quote=v=>'"'+String(v===null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';fs.writeFileSync(path.join(dir,name+'.csv'),[columns.map(quote).join(','),...rows.map(row=>columns.map(k=>quote(row[k])).join(','))].join('\r\n')+'\r\n',{mode:0o600});}
   return {file:filename,records:Object.fromEntries(Object.entries(snapshot.records).map(([k,v])=>[k,v.length])),warning:'Private operator backup, not a sharing export. CSV cells are raw data; do not execute spreadsheet formulas.'};});
 }
 if(cmd==='restore'){
  only(o,['file']);required(o,'file');const s=JSON.parse(fs.readFileSync(o.file,'utf8'));const names=['reports','indicators','requirements','report_indicators','assessments','actions','notes','audit_events'];
  if(s.version!==1||!s.records||Object.keys(s.records).length!==names.length||names.some(n=>!Array.isArray(s.records[n])))throw Error('Invalid snapshot');
  return tx(db,async()=>{for(const name of names)if((await db.query('select count(*) n from '+name))[0].n!=0)throw Error('Restore requires an empty database');
   for(const name of names){if(name==='audit_events')await db.exec('delete from audit_events');
    const allowed=(await db.query('select column_name from information_schema.columns where table_schema=\'public\' and table_name=$1',[name])).map(x=>x.column_name);
    for(const row of s.records[name]){const keys=Object.keys(row);if(!keys.length||keys.some(k=>!allowed.includes(k)))throw Error('Invalid snapshot columns');await db.query(`insert into ${name} (${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v));}
   }return {restored:Object.fromEntries(names.map(n=>[n,s.records[n].length]))};});
 }
 if(cmd==='draft-brief'){only(o,[]);const d=await dossier(db,a);if(!d.report.tlp||d.report.tlp==='TLP:RED')throw Error('Brief held: unknown or recipient-restricted source. Review source permissions first.');if(d.report.restrictions.trim())throw Error('Brief held: source has additional restrictions. Use the operator dossier and review them manually.');return {file:writeOut('drafts','brief-'+d.report.id,dossierHtml(d)),status:'draft only'};}
 if(cmd==='draft-weekly-review'){only(o,[]);const w=await execute(db,['weekly-review']);return {file:writeOut('drafts','weekly-review',page({title:'Private weekly intelligence review',subtitle:'OPERATOR WORKING COPY. Contains restricted source titles. Do not distribute.',sections:Object.entries(w).map(([title,rows])=>({title,html:table(rows)}))})),status:'operator draft only'};}
 throw Error('Unknown command '+cmd);
}
export function human(out){if(Array.isArray(out)){if(!out.length)return '(none)';return textTable(out,Object.keys(out[0]).map(key=>({key,label:key,width:70})));}if(out.help)return out.help;return JSON.stringify(out,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const out=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(out,null,2):human(out));}catch(e){if(process.argv.includes('--json'))console.error(JSON.stringify({error:e.message}));else console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
