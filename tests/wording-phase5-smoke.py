"""Offline wording/catalog audit. Executes tokenizer and build tool on source copies only; no WordPress bootstrap."""
from pathlib import Path
import re,json,os,subprocess,argparse,shutil,io,gettext,ast,csv,collections,tempfile
parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parent)
parser.add_argument('--php',default=os.environ.get('MANGAFOCUS_PHP') or shutil.which('php'))
parser.add_argument('--write-inventory',type=Path)
args=parser.parse_args();r=args.root.resolve();php=args.php
assert php,'Specify --php or MANGAFOCUS_PHP; no WordPress site is contacted.'
script=(r/'scripts/build-release.ps1').read_text(encoding='utf-8');allow=re.findall(r"'([^']+)'",script.split('$runtimeFiles = @(',1)[1].split('\n)',1)[0])
assert len(allow)==34 and len(set(allow))==34
php_code="// Tokenize PHP source only. No includes, eval, WordPress bootstrap, or source execution.\n$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];\nforeach($paths as $relative=>$path){$out[$relative]=[];$pos=0;foreach(token_get_all(file_get_contents($path)) as $t){if(is_array($t)){$text=$t[1];$type=$t[0];$kind=$type===T_CONSTANT_ENCAPSED_STRING?'string':($type===T_STRING?'id':(in_array($type,[T_COMMENT,T_DOC_COMMENT,T_INLINE_HTML,T_OPEN_TAG,T_CLOSE_TAG,T_WHITESPACE],true)?'comment':'punct'));}else{$text=$t;$kind='punct';}if($kind!=='comment')$out[$relative][]=[$kind,$text,$pos];$pos+=strlen($text);}}\necho json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);\n"
php_tokens=json.loads(subprocess.check_output([php,'-r',php_code],input=json.dumps({p:str(r/p) for p in allow if p.endswith('.php')}),encoding='utf-8'))
# Quoted literals and comments are opaque; only bare gettext call names are examined.
token=re.compile(r'''(?P<comment>/\*[\s\S]*?\*/|//[^\r\n]*|\#[^\r\n]*)|(?P<string>'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`)|(?P<id>[A-Za-z_$][\w$]*)|(?P<punct>[^\s])''')
names={'__':(0,1),'_e':(0,1),'esc_html__':(0,1),'esc_attr__':(0,1),'esc_html_e':(0,1),'esc_attr_e':(0,1),'_x':(0,2),'_ex':(0,2),'esc_html_x':(0,2),'esc_attr_x':(0,2),'_n':(0,3),'_nx':(0,4),'_n_noop':(0,2),'_nx_noop':(0,3)}
def value(tokens):
 if len(tokens)!=1 or tokens[0][0]!='string' or tokens[0][1][0]=='`':return None
 s=tokens[0][1];quote=s[0];s=s[1:-1]
 return s.replace('\\'+quote,quote).replace('\\\\','\\')
def extract(rel):
 src=(r/rel).read_bytes().decode('utf-8-sig');ts=php_tokens[rel] if rel.endswith('.php') else [(m.lastgroup,m.group(),m.start()) for m in token.finditer(src) if m.lastgroup!='comment'];calls=[]
 for i,(kind,name,pos) in enumerate(ts[:-1]):
  if kind!='id' or name not in names or ts[i+1][1]!='(':continue
  depth=0;args=[];arg=[];closed=False
  for t in ts[i+2:]:
   if t[0]!='string' and t[1] in ['(', '[', '{']:depth+=1
   if t[0]!='string' and t[1] in [')',']','}']:
    if depth==0:args.append(arg);closed=True;break
    depth-=1
   if t[1]==',' and t[0]!='string' and depth==0:args.append(arg);arg=[]
   else:arg.append(t)
  if not closed:raise ValueError('Unclosed call '+rel)
  message,domain=names[name];v=value(args[message]);dom=value(args[domain]) if len(args)>domain else None
  calls.append(dict(file=rel,line=(src.encode('utf-8')[:pos].count(b'\n')+1 if rel.endswith('.php') else src.count('\n',0,pos)+1),function=name,msgid=v,domain=dom,plural=value(args[1]) if name in ['_n','_nx','_n_noop','_nx_noop'] else None,context=value(args[1 if name not in ['_nx','_nx_noop'] else 3 if name=='_nx' else 2]) if 'x' in name and name not in ['esc_html__','esc_attr__','esc_html_e','esc_attr_e'] else None))
 return calls
