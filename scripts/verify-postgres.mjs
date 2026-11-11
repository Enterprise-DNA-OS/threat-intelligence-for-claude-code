import assert from 'node:assert/strict';
import {getDb} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,reads} from './intel.mjs';
if(!process.env.DATABASE_URL)throw Error('Use only a disposable PostgreSQL test database');
const db=await getDb();try{assert.equal(db.mode,'postgres');await migrate(db);await seed(db);await seed(db);for(const name of Object.keys(reads))assert(Array.isArray(await execute(db,[name])));assert.equal((await execute(db,['morning-triage'])).length,2);assert.equal((await execute(db,['overdue-actions'])).length,2);await execute(db,['log','R-101','--author=CI','--text=Postgres adapter verified']);assert((await execute(db,['audit'])).length>0);console.log('PASS PostgreSQL migration, idempotent seed, all read commands and audited write');}finally{await db.close();}
