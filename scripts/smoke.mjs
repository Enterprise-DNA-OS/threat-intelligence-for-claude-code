import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,reads,dossier,dossierHtml} from './intel.mjs';
import {parseCsv} from './lib/csv.mjs';
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'intel-test-'));
process.env.DATABASE_URL='';process.env.DATA_DIR=path.join(scratch,'db');process.env.OUTPUT_DIR=path.join(scratch,'out');
let db=await getDb();let n=0;
const test=async(name,fn)=>{await fn();console.log('ok '+(++n)+' '+name);};
const run=(...args)=>execute(db,args);
const rejects=(args,re)=>assert.rejects(()=>run(...args),re);
const file=(name,text)=>{const p=path.join(scratch,name);fs.writeFileSync(p,text);return p;};
const child=(script,args=[],status=0)=>{const p=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script),...args],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,status,p.stdout+'\n'+p.stderr);return p;};
try{
 await test('migrate and seed are idempotent',async()=>{assert.equal((await migrate(db)).ran.length,1);assert.equal((await migrate(db)).ran.length,0);await seed(db);await seed(db);assert.equal((await run('reports')).length,3);assert.equal((await run('indicators')).length,4);});
 const today=(await db.query('select current_date::text today'))[0].today;
 const future=(await db.query('select (current_date+20)::text date'))[0].date;
 await test('every read route works and demo queues reflect the records',async()=>{for(const name of Object.keys(reads))assert(Array.isArray(await run(name)),name);assert.equal((await run('morning-triage')).length,2);assert.equal((await run('overdue-actions')).length,2);assert.equal((await run('source-overlap'))[0].ref,'I-102');assert.equal((await run('collection-gaps')).length,3);const findings=await run('compliance');for(const rule of ['SOURCE-LABEL','SOURCE-OWNER','SOURCE-REVIEW','INDICATOR-EXPIRY','INDICATOR-SOURCE','ACTION-OWNER'])assert(findings.some(x=>x.rule===rule),rule);assert.match((await run('help')).help,/restore/);});
 await test('exact references, case-insensitive names and id prefixes resolve safely',async()=>{const r=(await run('card','report','r-101'))[0];assert.equal((await run('card','report',r.id.slice(0,10)))[0].ref,'R-101');assert.equal((await run('card','report','SUPPLIER PHISHING'))[0].ref,'R-101');await rejects(['card','report','fictional'],/Ambiguous.*R-101.*R-102.*R-103/);await rejects(['card','report','%'],/No report/);});
 await test('weekly review uses triage, gaps and actions; dossier joins evidence',async()=>{const w=await run('weekly-review');assert.deepEqual(w.triage,await run('morning-triage'));assert.deepEqual(w.gaps,await run('collection-gaps'));assert.deepEqual(w.actions,await run('overdue-actions'));const d=await run('report-pack','R-101');assert.equal(d.indicators.length,2);assert.equal(d.actions.length,2);assert.equal(d.notes.length,1);});
 await test('CRUD validates values and records before-and-after history',async()=>{
  await run('add','report','--ref=R-X','--title=Test <script>alert(1)</script>','--source-url=https://example.org/test','--tlp=TLP:CLEAR','--owner=Tester','--review-due='+today);
  await run('set','report','R-X','--summary=Reviewed source','--reviewed-on='+today,'--review-due='+future);
  await run('add','indicator','--ref=I-X','--kind=domain','--value=TEST[.]EXAMPLE','--expires-on='+future);
  assert.equal((await run('card','indicator','I-X'))[0].value,'test.example');
  await run('add','requirement','--ref=Q-X','--name=Test question','--question=What exposure matters?','--owner=Tester','--review-due='+future);
  await run('set','requirement','Q-X','--priority=1');
  await run('add','action','--ref=A-X','--name=Verify source','--report=R-X','--owner=Tester','--due-on='+future);
  await run('set','action','A-X','--owner=Another tester');
  await run('set','indicator','I-X','--expires-on='+future);
  await run('log','R-X','--author=Tester','--text=Source reviewed <b>as text</b>');
  await rejects(['set','report','R-X','--review-due=2026-02-30'],/Invalid calendar date/);
  await rejects(['set','report','R-X','--tlp=TLP:WHITE'],/Unknown TLP/);
  await rejects(['add','indicator','--ref=I-BAD','--kind=ipv4','--value=999.1.2.3'],/Invalid IP/);
  await rejects(['set','indicator','I-X','--value=other.example'],/immutable/);
  await rejects(['set','report','R-X','--unsafe=1'],/Unknown option/);
  await rejects(['set','report','R-X','--ref=R-Y'],/immutable/);
  assert((await db.query("select * from audit_events where entity='reports' and operation='UPDATE' and before_record->>'ref'='R-X'")).length>0);
 });
 await test('indicator decisions need source evidence and cannot accept expiry or invalid confidence',async()=>{
  const options=['--status=accepted','--confidence=80','--reviewer=Tester','--rationale=Reviewed fixture','--expires-on='+future];
  await rejects(['review-indicator','I-X',...options],/need sources/);
  await run('link','R-X','I-X','--context=Original report context');
  await run('review-indicator','I-X',...options);assert.equal((await run('card','indicator','I-X'))[0].status,'accepted');
  await rejects(['review-indicator','I-X','--status=accepted','--reviewer=Tester','--rationale=Evidence','--expires-on='+future],/need confidence/);
  await rejects(['review-indicator','I-X','--status=accepted','--confidence=101','--reviewer=Tester','--rationale=Evidence','--expires-on='+future],/0..100/);
  await rejects(['review-indicator','I-X','--status=accepted','--confidence=80','--reviewer=Tester','--rationale=Evidence','--expires-on=2000-01-01'],/expired/);
  await run('review-indicator','I-X','--status=retired','--reviewer=Tester','--rationale=No longer useful','--expires-on='+today);
 });
 await test('assessments and action closure require evidence',async()=>{
  await run('assess','Q-X','R-X','--disposition=relevant','--reviewer=Tester','--rationale=Matches the test scope');
  assert(!(await run('collection-gaps')).some(x=>x.ref==='Q-X'));
  await rejects(['complete-action','A-X'],/Required --evidence/);
  await run('complete-action','A-X','--evidence=Owner confirmed the test result');assert.equal((await run('card','action','A-X'))[0].status,'done');
  await rejects(['assess','Q-X','R-X','--disposition=guess','--reviewer=Tester','--rationale=Test'],/check constraint/);
 });
 await test('CSV supports quotes, BOM, multiline and rejects malformed rows',async()=>{
  const r=parseCsv('\ufeffType,Indicator,Context\r\ndomain,test.example,"line one\nline ""two"""\r\n');assert.equal(r[0].Context,'line one\nline "two"');
  assert.throws(()=>parseCsv('Type,Type\na,b'),/unique/);assert.throws(()=>parseCsv('Type,Indicator\na'),/expected/);assert.throws(()=>parseCsv('Type,Indicator\n"bad'),/unclosed/);
 });
 const csv=file('iocs.csv','Type,Indicator,Context\ndomain,new[.]example,"Synthetic, not a real IOC"\nipv4,192.0.2.20,Overlap\n');
 const imp=['import','feedly','--file='+csv,'--source=https://example.org/import','--title=Imported fixture','--tlp=TLP:CLEAR','--owner=Tester'];
 await test('import dry run rolls back all records and audit entries',async()=>{const before=await db.query('select count(*) n from audit_events');const out=await run(...imp,'--dry-run');assert.equal(out.new_indicators,1);assert.deepEqual(await db.query('select count(*) n from audit_events'),before);assert(!(await run('reports')).some(x=>x.title==='Imported fixture'));});
 await test('repeat import is idempotent and preserves analyst acceptance and expiry',async()=>{
  await run(...imp);const n=(await run('indicators')).length;const i=(await run('card','indicator','new.example'))[0];
  await run('review-indicator',i.ref,'--status=accepted','--confidence=67','--reviewer=Tester','--rationale=Fixture reviewed','--expires-on='+future);
  await run(...imp);assert.equal((await run('indicators')).length,n);const after=(await run('card','indicator',i.ref))[0];assert.equal(after.confidence,67);assert.equal(after.expires_on,future);assert.equal(after.status,'accepted');
  const old=(await run('card','indicator','I-102'))[0];assert.equal(old.confidence,80);assert.equal(old.status,'accepted');
 });
 await test('custom headers, rejected malformed import and source-label conflicts',async()=>{
  const custom=file('custom.csv','Observable type,Observable,Article context\ndomain,mapped.example,Mapped fixture\n');
  const mapping=file('mapping.json',JSON.stringify({kind:'Observable type',value:'Observable',context:'Article context'}));
  await run('import','feedly','--file='+custom,'--mapping='+mapping,'--source=https://example.org/mapped','--title=Mapped fixture','--tlp=TLP:GREEN','--owner=Tester');
  assert.equal((await run('card','indicator','mapped.example'))[0].status,'unreviewed');
  const count=await db.query('select count(*) n from audit_events');
  const invalid=file('invalid.csv','Type,Indicator\ndomain,valid.example\nipv4,999.1.1.1\n');
  await rejects(['import','feedly','--file='+invalid,'--source=https://example.org/bad','--title=Bad','--tlp=TLP:CLEAR','--owner=Tester'],/CSV row 3/);
  assert.deepEqual(await db.query('select count(*) n from audit_events'),count);
  await rejects(imp.map(x=>x==='--tlp=TLP:CLEAR'?'--tlp=TLP:GREEN':x),/sharing label differs/);
  const dup=file('dup.csv','Type,Indicator\ndomain,new.example\ndomain,new[.]example\n');await rejects(imp.map(x=>x.startsWith('--file=')?'--file='+dup:x),/Duplicate indicator/);
 });
 await test('import transaction rolls back when a database constraint fails mid-file',async()=>{
  const v='collision.example';const {createHash}=await import('node:crypto');const ref='I-'+createHash('sha256').update('domain|'+v).digest('hex').slice(0,12);
  await run('add','indicator','--ref='+ref,'--kind=domain','--value=different.example');
  const before=await db.query('select count(*) n from audit_events');const bad=file('collision.csv','Type,Indicator\ndomain,first-row.example\ndomain,collision.example\n');
  await rejects(['import','feedly','--file='+bad,'--source=https://example.org/collision','--title=Collision','--tlp=TLP:CLEAR','--owner=Tester'],/unique constraint/);
  assert.deepEqual(await db.query('select count(*) n from audit_events'),before);await rejects(['card','indicator','first-row.example'],/No indicator/);
 });
 await test('drafts stay local, escape HTML and respect source restrictions',async()=>{
  await rejects(['draft-brief','R-103'],/unknown or recipient-restricted/);await rejects(['draft-brief','R-101'],/additional restrictions/);
  await run('set','report','R-X','--tlp=TLP:RED');await rejects(['draft-brief','R-X'],/recipient-restricted/);
  await run('set','report','R-X','--tlp=TLP:CLEAR');const draft=await run('draft-brief','R-X');const html=fs.readFileSync(draft.file,'utf8');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>alert'));assert.equal((html.match(/class="tlp-mark/g)||[]).length,2);assert(html.includes('TLP:CLEAR'));assert(fs.existsSync((await run('draft-weekly-review')).file));
  assert(dossierHtml(await dossier(db,'R-103')).includes('UNCLASSIFIED: DO NOT DISTRIBUTE'));
 });
 let snap;
 await test('exports contain every entity and refuse restore over existing records',async()=>{snap=await run('export','--dir='+path.join(scratch,'backup'));assert.equal(snap.records.reports,(await run('reports')).length);assert(fs.existsSync(path.join(scratch,'backup','assessments.csv')));await rejects(['restore','--file='+snap.file],/empty database/);});
 await db.close();db=null;
 await test('CLI process emits machine JSON and ambiguity exits one',async()=>{assert(Array.isArray(JSON.parse(child('intel.mjs',['reports','--json']).stdout)));assert.match(child('intel.mjs',['card','report','fictional'],1).stderr,/Ambiguous/);assert.match(JSON.parse(child('intel.mjs',['unknown','--json'],1).stderr).error,/Unknown command/);});
 await test('all dashboard and dossier renderers run from the same database',async()=>{child('view.mjs');child('docs.mjs');assert.equal(fs.readdirSync(path.join(scratch,'out','views')).length,3);const files=fs.readdirSync(path.join(scratch,'out','docs-out','assessment-dossiers'));assert.equal(files.length,snap.records.reports);for(const f of files){const h=fs.readFileSync(path.join(scratch,'out','docs-out','assessment-dossiers',f),'utf8');assert(h.includes('tlp-top'));assert(h.includes('tlp-bottom'));}});
 process.env.DATA_DIR=path.join(scratch,'restored');db=await getDb();await migrate(db);
 await test('snapshot restores every row including original audit history',async()=>{await run('restore','--file='+snap.file);const backup=JSON.parse(fs.readFileSync(snap.file,'utf8'));for(const [name,expected] of Object.entries(backup.records)){const actual=await db.query('select * from '+name+' order by id');assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,name);}assert.equal((await migrate(db)).ran.length,0);});
 console.log('PASS '+n+' integration checks; every CLI route exercised');
}finally{if(db)await db.close();fs.rmSync(scratch,{recursive:true,force:true});}