calls=[c for rel in allow if rel.endswith(('.php','.js')) for c in extract(rel)]
metadata=[]
for rel in allow:
 if not rel.endswith('block.json'):continue
 b=json.loads((r/rel).read_text(encoding='utf-8'));metadata += [dict(file=rel,line=(r/rel).read_text(encoding='utf-8').count('\n',0,(r/rel).read_text(encoding='utf-8').index(json.dumps(b[key],ensure_ascii=False)))+1,function='block.json',msgid=b[key],domain=b['textdomain'],plural=None,context='block title' if key=='title' else 'block description') for key in ['title','description']]+[dict(file=rel,line=(r/rel).read_text(encoding='utf-8').count('\n',0,(r/rel).read_text(encoding='utf-8').index(json.dumps(k,ensure_ascii=False)))+1,function='block.json',msgid=k,domain=b['textdomain'],plural=None,context='block keyword') for k in b.get('keywords',[])]
header=(r/'mangafocus.php').read_text(encoding='utf-8')
for name in ['Plugin Name','Description']:
 metadata.append(dict(file='mangafocus.php',line=header.count('\n',0,re.search(r' \* '+name+r': (.*)',header).start())+1,function='plugin-header',msgid=re.search(r' \* '+name+r': (.*)',header)[1],domain='mangafocus',plural=None,context=None))
allcalls=calls+metadata;msgs={c['msgid'] for c in allcalls};catalog={s.split('\t',1)[1]:s.split('\t',1)[0] for s in (r/'scripts/i18n-map.tsv').read_text(encoding='utf-8').splitlines()};catalog.update({'%s page':'%sページ','%s pages':'%sページ'})
missing=sorted(msgs-set(catalog));unused=sorted(set(catalog)-msgs-{c['plural'] for c in allcalls});invalid=[c for c in allcalls if c['msgid'] is None or c['domain']!='mangafocus']
result=dict(allow=allow,calls=allcalls,unique=len(msgs),callCount=len(allcalls),catalogCount=len(catalog),missing=missing,unused=unused,invalid=invalid)

assert not invalid,invalid
assert not missing,missing
# A catalog entry is identified by context and singular msgid, not English text alone.
def parse_po(path):
 result={};entry={};last=None
 def flush():
  nonlocal entry,last
  if entry:
   key=(entry.get('msgctxt',''),entry['msgid']);assert key not in result,('duplicate gettext entry',key);result[key]=entry
  entry={};last=None
 for line in path.read_text(encoding='utf-8-sig').splitlines():
  if not line.strip():flush();continue
  if line.startswith('#'):continue
  match=re.match(r'(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?) (".*")$',line)
  if match:last=match[1];entry[last]=ast.literal_eval(match[2])
  elif line.startswith('"'):assert last;entry[last]+=ast.literal_eval(line)
  else:raise AssertionError(('unsupported gettext line',line))
 flush();return result
po=parse_po(r/'languages/mangafocus-ja.po');pot=parse_po(r/'languages/mangafocus.pot')
assert set(po)==set(pot)
translations=gettext.GNUTranslations(io.BytesIO((r/'languages/mangafocus-ja.mo').read_bytes()))
map_rows=[line.split('\t',1) for line in (r/'scripts/i18n-map.tsv').read_text(encoding='utf-8').splitlines()]
for col in (0,1):assert len({row[col] for row in map_rows})==len(map_rows),('duplicate dictionary column',col)
format_tokens=lambda text:collections.Counter(re.findall(r'%(?:[0-9]+\$)?[sd]',text))
for (context,message),entry in po.items():
 if not message:continue
 english=message;ja=entry.get('msgstr',entry.get('msgstr[0]'))
 assert ja is not None and ja!='',(context,message)
 assert format_tokens(english)==format_tokens(ja),(message,'format tokens')
 if entry.get('msgid_plural'):
  for n in (0,1,2,99):assert translations.ngettext(message,entry['msgid_plural'],n)==ja
 else:assert (translations.pgettext(context,message) if context else translations.gettext(message))==ja,(context,message)
 assert all(v=='' for k,v in pot[(context,message)].items() if k.startswith('msgstr'))
 for field in ['msgid','msgctxt','msgid_plural']:assert entry.get(field)==pot[(context,message)].get(field)
