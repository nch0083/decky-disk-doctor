import { definePlugin, callable } from "@decky/api";
import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaHdd } from "react-icons/fa";

type Partition = {path:string; mountpoint:string; total:number; free:number};
type FileItem = {id:string; name:string; path:string; size:number; level:string; mtime:number};
type Status = {partitions:Partition[]; privileged:boolean; version:string};
type Scan = {files:FileItem[]; warnings:string[]; errors:string[]};
type DeleteResult = {ok:boolean; error?:string; results:{ok:boolean;name:string;bytes?:number;error?:string}[]};
const getStatus = callable<[],Status>("get_status");
const scanFiles = callable<[],Scan>("scan");
const deleteFiles = callable<[string[]],DeleteResult>("delete_files");
const fmt=(n:number)=>n>=1073741824?(n/1073741824).toFixed(2)+" GiB":(n/1048576).toFixed(1)+" MiB";
const note=(s:string)=><div style={{fontSize:12,overflowWrap:"anywhere",margin:"5px 0"}}>{s}</div>;
function Content(){
 const [status,setStatus]=useState<Status|null>(null),[scan,setScan]=useState<Scan|null>(null);
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false);
 const [result,setResult]=useState(""),[showErrors,setShowErrors]=useState(false);
 async function refresh(){try{setStatus(await getStatus());}catch(e){setError(String(e));}}
 useEffect(()=>{void refresh();},[]);
 async function runScan(){setBusy(true);setError("");setResult("");setConfirm(false);setSelected({});
  try{setScan(await scanFiles());await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}
 const files=scan?.files||[],chosen=files.filter(f=>selected[f.id]);
 async function remove(){if(!confirm||!chosen.length)return;setBusy(true);setError("");setConfirm(false);
  try{const out=await deleteFiles(chosen.map(f=>f.id));if(!out.ok)throw Error(out.error||"Deletion failed");
   const ok=out.results.filter(x=>x.ok);setResult(ok.length+"/"+out.results.length+" deleted, "+fmt(ok.reduce((s,x)=>s+(x.bytes||0),0)));
   const failed=out.results.filter(x=>!x.ok);if(failed.length)setError(failed.map(x=>x.name+": "+x.error).join("; "));
   setScan(null);setSelected({});await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <PanelSection title="Disk Doctor">
  <PanelSectionRow>{note("Manual scan only. No automatic deletion.")}</PanelSectionRow>
  {(status?.partitions||[]).map((p,i)=><PanelSectionRow key={i}>{note(p.path+" ("+p.mountpoint+"): "+fmt(p.total-p.free)+" used / "+fmt(p.free)+" free")}</PanelSectionRow>)}
  <PanelSectionRow><ButtonItem disabled={busy} onClick={()=>void runScan()}>{busy?"Working...":"Scan crash dumps and error reports"}</ButtonItem></PanelSectionRow>
  {status&&!status.privileged&&<PanelSectionRow>{note("Backend is not root; some files may be inaccessible.")}</PanelSectionRow>}
  {error&&<PanelSectionRow>{note("Error: "+error)}</PanelSectionRow>}
  {result&&<PanelSectionRow>{note(result)}</PanelSectionRow>}
  {scan&&<PanelSectionRow>{note(files.length+" files, "+fmt(files.reduce((s,f)=>s+f.size,0)))}
   {(scan.warnings||[]).map((w,i)=><div key={i}>{note(w)}</div>)}
   <ButtonItem disabled={busy} onClick={()=>{setSelected(Object.fromEntries(files.filter(f=>f.level==="recommended").slice(0,100).map(f=>[f.id,true])));setConfirm(false);}}>Select recommended</ButtonItem>
   <ButtonItem disabled={busy} onClick={()=>{setSelected({});setConfirm(false);}}>Clear selection</ButtonItem>
   {note("Selected: "+chosen.length+" / "+fmt(chosen.reduce((s,f)=>s+f.size,0)))}</PanelSectionRow>}
  {files.map(f=><PanelSectionRow key={f.id}><label style={{display:"flex",gap:8,overflowWrap:"anywhere",fontSize:12}}>
   <input type="checkbox" checked={!!selected[f.id]} disabled={busy||(!selected[f.id]&&chosen.length>=100)} onChange={e=>{setSelected(v=>({...v,[f.id]:e.target.checked}));setConfirm(false);}}/>
   <span>{f.name+" · "+fmt(f.size)+" · "+f.level}<div>{f.path}</div></span></label></PanelSectionRow>)}
  {chosen.length>0&&<PanelSectionRow>{!confirm?
   <ButtonItem disabled={busy} onClick={()=>setConfirm(true)}>Review deletion ({chosen.length})</ButtonItem>:
   <><div>{note("Permanently delete "+chosen.length+" files? This cannot be undone.")}</div>
   <ButtonItem disabled={busy} onClick={()=>void remove()}>Confirm permanent deletion</ButtonItem>
   <ButtonItem onClick={()=>setConfirm(false)}>Cancel</ButtonItem></>}</PanelSectionRow>}
  {scan&&<PanelSectionRow><ButtonItem onClick={()=>setShowErrors(v=>!v)}>{showErrors?"Hide":"Show"} recent errors</ButtonItem></PanelSectionRow>}
  {scan&&showErrors&&(scan.errors||[]).map((e,i)=><PanelSectionRow key={i}>{note(e)}</PanelSectionRow>)}
 </PanelSection>;
}
export default definePlugin(()=>({name:"Decky Disk Doctor",titleView:<div>Disk Doctor</div>,content:<Content/>,icon:<FaHdd/>}));
