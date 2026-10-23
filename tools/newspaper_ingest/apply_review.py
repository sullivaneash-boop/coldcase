#!/usr/bin/env python3
"""Apply an explicit source-anchored research plan; default is validation only."""
import argparse,csv,json,os,shutil,uuid
from pathlib import Path

def apply(root,plan,execute=False):
 batch=root/'00_ADMIN/ingestion_batches'/plan['batch_id']
 if (batch/'REGISTERS_APPLIED.json').exists():raise ValueError('Review plan already applied')
 tables={}
 for p in (root/'00_ADMIN/data_registers').glob('*.csv'):
  with p.open(newline='') as f:
   rd=csv.DictReader(f);tables[p.stem]=(rd.fieldnames,list(rd))
 ids={row[fields[0]] for name,(fields,rows) in tables.items() if name!='newspaper_articles' for row in rows};new=set()
 for table,records in plan['register_rows'].items():
  if table not in tables:raise ValueError('Unknown table '+table)
  fields,_=tables[table]
  for row in records:
   if set(row)-set(fields):raise ValueError('Unknown fields '+str(set(row)-set(fields)))
   pk=row.get(fields[0]);assert pk and pk not in ids and pk not in new, 'Duplicate or missing primary ID'
   new.add(pk)
   if table=='claims':assert row.get('source_ids') and row.get('status') in ['REPORTED','ALLEGED','DISPUTED','UNKNOWN'], 'Unsupported promotion'
   if table=='contradictions':assert row.get('status')=='UNRESOLVED'
 allids=ids|new
 for table,records in plan['register_rows'].items():
  for row in records:
   for field,value in row.items():
    if not value or field==tables[table][0][0] or field=='statement_series_id':continue
    if field.endswith('_id') or field.endswith('_ids') or field in ['people_mentioned','locations_mentioned']:
     for ref in str(value).split(';'):assert ref in allids, f'Unresolved reference {table}.{field}: {ref}'
 # Every new claim needs an attribution row with a source locator.
 links=plan['register_rows'].get('claim_sources',[])
 for c in plan['register_rows'].get('claims',[]):
  assert any(x['claim_id']==c['claim_id'] and x.get('source_locator') for x in links)
 print('Validated plan:',{k:len(v) for k,v in plan['register_rows'].items()})
 if not execute:return
 backup=batch/'register_backups_before_commit';backup.mkdir(exist_ok=False)
 staged=batch/'register_staged_commit';staged.mkdir()
 for table,records in plan['register_rows'].items():
  p=root/'00_ADMIN/data_registers'/f'{table}.csv';shutil.copyfile(p,backup/p.name)
  fields,old=tables[table]
  with (staged/p.name).open('w',newline='') as f:
   wr=csv.DictWriter(f,fieldnames=fields);wr.writeheader();wr.writerows(old+records)
 journal=batch/'REGISTER_COMMIT_IN_PROGRESS.json';journal.write_text(json.dumps({'tables':list(plan['register_rows']),'recovery':'Restore affected CSVs from register_backups_before_commit if interrupted. Do not blindly reapply.'},indent=2))
 try:
  for table in plan['register_rows']:os.replace(staged/f'{table}.csv',root/'00_ADMIN/data_registers'/f'{table}.csv')
 except Exception:
  for table in plan['register_rows']:shutil.copyfile(backup/f'{table}.csv',root/'00_ADMIN/data_registers'/f'{table}.csv')
  raise
 (batch/'REGISTERS_APPLIED.json').write_text(json.dumps({'batch_id':plan['batch_id'],'counts':{k:len(v) for k,v in plan['register_rows'].items()}},indent=2));journal.unlink()
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',type=Path,required=True);p.add_argument('--plan',type=Path,required=True);p.add_argument('--execute',action='store_true');a=p.parse_args();apply(a.archive,json.loads(a.plan.read_text()),a.execute)