for call in allcalls:
 key=(call['context'] or '',call['msgid']);assert key in po,('untranslated identity',call)
 if call['plural']:assert po[key]['msgid_plural']==call['plural']
 assert not call['context'] or call['function']=='block.json','New runtime context requires JSON/context extraction review'
handles={
'ai-manga-viewer-editor':'blocks/viewer/index.js','ai-manga-viewer-view':'blocks/viewer/view.js',
'ai-manga-viewer-library-editor':'blocks/library-viewer/index.js','ai-manga-viewer-panel-reader-editor':'assets/panel-reader/editor.js','ai-manga-viewer-panel-reader-frontend':'assets/panel-reader/frontend.js'}
registrations=(r/'mangafocus.php').read_text(encoding='utf-8')+(r/'includes/panel-reader.php').read_text(encoding='utf-8')
for handle,relative in handles.items():
 data=json.loads((r/f'languages/mangafocus-ja-{handle}.json').read_text(encoding='utf-8'));assert data['domain']=='messages';assert data['source']==[relative]
 entries=data['locale_data']['messages'];assert entries['']['lang']=='ja';assert entries['']['domain']=='messages';assert 'nplurals=1' in entries['']['plural-forms']
 expected={call['msgid'] for call in calls if call['file']==relative}
 assert set(entries)-{''}==expected,(handle,expected-set(entries),set(entries)-expected-{''})
 for message in expected:assert entries[message]==[po[('',message)]['msgstr']]
 assert "wp_set_script_translations( '"+handle+"', 'mangafocus'" in registrations
 assert not any(call['context'] or call['plural'] for call in calls if call['file']==relative),'Plural/context JS needs explicit generator support'
# Raw UI labels found during inventory must be gettext calls; identifiers and units remain data.
editor=(r/'assets/panel-reader/editor.js').read_text(encoding='utf-8')
for field in ['X (%)','Y (%)']:assert "__( '"+field+"', 'mangafocus' )" in editor
assert "'X（%）'" not in editor and "'Y（%）'" not in editor
for rel in ['blocks/viewer/index.js','blocks/library-viewer/index.js']:assert "'Viewer ID: '" not in (r/rel).read_text(encoding='utf-8')
for call in calls:
 translated=po[('',call['msgid'])].get('msgstr','')
 assert '専用ビュ' not in translated,('old panel-reader name still active',call)
manual=json.loads((r/'docs/manual-settings-phase5.json').read_text(encoding='utf-8'));metadata=json.loads((r/'blocks/viewer/block.json').read_text(encoding='utf-8'))
assert len(manual)>=54
for row in manual:
 assert row['english'] in msgs and row['japanese']==catalog[row['english']]
 assert all(row[key] for key in ['group','description','initial','modes','key'])
 if 'schema_default' in row:assert metadata['attributes'][row['key']].get('default','__absent__')==row['schema_default']
assert metadata['attributes']['enableInline']=={'type':'boolean'}
readme=(r/'readme.txt').read_text(encoding='utf-8');draft=(r/'docs/readme-next-draft.txt').read_text(encoding='utf-8')
# Historical draft stays at 0.3.0; published history must remain byte-equivalent as text.
def legacy_history(text):
 return text[text.index('= 0.3.0 ='):].split('== Upgrade Notice ==',1)[0].strip()
assert legacy_history(draft)==legacy_history(readme)
assert '= 0.4.0 =' in readme and readme.count('== Upgrade Notice ==')==1
assert len(readme.encode('utf-8'))<10000
assert len(draft.encode('utf-8'))<10000
assert len(draft.split('\n\n',1)[1].splitlines()[0])<=150
for name in ['Contributors','Tags','Requires at least','Tested up to','Requires PHP','Stable tag','License','License URI']:
 pattern=r'^'+re.escape(name)+': (.+)$';assert name=='Stable tag' or re.search(pattern,draft,re.M)[1]==re.search(pattern,readme,re.M)[1]
for name in ['Description','Installation','Frequently Asked Questions','Screenshots','Development','Changelog']:
 assert draft.count('== '+name+' ==')==1
for rel in ['docs/readme-next-draft.txt','docs/changelog-next-draft.md','docs/manual-settings-phase5.md','docs/manual-settings-phase5.json','docs/translation-inventory-phase5.csv']:
 assert rel not in allow
