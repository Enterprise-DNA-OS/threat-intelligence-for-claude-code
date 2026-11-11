import {getDb} from './lib/db.mjs';
import {dossier,dossierHtml} from './intel.mjs';
import {writeOut} from './lib/render.mjs';
const db=await getDb();try{await db.exec('BEGIN READ ONLY');const rows=await db.query('select ref,id from reports order by ref');for(const r of rows){const d=await dossier(db,r.ref);console.log('doc: '+writeOut('docs-out/assessment-dossiers',r.id,dossierHtml(d)));}console.log(rows.length+' operator dossiers rendered. Source restrictions remain attached.');}finally{await db.exec('ROLLBACK');await db.close();}
