const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const XLSX = require("xlsx-js-style");

const PORT = 3011;
const ROOT = __dirname;
const WEB = path.join(ROOT, "web");
const ALLOWED_STORES = new Set(["139","304","360","361","421","005","230","090","099","169"]);

function text(v){ return v == null ? "" : String(v).trim(); }
function norm(v){ return text(v).toLowerCase().replace(/[\s_]+/g, " "); }
function num(v){ const n = Number(text(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
function sci(v){ return /[eE][+-]?[0-9]+/.test(text(v)); }

function expandScientific(v){
  const t=text(v), m=t.match(/^([+-]?)([0-9]+)(?:\.([0-9]+))?[eE]([+-]?[0-9]+)$/);
  if(!m) return t;
  const digits=m[2]+(m[3]||"");
  const pos=m[2].length+Number(m[4]);
  if(pos<=0) return m[1]+"0."+"0".repeat(-pos)+digits;
  if(pos>=digits.length) return m[1]+digits+"0".repeat(pos-digits.length);
  return m[1]+digits.slice(0,pos)+"."+digits.slice(pos);
}
function barcode(v){
  let t=text(v);
  if(!t) return "";
  if(/^[0-9]+\.0+$/.test(t)) t=t.replace(/\.0+$/,"");
  return sci(t) ? expandScientific(t) : t;
}
function header(headers, candidates){
  const set=new Set(candidates.map(norm));
  return headers.findIndex(h=>set.has(h));
}
function csvLine(line){
  const out=[]; let cur="", quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(c==="," && !quoted){out.push(cur);cur="";}
    else cur+=c;
  }
  out.push(cur); return out;
}
function decode(buffer){
  const b=new Uint8Array(buffer);
  if(b.length>=2 && b[0]===255 && b[1]===254) return new TextDecoder("utf-16le").decode(b.slice(2));
  return new TextDecoder("utf-8").decode(b).replace(/^\uFEFF/,"");
}
function description(v){
  const m=text(v).match(/^(.+?)\s*\((.+?)-(.+?)\)\s*$/);
  return m ? {stockNo:m[1].trim(),color:m[2].trim(),size:m[3].trim()} :
             {stockNo:"",color:"",size:""};
}
function readScanner(file){
  const lines=decode(fs.readFileSync(file)).replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(x=>x.trim());
  if(!lines.length) throw Error("Scanner file is empty.");
  const rawRows=lines.map(csvLine);
  const h=rawRows[0].map(norm);
  const bi=header(h,["barcode","upc","local upc","local barcode"]);
  const qi=header(h,["qty","quantity","actual receive qty","actual qty","scan qty"]);
  if(bi<0 || qi<0) throw Error('Scanner file must contain "BARCODE" and "QTY" columns.');
  const records=[];
  for(let i=1;i<rawRows.length;i++){
    const raw=rawRows[i][bi], b=barcode(raw);
    if(b) records.push({barcode:b,quantity:num(rawRows[i][qi]),scientificNotation:sci(raw)});
  }
  return {rawRows,records};
}
function readBxi(file){
  const wb=XLSX.read(fs.readFileSync(file),{cellDates:false,raw:false,dense:true});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:"",raw:false,blankrows:false});
  if(rows.length<2) throw Error("BXI workbook has no data.");
  const h=rows[0].map(text).map(norm);
  const bi=header(h,["barcode","upc","local upc","local barcode"]);
  const qi=header(h,["quantity","qty","document qty","document quantity"]);
  const si=header(h,["stock no","stock#","stock number","stock"]);
  const di=header(h,["description","item description","product description"]);
  if(bi<0||qi<0||di<0) throw Error("BXI columns could not be identified.");
  const records=rows.slice(1).map(r=>{
    const b=barcode(r[bi]), p=description(r[di]);
    return {barcode:b,stockNo:si>=0?text(r[si]):p.stockNo,color:p.color,size:p.size,quantity:num(r[qi]),scientificNotation:sci(r[bi])};
  }).filter(r=>r.barcode);
  return {rawRows:rows,records};
}
function aggregate(records, details){
  const map={};
  for(const r of records){
    if(!map[r.barcode]) map[r.barcode]={barcode:r.barcode,stockNo:details?text(r.stockNo):"",color:details?text(r.color):"",size:details?text(r.size):"",quantity:num(r.quantity),occurrences:1,scientificNotation:!!r.scientificNotation};
    else { map[r.barcode].quantity+=num(r.quantity); map[r.barcode].occurrences++; map[r.barcode].scientificNotation ||= !!r.scientificNotation; }
  }
  return map;
}
function pair(bxi, scanner){
  const b=aggregate(bxi.records,true), s=aggregate(scanner.records,false);
  const keys=Array.from(new Set([...Object.keys(s),...Object.keys(b)])).sort();
  const rows=[], statuses=[];
  const z={totalItems:keys.length,matched:0,qtyDifference:0,missingScanner:0,missingBxi:0,duplicateScanner:0,duplicateBxi:0,barcodeWarning:0,scannerTotal:0,bxiTotal:0};
  for(const k of keys){
    const x=s[k], y=b[k], sq=x?x.quantity:0, bq=y?y.quantity:0, parts=[];
    z.scannerTotal+=sq; z.bxiTotal+=bq;
    if(!x&&y){parts.push("MISSING IN SCANNER");z.missingScanner++;}
    if(x&&!y){parts.push("MISSING IN BXI");z.missingBxi++;}
    if(x&&y&&sq!==bq){parts.push("QTY DIFFERENCE");z.qtyDifference++;}
    if(x&&x.occurrences>1){parts.push("DUPLICATE SCANNER");z.duplicateScanner++;}
    if(y&&y.occurrences>1){parts.push("DUPLICATE BXI");z.duplicateBxi++;}
    if(x?.scientificNotation||y?.scientificNotation){parts.push("BARCODE FORMAT WARNING");z.barcodeWarning++;}
    if(!parts.length){parts.push("MATCHED");z.matched++;}
    rows.push([x?k:"",x&&y?text(y.stockNo):"",x&&y?text(y.color):"",x&&y?text(y.size):"",x?sq:"","",y?k:"",y?text(y.stockNo):"",y?text(y.color):"",y?text(y.size):"",y?bq:"","",sq-bq,0]);
    statuses.push(parts.join(" | "));
  }
  const exceptions=z.qtyDifference+z.missingScanner+z.missingBxi+z.duplicateScanner+z.duplicateBxi+z.barcodeWarning;
  z.status=exceptions ? `RECEIVING HAS ${exceptions} EXCEPTION(S)` : "RECEIVING VERIFIED";
  return {rows,statuses,z};
}
function fileInfo(name){
  const m=text(name).match(/^([0-9]{3})\s+STO#([0-9]+)(?=\s|$)/i);
  return m ? {store:m[1],sto:m[2]} : null;
}
function findFile(dir,store,sto,extensions){
  if(!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter(name=>{
    const i=fileInfo(name);
    return i&&i.store===store&&i.sto===sto&&extensions.includes(path.extname(name).toLowerCase());
  }).sort()[0] || null;
}
function getCompanyTemplate(store){
  const map={
    "090":{company:"Charter International Inc.",template:"CII Matched Report Template",brand:"Figlia"},
    "099":{company:"Charter International Inc.",template:"CII Matched Report Template",brand:"Figlia"},
    "005":{company:"Traffic",template:"Traffic Matched Report Template",brand:"Traffic"},
    "230":{company:"MATTHEWS",template:"MATTHEWS Matched Report Template",brand:"MATTHEWS"},
    "139":{company:"SOFAB",template:"SOFAB Matched Report Template",brand:"SOFAB"},
    "304":{company:"SOFAB",template:"SOFAB Matched Report Template",brand:"SOFAB"},
    "169":{company:"CLN",template:"CLN Matched Report Template",brand:"CLN"},
    "360":{company:"CLN",template:"CLN Matched Report Template",brand:"CLN"},
    "361":{company:"CLN",template:"CLN Matched Report Template",brand:"CLN"},
    "421":{company:"CLN",template:"CLN Matched Report Template",brand:"CLN"}
  };
  return map[store] || {company:"",template:"",brand:""};
}

function makeWorkbook(result,scanner,bxi,store,sto){
  const companyTemplate=getCompanyTemplate(store);

  // Exact report geometry used by the reference:
  // A:E = SCAN / ACTUAL RECEIVE
  // F    = spacer
  // G:K = DOCUMENT
  // L    = spacer
  // M   = Qty
  // N   = UPC
  // O   = STATUS
  // P    = spacer
  // Q:R = PAIRING SUMMARY
  const rows=[
    [companyTemplate.company,"","","","","","","","","","","","","",""],
    [companyTemplate.template,"","","","","","","","","","","","","",""],
    [`From: 000`,`To: 105`,`TRA #8169`,`BRAND: ${companyTemplate.brand}`,`STO # ${sto}`,`QTY: ${result.z.scannerTotal}`,"","","","","","","","",""],
    ["","","","","","","","","","","","","","",""],
    ["SCAN/ACTUAL RECEIVE","","","","","","DOCUMENT","","","","","","","",""],
    ["Barcode","Stock#","Color","Size","Qty","","Local UPC","Stock#","Color","Size","Qty","","Qty","UPC","STATUS"]
  ];

  result.rows.forEach((r,i)=>{
    rows.push([
      r[0],r[1],r[2],r[3],r[4],"",
      r[6],r[7],r[8],r[9],r[10],"",
      r[12],r[13],result.statuses[i]
    ]);
  });

  const totalRow=rows.length+1;
  rows.push([
    "","","","",result.z.scannerTotal,"",
    "","","","",result.z.bxiTotal,"",
    "",""
  ]);

  // Preserve the report's visible blank bordered area beneath the total row.
  const templateBottom=Math.max(totalRow+22,35);
  while(rows.length<templateBottom){
    rows.push(["","","","","","","","","","","","","","",""]);
  }

  const ws=XLSX.utils.aoa_to_sheet(rows);

  ws["!merges"]=[
    {s:{r:0,c:0},e:{r:0,c:14}},
    {s:{r:1,c:0},e:{r:1,c:14}},
    {s:{r:2,c:0},e:{r:2,c:1}},
    {s:{r:2,c:2},e:{r:2,c:3}},
    {s:{r:2,c:4},e:{r:2,c:5}},
    {s:{r:2,c:6},e:{r:2,c:8}},
    {s:{r:2,c:9},e:{r:2,c:10}},
    {s:{r:2,c:11},e:{r:2,c:14}},
    {s:{r:4,c:0},e:{r:4,c:4}},
    {s:{r:4,c:6},e:{r:4,c:10}},
    {s:{r:0,c:16},e:{r:0,c:17}}
  ];

  ws["!cols"]=[
    {wch:17.0},{wch:13.0},{wch:13.0},{wch:10.0},{wch:8.0},
    {wch:2.5},
    {wch:17.0},{wch:13.0},{wch:13.0},{wch:10.0},{wch:8.0},
    {wch:2.5},{wch:9.0},{wch:8.0},{wch:18.0},
    {wch:2.5},
    {wch:28.0},{wch:28.0}
  ];

  const thin={style:"thin",color:{rgb:"000000"}};
  const red={patternType:"solid",fgColor:{rgb:"FF0000"}};
  const paleRed={patternType:"solid",fgColor:{rgb:"F4CCCC"}};
  const normal={name:"Arial",sz:10,color:{rgb:"000000"}};
  const bold={name:"Arial",sz:10,bold:true,color:{rgb:"000000"}};

  function cell(ref,value,style){
    if(value!==undefined){
      const isNumber=typeof value==="number";
      ws[ref]={t:isNumber?"n":"s",v:value};
    } else if(!ws[ref]) {
      ws[ref]={t:"s",v:""};
    }
    ws[ref].s=style;
  }
  const base={
    font:normal,
    alignment:{horizontal:"center",vertical:"center",wrapText:false},
    border:{top:thin,bottom:thin,left:thin,right:thin}
  };

  // Main report grid A:O, including the blank template rows.
  for(let r=1;r<=templateBottom;r++){
    for(let c=1;c<=15;c++){
      const ref=String.fromCharCode(64+c)+r;
      cell(ref,undefined,base);
    }
  }

  // Titles.
  cell("A1",undefined,{font:{name:"Arial",sz:10,bold:true},alignment:{horizontal:"center",vertical:"center"}});
  cell("A2",undefined,{font:{name:"Arial",sz:10,bold:true},alignment:{horizontal:"center",vertical:"center"}});

  // Metadata row — merged blocks matching the reference template.
  const metaRefs=["A3","B3","C3","D3","E3","F3","G3","H3","I3","J3","K3","L3","M3","N3","O3"];
  ws["A3"]={t:"s",v:"From: 000"};
  ws["C3"]={t:"s",v:"To: 105"};
  ws["E3"]={t:"s",v:"TRA #8169"};
  ws["G3"]={t:"s",v:`BRAND: ${companyTemplate.brand}`};
  ws["J3"]={t:"s",v:`STO # ${sto}`};
  ws["L3"]={t:"s",v:`QTY: ${result.z.scannerTotal}`};
  for(const ref of metaRefs){
    ws[ref].s={font:bold,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};
  }
  // QTY is emphasized as the report total.
  ws["L3"].s={font:bold,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};
  ws["M3"].s={font:bold,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};

  // Section row and column header.
  for(let c=1;c<=15;c++){
    const ref=String.fromCharCode(64+c)+"5";
    ws[ref].s={font:bold,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};
  }
  for(let c=1;c<=15;c++){
    const ref=String.fromCharCode(64+c)+"6";
    ws[ref].s={font:bold,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};
  }

  // Data + total.
  for(let r=7;r<=totalRow;r++){
    for(let c=1;c<=15;c++){
      const ref=String.fromCharCode(64+c)+r;
      ws[ref].s={font:normal,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}};
    }
    for(const col of ["E","K","M","N"]){
      if(ws[col+r]) ws[col+r].s={...(ws[col+r].s||{}),numFmt:"0"};
    }
  }

  // Red fill only for non-zero Qty/UPC differences.
  for(let r=7;r<totalRow;r++){
    const qty=Number(ws["M"+r]?.v ?? 0);
    const upc=Number(ws["N"+r]?.v ?? 0);
    if(qty!==0){
      ws["M"+r].s={font:{name:"Arial",sz:10,bold:true,color:{rgb:"000000"}},fill:red,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin},numFmt:"0"};
    }
    if(upc!==0){
      ws["N"+r].s={font:{name:"Arial",sz:10,bold:true,color:{rgb:"000000"}},fill:red,alignment:{horizontal:"center",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin},numFmt:"0"};
    }
  }

  // Summary block Q:R, aligned like the reference screenshot.
  const summary=[
    ["PAIRING SUMMARY",""],
    ["RECEIVING STATUS",result.z.status],
    ["TOTAL BARCODES",result.z.totalItems],
    ["MATCHED",result.z.matched],
    ["QTY DIFFERENCE",result.z.qtyDifference],
    ["UPC DIFFERENCE",0],
    ["MISSING IN SCANNER",result.z.missingScanner],
    ["MISSING IN BXI",result.z.missingBxi],
    ["DUPLICATE SCANNER",result.z.duplicateScanner],
    ["DUPLICATE BXI",result.z.duplicateBxi],
    ["BARCODE FORMAT WARNING",result.z.barcodeWarning],
    ["SCANNER TOTAL",result.z.scannerTotal],
    ["BXI TOTAL",result.z.bxiTotal],
    ["TOTAL QTY DIFFERENCE",result.z.scannerTotal-result.z.bxiTotal]
  ];

  for(let i=0;i<summary.length;i++){
    const r=i+1;
    cell("Q"+r,summary[i][0],{font:{name:"Arial",sz:10,bold:i===0},alignment:{horizontal:"left",vertical:"center"},border:{top:thin,bottom:thin,left:thin,right:thin}});
    cell("R"+r,summary[i][1],{
      font:{name:"Arial",sz:10,bold:i===0||i===1},
      alignment:{horizontal:"right",vertical:"center"},
      border:{top:thin,bottom:thin,left:thin,right:thin},
      ...(typeof summary[i][1]==="number"?{numFmt:"0"}:{})
    });
  }

  ws["!merges"].push({s:{r:0,c:16},e:{r:0,c:17}});
  // Extend the worksheet range so Q:R summary is preserved in the XLSX file.
  ws["!ref"] = `A1:R${Math.max(templateBottom,14)}`;

  if(result.z.status!=="RECEIVING VERIFIED"){
    ws["R2"].s={
      font:{name:"Arial",sz:10,bold:true,color:{rgb:"000000"}},
      fill:paleRed,
      alignment:{horizontal:"right",vertical:"center"},
      border:{top:thin,bottom:thin,left:thin,right:thin}
    };
  }

  // Reference row heights.
  ws["!rows"]=[];
  ws["!rows"][0]={hpt:18};
  ws["!rows"][1]={hpt:18};
  ws["!rows"][2]={hpt:18};
  ws["!rows"][3]={hpt:18};
  ws["!rows"][4]={hpt:18};
  ws["!rows"][5]={hpt:20};
  for(let r=6;r<templateBottom;r++) ws["!rows"][r]={hpt:18};

  ws["!freeze"]={xSplit:0,ySplit:6};

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"RESULT");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(scanner.rawRows),"SCANNER");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bxi.rawRows),"BXI");
  return XLSX.write(wb,{bookType:"xlsx",type:"buffer",cellStyles:true});
}