assert len(re.findall(r'^\d+\. ',draft.split('== Screenshots ==')[1].split('== Development ==')[0],re.M))==6
assert 'Stable tag: 0.4.0' in readme and 'Stable tag: 0.3.0' in draft
main=(r/'mangafocus.php').read_text(encoding='utf-8');assert re.search(r'\* Version:\s*(\S+)',main)[1]=='0.4.0'
assert "define( 'AI_MANGA_VIEWER_VERSION', '0.4.0' )" in main
assert translations.info()['project-id-version']=='MangaFocus 0.4.0'
# Counterexamples and deterministic regeneration are isolated in a fresh temporary directory.
with tempfile.TemporaryDirectory(prefix='mangafocus-i18n-check-') as work:
 copy=Path(work)
 for rel in allow+['scripts/build-translations.php','scripts/i18n-map.tsv']:
  dest=copy/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r/rel,dest)
 command=[php,str(copy/'scripts/build-translations.php')]
 done=subprocess.run(command,capture_output=True,text=True,encoding='utf-8');assert done.returncode==0,done.stdout+done.stderr
 language_files=[rel for rel in allow if rel.startswith('languages/')]
 for rel in language_files:assert (r/rel).read_bytes()==(copy/rel).read_bytes(),('nondeterministic catalog',rel)
 current={rel:(copy/rel).read_bytes() for rel in language_files};dictionary=copy/'scripts/i18n-map.tsv';original=dictionary.read_bytes()
 dictionary.write_bytes(original+('duplicate-test-japanese\t'+map_rows[0][1]+'\n').encode('utf-8'))
 fail=subprocess.run(command,capture_output=True,text=True,encoding='utf-8');assert fail.returncode!=0 and 'Duplicate English message ID' in fail.stdout+fail.stderr
 for rel in language_files:assert current[rel]==(copy/rel).read_bytes(),'Failure must not rewrite catalogs'
 dictionary.write_bytes(original)
 block=copy/'blocks/viewer/block.json';content=json.loads(block.read_text(encoding='utf-8'));content['keywords'].append('missing-map-test-fixture');block.write_text(json.dumps(content),encoding='utf-8')
 fail=subprocess.run(command,capture_output=True,text=True,encoding='utf-8');assert fail.returncode!=0 and 'Missing metadata translation' in fail.stdout+fail.stderr
 for rel in language_files:assert current[rel]==(copy/rel).read_bytes()
references={}
for call in allcalls:references.setdefault((call['context'] or '',call['msgid']),[]).append(call)
records=[]
for key,entry in sorted(po.items()):
 if not key[1]:continue
 refs=references.get(key,[]);records.append(dict(english=key[1],context=key[0],plural=entry.get('msgid_plural',''),japanese=entry.get('msgstr',entry.get('msgstr[0]','')),status='active' if refs else 'retained_legacy',references='; '.join(sorted(set(c['file']+':'+str(c['line']) for c in refs)))))
if args.write_inventory:
 with args.write_inventory.open('w',encoding='utf-8-sig',newline='') as stream:
  writer=csv.DictWriter(stream,fieldnames=['english','context','plural','japanese','status','references']);writer.writeheader();writer.writerows(records)
else:
 with (r/'docs/translation-inventory-phase5.csv').open(encoding='utf-8-sig',newline='') as stream:assert list(csv.DictReader(stream))==records,'Source inventory is stale'
summary=dict(uniqueEnglish=len(msgs),sourceOccurrences=len(allcalls),gettextCalls=len(calls),blockMetadataOccurrences=sum(c['function']=='block.json' for c in allcalls),blockMetadataContextIdentities=len({(c['context'],c['msgid']) for c in allcalls if c['function']=='block.json'}),catalogIdentities=len(records),activeIdentities=sum(x['status']=='active' for x in records),retainedLegacyIdentities=sum(x['status']=='retained_legacy' for x in records),missing=missing,manualEntries=len(manual),readmeBytes=len(draft.encode('utf-8')),shortDescriptionCharacters=len(draft.split('\n\n',1)[1].splitlines()[0]))
print(json.dumps(summary,ensure_ascii=False,indent=2))
print('PASS: offline source inventory, domains, PO/POT/MO/JSON and contexts, printf/plural forms, manual/defaults, readme structure, deterministic isolated rebuild and rejection cases.')
