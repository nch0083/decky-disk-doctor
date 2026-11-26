const R = window.SP_REACT;
const UI = window.DFL || {};
const h = R.createElement;
const {useState,useEffect} = R;
const {PanelSection,PanelSectionRow,ButtonItem} = UI;
const PLUGIN = 'Decky Disk Doctor';
const bytes = n => n >= 1073741824 ? (n/1073741824).toFixed(2)+' GiB' : (n/1048576).toFixed(1)+' MiB';
const text = (s,style={}) => h('div',{style:{fontSize:'12px',overflowWrap:'anywhere',margin:'5px 0',...style}},s);
const button = (label,click,disabled=false) => h(ButtonItem,{layout:'below',onClick:click,disabled},label);
const box = (...children) => h('div',{style:{padding:'8px',margin:'6px 0',background:'rgba(128,128,128,.12)',borderRadius:'8px'}},...children);
function Content({api}) {
 const [status,setStatus]=useState(null),[scan,setScan]=useState(null),[selected,setSelected]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const [result,setResult]=useState(''),[showErrors,setShowErrors]=useState(false);
 async function refreshStatus(){try{setStatus(await api.call('get_status'));}catch(e){setError(String(e));}}
 useEffect(()=>{refreshStatus();},[]);
 async function runScan(){setBusy(true);setError('');setResult('');setConfirm(false);setSelected({});
 try{setScan(await api.call('scan'));await refreshStatus();}catch(e){setError(String(e));}finally{setBusy(false);}}
 const files=scan?.files||[],chosen=files.filter(f=>selected[f.id]);
 async function deleteChosen(){if(!confirm||!chosen.length)return;setBusy(true);setError('');setConfirm(false);
 try{const out=await api.call('delete_files',chosen.map(f=>f.id));if(!out.ok)throw Error(out.error);
 const ok=out.results.filter(x=>x.ok);
 setResult(`${ok.length}/${out.results.length} files deleted; ${bytes(ok.reduce((s,x)=>s+x.bytes,0))} file sizes.`);
 const bad=out.results.filter(x=>!x.ok);if(bad.length)setError(bad.map(x=>`${x.name}: ${x.error}`).join('; '));
 setScan(null);setSelected({});await refreshStatus();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return h(PanelSection,null,
 h(PanelSectionRow,null,text('v0.1 · Manual scan · No automatic deletion')),
 ...(status?.partitions||[]).map((p,i)=>h(PanelSectionRow,{key:'p'+i},box(
 text(`${p.path} [mounted at ${p.mountpoint}]`,{fontWeight:'bold'}),
 text(`${bytes(p.total-p.free)} used / ${bytes(p.total)} · ${bytes(p.free)} free`)))),
 h(PanelSectionRow,null,button(busy?'Working…':'Scan crash dumps and error reports',runScan,busy)),
 !status?.privileged&&h(PanelSectionRow,null,text('Backend not root; protected files may be inaccessible.',{color:'#eaa'})),
 error&&h(PanelSectionRow,null,text(error,{color:'#f88'})),
 result&&h(PanelSectionRow,null,text(result,{color:'#9e9'})),
 scan&&h(PanelSectionRow,null,box(
 text(`${files.length} candidate files · ${bytes(files.reduce((s,f)=>s+f.size,0))}`),
 ...(scan.warnings||[]).map(w=>text(w,{color:'#eaa'})),
 button('Select recommended crash dumps',()=>{setSelected(Object.fromEntries(files.filter(f=>f.level==='recommended').slice(0,100).map(f=>[f.id,true])));setConfirm(false);},busy),
 button('Clear selection',()=>{setSelected({});setConfirm(false);},busy),
 text(`Selected: ${chosen.length} · ${bytes(chosen.reduce((s,f)=>s+f.size,0))}`))),
 ...files.map(f=>h(PanelSectionRow,{key:f.id},h('div',null,
 h('label',{style:{display:'flex',gap:'8px'}},
 h('input',{type:'checkbox',checked:!!selected[f.id],disabled:busy||(!selected[f.id]&&chosen.length>=100),
 onChange:e=>{setSelected(v=>({...v,[f.id]:e.target.checked}));setConfirm(false);}}),
 h('span',null,`${f.level==='recommended'?'[recommended]':'[review]'} ${f.name} · ${bytes(f.size)}`)),
 text(`${f.path} · ${new Date(f.mtime*1000).toLocaleString()}`)))),
 chosen.length>0&&h(PanelSectionRow,null,!confirm?
 button(`Review deletion of ${chosen.length} selected files`,()=>setConfirm(true),busy):
 box(text(`Permanently delete ${chosen.length} files? No undo.`,{color:'#f99'}),
 button('Confirm permanent deletion',deleteChosen,busy),button('Cancel',()=>setConfirm(false),busy))),
 scan&&h(PanelSectionRow,null,button(showErrors?'Hide recent errors':'Show recent errors',()=>setShowErrors(x=>!x))),
 scan&&showErrors&&h(PanelSectionRow,null,box(...(scan.errors?.length?scan.errors:['No accessible error entries']).map(x=>text(x,{fontFamily:'monospace'}))))
 );
}
(function(){
 const init=window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
 if(!init)throw Error('Decky API initialization unavailable');
 const api=init.connect(1,PLUGIN);
 return {name:PLUGIN,titleView:h('div',null,'Disk Doctor'),content:h(Content,{api}),icon:h('span',null,'▣'),onDismount(){}};
})()