function send(res,code,headers,body){
  const h={"Permissions-Policy":"loopback-network=(self)",...headers};
  res.writeHead(code,h);
  res.end(body);
}
function serveStatic(req,res){
  const pathname=req.url.split("?")[0];
  const files={"/": "index.html","/index.html":"index.html","/app.js":"app.js","/styles.css":"styles.css"};
  const file=files[pathname];
  if(!file) return false;
  const full=path.join(WEB,file);
  const type=file.endsWith(".html")?"text/html; charset=utf-8":file.endsWith(".js")?"application/javascript; charset=utf-8":"text/css; charset=utf-8";
  send(res,200,{"Content-Type":type},fs.readFileSync(full));
  return true;
}

const ALLOWED_RENDER_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*onrender\.com$/i;

function allowedOrigin(origin){
  if(!origin) return "*";
  if(origin === "http://localhost:3034" || origin === "http://127.0.0.1:3034") return origin;
  return ALLOWED_RENDER_ORIGIN.test(origin) ? origin : "";
}

function corsHeaders(req){
  const origin=allowedOrigin(req.headers.origin || "");
  const h={
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Expose-Headers":"X-Scanner-File,X-BXI-File,X-Pairing-Summary"
  };
  if(origin) h["Access-Control-Allow-Origin"]=origin;
  return {origin,h};
}

const server=http.createServer((req,res)=>{
  const {origin,h}=corsHeaders(req);
  const send=(code,headers,body)=>{res.writeHead(code,{...h,...headers});res.end(body)};
  if(req.method==="OPTIONS") return send(origin?204:403,{},"");
  if(!origin) return send(403,{"Content-Type":"application/json; charset=utf-8"},JSON.stringify({error:"Origin is not allowed."}));
  if(req.method==="GET" && req.url.split("?")[0]==="/health") {
    return send(200,{"Content-Type":"application/json; charset=utf-8"},JSON.stringify({ok:true,version:"2.0.0",agent:true}));
  }
  if(req.method==="POST" && req.url.split("?")[0]==="/pair"){
    let body="";
    req.on("data",chunk=>body+=chunk);
    req.on("end",()=>{
      try{
        const input=JSON.parse(body||"{}"),store=text(input.store),sto=text(input.sto);
        if(!ALLOWED_STORES.has(store)) throw Error(`STORE ${store} is not configured.`);
        if(!/^[0-9]+$/.test(sto)) throw Error("Invalid STO#.");
        const desktop=path.join(os.homedir(),"Desktop"),sd=path.join(desktop,"Scanner"),bd=path.join(desktop,"BXI");
        const sf=findFile(sd,store,sto,[".csv",".txt"]),bf=findFile(bd,store,sto,[".xlsx",".xls"]);
        if(!sf&&!bf) throw Error(`No matching files found.\nScanner: ${sd}\nBXI: ${bd}`);
        if(!sf) throw Error(`Scanner file not found for STORE ${store}, STO# ${sto}.\nFolder: ${sd}`);
        if(!bf) throw Error(`BXI file not found for STORE ${store}, STO# ${sto}.\nFolder: ${bd}`);
        const si=fileInfo(sf),bi=fileInfo(bf);
        if(!si||!bi||si.store!==bi.store||si.sto!==bi.sto) throw Error("Scanner/BXI filename validation failed.");
        const scanner=readScanner(path.join(sd,sf)),bxi=readBxi(path.join(bd,bf)),result=pair(bxi,scanner);
        const buffer=makeWorkbook(result,scanner,bxi,store,sto);
        const summary=`STORE ${store} • STO# ${sto} • ${result.z.totalItems} barcodes • ${result.z.status}`;
        return send(200,{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${store}_STO#${sto}.xlsx"`,"X-Scanner-File":encodeURIComponent(sf),"X-BXI-File":encodeURIComponent(bf),"X-Pairing-Summary":encodeURIComponent(summary),"Content-Length":buffer.length},buffer);
      }catch(e){return send(400,{"Content-Type":"application/json; charset=utf-8"},JSON.stringify({error:e.message||String(e)}));}
    });
    return;
  }
  send(404,{"Content-Type":"text/plain; charset=utf-8"},"Not found");
});

server.on("error",err=>{console.error("SERVER ERROR:",err);});
server.listen(PORT,"127.0.0.1",()=>console.log(`ECOM ICS Local Agent running at http://127.0.0.1:${PORT}`));
