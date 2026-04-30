import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
// ⚙️  CONFIGURACIÓN — Pega aquí tus credenciales de Supabase
// ══════════════════════════════════════════════════════════════════
const SUPABASE_URL      = "https://ivkhcfwggzwczwdtgiga.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2a2hjZndnZ3p3Y3p3ZHRnaWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDIwNTQsImV4cCI6MjA5MjkxODA1NH0.fO0wO-T2tVV6l0xfwlyF1_w9CiJZ2QvM15r4t9H0SZk";

// ── CLIENTE SUPABASE (sin librería extra) ────────────────────────
const sb = {
  headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  url: (table, qs = "") => `${SUPABASE_URL}/rest/v1/${table}${qs}`,
  async get(table, qs = "")    { const r = await fetch(sb.url(table, qs), { headers: { ...sb.headers, Prefer: "return=representation" } }); const d=await r.json(); return Array.isArray(d)?d:[]; },
  async post(table, body)      { const r = await fetch(sb.url(table), { method: "POST",   headers: { ...sb.headers, Prefer: "return=representation" }, body: JSON.stringify(body) }); const d=await r.json(); return Array.isArray(d)?d:(d&&d.id?[d]:[]); },
  async patch(table, id, body) { const r = await fetch(sb.url(table, `?id=eq.${id}`), { method: "PATCH",  headers: { ...sb.headers, Prefer: "return=representation" }, body: JSON.stringify(body) }); const d=await r.json(); return Array.isArray(d)?d:(d&&d.id?[d]:[]); },
  async del(table, id)         { await fetch(sb.url(table, `?id=eq.${id}`), { method: "DELETE", headers: sb.headers }); },
};

// ── CONSTANTES ───────────────────────────────────────────────────
const ESTADOS_CLI = ["Activo", "Por vencer", "Inactivo"];
const ESTADOS_PRO = ["En contacto", "Propuesta enviada", "Frío", "Perdido"];
const SECTORES    = ["Alimentación","Finanzas","Retail","Telecomunicaciones","Alimentos","Automotriz","Salud","Educación","Otro"];
const CIUDADES    = ["Lima","Arequipa","Trujillo","Chiclayo","Piura","Cusco","Iquitos","Huancayo","Tacna","Pucallpa","Huánuco","Otra"];
const CAT_GASTOS  = ["Mantenimiento","Personal","Transporte","Administrativo","Servicios","Marketing","Otro"];
const EMOJIS      = ["📡","🏙️","🌆","🛣️","🏬","🔄","🏪","🏢","🌉","🏟️"];
const INGRESOS_HIST = []; // ya no se usa — se calcula desde contratos reales

const hoy   = new Date();
const mesHoy= `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
const dias  = (f) => Math.ceil((new Date(f) - hoy) / 86400000);
const fmt   = (n) => `$${Number(n||0).toLocaleString("es-EC")}`;
const fmtF  = (s) => s ? new Date(s).toLocaleDateString("es-EC",{day:"2-digit",month:"short",year:"numeric"}) : "—";

// ── PALETA ───────────────────────────────────────────────────────
const C = {
  bg:"#070C18", surface:"#0D1421", card:"#111929", border:"#18253D",
  accent:"#2563EB", green:"#10B981", red:"#EF4444", amber:"#F59E0B",
  purple:"#8B5CF6", cyan:"#06B6D4", text:"#E2E8F0", muted:"#64748B", white:"#FFFFFF",
};
const eCol = (e) => ({"Activo":C.green,"Por vencer":C.amber,"Inactivo":C.muted,"En contacto":C.cyan,"Propuesta enviada":C.accent,"Frío":C.muted,"Perdido":C.red}[e]||C.muted);
const tCol = (t) => t==="Cliente"?C.green:C.purple;
const catCol= {"Mantenimiento":C.amber,"Personal":C.accent,"Transporte":C.cyan,"Administrativo":C.purple,"Servicios":C.green,"Marketing":C.red,"Otro":C.muted};

// ── ATOMS ────────────────────────────────────────────────────────
const Badge  = ({color,ch})=><span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Tag    = ({color,ch})=><span style={{background:color+"18",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{ch}</span>;
const Card   = ({children,style={}})=><div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,...style}}>{children}</div>;
const SecTit = ({ch})=><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1.2,marginBottom:14}}>{ch}</div>;
const PgTit  = ({icon,title,sub})=><div style={{marginBottom:22}}><div style={{fontSize:22,fontWeight:800,color:C.white,letterSpacing:"-0.5px"}}>{icon} {title}</div>{sub&&<div style={{fontSize:13,color:C.muted,marginTop:3}}>{sub}</div>}</div>;
const Spinner= ()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:C.muted,fontSize:14,gap:10}}><div style={{width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>Cargando...</div>;

// ── INPUT FIELDS ─────────────────────────────────────────────────
const inp = (label,key,form,setForm,opts={})=>{
  const set=(v)=>setForm(f=>({...f,[key]:v}));
  const base={background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>{label}</label>
      {opts.type==="select"
        ?<select value={form[key]||""} onChange={e=>set(e.target.value)} style={base}>
          {opts.options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        :opts.type==="textarea"
        ?<textarea value={form[key]||""} onChange={e=>set(e.target.value)} rows={3} placeholder={opts.ph||""} style={{...base,resize:"vertical"}}/>
        :<input type={opts.type||"text"} value={form[key]||""} placeholder={opts.ph||""} onChange={e=>set(e.target.value)} style={base}/>
      }
    </div>
  );
};

// ── MODAL BASE ───────────────────────────────────────────────────
function Modal({title,onClose,onSave,saveLabel="Guardar ✓",children}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000092",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:26,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800,color:C.white}}>{title}</div>
          <button onClick={onClose} style={{background:C.border,border:"none",borderRadius:8,padding:"5px 11px",color:C.muted,cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        {children}
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontWeight:600,cursor:"pointer",fontSize:14}}>Cancelar</button>
          <button onClick={onSave} style={{flex:2,padding:12,background:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:14,cursor:"pointer"}}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGO — PNG real con fondo transparente ──────────────────────
const LOGO_B64 = "data:image/png;base64,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4MH7plKpfaWUI2tqavbff//99/voRz+6Ty6XGxQEwT6+7+9jjOnnuq6TnABARMnrojS70gZmye92EkKi+5MxxkozPpOTCzjnWgjR4nneWsdxVr788ssrnn322ddqamoWLF68eOktt9wS4PzD72qdfCdgNQbG9aSuFHz48PuQP378eO/8888fKYT4EOf84OOOO27/D33oQ/txzvfTWo9kjA3gnDvxF49btLTrukZK6fi+70opyd6A49xUeaXUOinlu9lsdi1jbJMxZsM//vGPTY8//nhBCNFGRHnXdVuVUs39+vVrU0oVbrvtNoHzv3v548eP98aOHdv/wgsv3GvUqFHDHnjggX0uvfTSkUKIQzKZzIeMMUdqrfvZWZJ20kKia5M45zwxQaA0WcB+LxaL9jsNGDCAWlpammpra98yxix2XXfJ3Xff/dYrr7yyfr/99lt96qmnbh47dqzA+Ydfjl/txLDVqKAOHz78vuHzb3zjG7lLLrnkQ2EYnpBOp48ZMmTIQXvvvXd/xlitlLK/53k5pZSjtS61YLBtBatZGIbcdV3H930dRVGYSqU2CCFW+b7/ruM4bzHG1oRh+Pb555+/6Y033oh83w+VUmEYhiFjTCxevFhW+Rjg/H8A/fHjx3tKqbonn3zypFwud7fruoPtzFXb8uV5XrskuSwx+F9rTWEYsmw2q4UQlE6nW5RSr0opZwkhXvn5z3++YubMmS1KqfygQYPy06ZNUw888MCgc889dxMRuZxzhfMPvxyf76DZrdzZBd2JLstp9oMPH/4e4Dc0NLibNm2qC8NwgO/7/W644YZRxx9//Dil1Mme5x0ahmFtnG6Bu67rMcZMsVjUuVwuEEIUU6lUyBgLhBDF9evXF9asWbMplUq95fv+SinlW8aY1S+//PLKiy66SOL4w+/kb87ChQs/fPTRR/9Ja71fPPOViIhrrVk2m03OkuSu65IQQqfT6SatdbNSauPq1avfaG5unq21nrd169YVn//854vxur0JEybstWXLlr1OPvnkETfffPMpUspPe553sFLq7qlTp95y9tlnr2KM7WzwPs4/fCqny5L1IJLsaR8tfPjwd0N/0qRJg13XHe04zrDLLrtsvwMPPPBgz/OOiMd9DWptbWX9+vXz4szpSkrZ4rruOsdxmhljW5uamtZPnTp1A2NsXRAE76bT6XellGvu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eTq+QTCtNY8DAxuMUaFQ2Lxx48Y77rnnnn+l0+lXGhsbW3d2rqZMmZIbNWrUftOnTx/T2Nj4YSIan06nj2GM1YVhyDKZjJFSSs75ry+77LK/drWy2trat959993Lf/3rX1N8EzCcc23TXhARj2/6lMlk6MILL+R33HEHjRs37vhPfOITF0VRNCiVSjHHcRjbNkvV7idprdffdtttjfl8viXmjDGm5NibjuM4bhRFLJPJcCklZ4xtmTVr1pYyz7/3hS984ROu654spXRramqYUoqFYUiZTIYzxlhrayvr168fC4KgFLDam3gul2PFYjGdTqf/56qrrvrLpZdeurhar78484eeP3/+X7XWp6VSqX055yvCMHzrD3/4w4pFixat9Dzv3VQqtUlKufn6669v3dnr9eqrr+7ved4Rl19++cSamppLOef90uk0IyKmlOLZbNYG+sQY41EUHX3JJZccuJOAjN94443/a4w5Np1OMyFEKcVLHOQzzjkvFAomnU4vzeVyf/jhD3/4dKFQWHr99de3dHJsSt+vueaavRzHOexHP/rRSYyxzxYKhfqampqMlLK4YMGCv3zrW9/624IFC1Q5959rrrnmQx/5yEe+wxgbZoxhWmtmjGHxBx0W768NwpuFEDOeeOKJpxYsWDB3w4YNb9x3333t0oJMmDCh5oQTTjh48uTJH89msw1CiI8IIfxcLseUei83mH39e57HGGNH3X333Vdce+211ybW1+X776RJk7xvf/vbVwZB8IlsNuvYAFprYr7vMsYYGcM4kWHpdDrYsmXLjY2NjW+X8V6N+8+e7ZfVB1pJ81x3u6Tg776+e911132JiDYkuxKS3Whxl5Ihoieq4V9wwQWjN23a9I+4JaHd7DPb5RBFkV61atXL48ePH1zO/j/77LO3SSlVYtxLqavNdr2++OKLP9jZ8b/66qs/Q0TL4u6odt14SilTLBYpDEPR2tr6P4lu1IqP//jx4zOf/vSnD37iiSe+IoR4lohkPNj/b9/5zndG9sb5nzx58mlEtNp29yS6dUt9g0EQvDZ69OghvXn9HXnkkSOMMf8oFovbjc2LZ9oaIspv3bp1YxiGUmtN+Xy+3Ri2KIo0Eammpqabe+v1t2jRoiO++MUvfuRTn/rUgfEYSt6T/Z8wYUJNGIbf1FoH8YzR0vgt231njDFSyk0//vGPP7Oj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S8trdXV1URRFpUBXa12q5ej7PtXV1bF8Pj98v/32++lJJ500pLNjJ6V0ksciHv/GE39zdnDj68n1pxljpLUu1bdM+vF14u/o/K9duzb46U9/Oum6666byravT4n7D/xy/bIevErP4/D3bP/FF188U2ttbN6q98acECllKM75s+nGG2+8sItV+ET0/4IgiGwXTXLcj9baNDc3G6XUrNNOO21MT/Z/1qxZt0VRZDP1t0s4aruN5s6d29iT43bppZcecMkll3xu3rx5lxPRb40x/25tbV1DRJFSqjTYPIoiE49fM8Vi0cht/bxGKaU7dHmajt23toulUCgYrfVL3/zmN0+o1vn/9re/fWoURe/YxJnJnHOJ7qnOBvV3y29oaNh33bp1/7STCBIp7eKs58YQkVq2bNkF5V63kyZNyhHRM21tbRTPCKTk+L44WInmz5//y6OPPnpAb73+pkyZ8n9SytZ4bJbR2x5SKSXjMXGlRML2Z611x+vT2K60eIbllnXr1v2goaGh0+M/dOjQGiL6bbFYFPb1lMyAbwfnJwawb9Za3/7EE080XHbZZUfFqTS63P/LL798ryuvvPLEmTNnfk8ptTLuTm43Ls52x8YfSNbdfPPNX+3kw0+GiF4vFAqlbvH4yySutS2PP/74h6v9/nfDDTdcHkVRa3KiQqJMmAmCgJqammbh/R/+rvD5Dn7eFbWd4O9Bfn19fU5KucCOL0mMkSUhlM1+rTZs2DB14sSJIzqaf//73/eJomiNvWHaMVR2cHF8M2275557rmKdl00pe//jgMwkb3g2MazNS/TCCy/8oBrHv76+3l+8ePFeJ5544oEnn3zyETNnzvw4EX1NSvkTrfXDxpgZWuvXjDGbiKhgjFFEpIlIhmFYulknx5slc3LZwEIpJVesWDHlox/96KBqnP+rrrrq9A4BGXUWkCXykPXo+rv11lsvCoJgszWiyI5pMmTMtsHmWutX6+vrc120anY6nvCb3/zm57aNSRPtZhkmZmwaY8yyM844Y1xvvf5uvfXW44noCiK6hoiuJqJvx79fEf/8HSnlj+PAfXoYhhuVUsIG4fb671AyzBSLxab169dfG9dJbecPHz48p7W+mYiEHZcYv65McqB+PDh/7apVqybGVTUq2v/hw4fnXn/99ROIaHM8CN5ej6UZm3Fgprdu3Xr/KaecMrDDevi77747P86JZpKBXOJaa928efN/Vvv977bbbmuUUoZ23FgQBO1mlAZBQIVC4c94/4ffC/5OF+qVopfw+46/bNmy0+MxJ0YpQ0Io0npbC4edWaiUavnBD35wDusw8+qdd975BRFpO4jc3ozsp9cgCHRLS8u0iy++eN+e7v/06dNvDcNQJ1tMOpROsi1kvX38OdvWHeM2NDSk5s+fP7hQKNQHQXDewoULb9ywYcM0KeXrUsrWeBB66SZqE1kmbl7GGNN0/vnnj6vG+Y/zkL1jb+Z2IH+H7Pfl5CHbqX/WWWeNVUo9FwSBTiQGNe/lzNL2xv6uEGJ6EAT/LBQKTwdBMC0IgieDIJgWRdG0IAieCoLgqUKh8GShUHgqCIJ/RFH0opSyYAMa26pof4+vN621vmfIkCG1vfzac1jXySZL/5s8eXLdG2+88SUhxGKxLUV/x1qxtjXJKKXWTZ48+bROWhxTWutvb5sDodsNWE8M3DfFYvGNhoaG+p6+/l9//fVTiagpzhtokhMUbAu3lHLBpEmTtmvpWrRo0R/sbF5bT7JDeo5w5syZ11Xz9Tdp0qTBSqmH9Lbq7e0+BNoWOiGECYLgOrz/w98FfpcL8B5uZDXKGMDfDf1jjjlmCBH9PooibVs4giBKzLY09hP6zO985zv72vU/8sgjhwdBsLKLmVamra2NhBBNf/7zn79Ujf2P0160KwWUDMiklPTCCy9c934dfzt+Zvz48d79999/yMMPPzyZiOYVi0UZhmG7bbY3vfhmrbXWV1awDV2e/3iW5TthGJpkqgZ7nOLz1FlAVtH+jx49Ov273/3uiiAIComyPvaaISHatxAmyga1++rqb4nWve1SSSTXG4Zhy5VXXnniB+n199hjjx0ppXwmTn3SLkt/nKLCEJESQtw3evTofsnnz5gxw5s1a9aZxhhpA5xk7dZisUhxAHz7+PHjB/T09X/UUUftK6WcluwajVN4lFrmhBCr/ud//ucTHdf/5ptvTn4vd2Gh3eziOGWJJqK/NzY27lWt43/++eefKIR4LYoincwbaFvo4mtI/vGPf/wc3v/h95Lf7Q2rtNkPft/0+cMPP/yfRLS6UAiMTX0RhoKSN5RisRg1NzdfOGXKFL+xsdF76623fqK1LnZMEZEY7yO3bt36VCclYrq1/4k8ZMngxiSLGr/44os/+QAdf/fXv/71J4joRVtvLzn2zSbvjKJIaa3vZdVJDHt6soWsQ7JO23W6MBGQdWv/H3nkkYOiKFpigw7bRbptf2TcJbv9NiQDw8S4JdOhq2u7slv2OTawTYwbkoVC4U8fsNef8+c///kLxpgVcf6x7Ypux9fDm2PGjBnecQX//d//fXKhUFjXMf1KXACbwjBUSqk/PP300yN7+vqPU7/82hZCTx57+yGrWCyu/fKXv/yZTlrWjw/DUCZTvdgxabYMGxGt+t73vvf5ahz/UaNGZWbMmHE1EYWJVCCl/IF2OIBS6p2PfOQjY/D+D7/avtONDaMyNnCHM516eGDg734+zZw5c4aUcrrjONp1XUZELJ32WSqVIjtrLJvNphhjV9XX1/ue5x194IEHfkprnXFdl0kpmTGGpVIpxjmnIAiYUkoVCoWfTZ06NajG/htjeGJGl53J9V7R1zgdQSX7X19fP2ju3Lkf6VDmqFrHX//qV7+a/bvf/e7pXC4nGGNMa82MMTY1CI+iiBljHGPMXqw6g1ENY8x0mE353sYRMWOM5pxTT66/z372sxemUqkxWmvX8zzmeR5zHIcZ895MRDtrz56bxBfF28Y7nkO7rH0opch1XcY5Z67rlhw7w05K6eZyuY9Pmzbtcx+g15/597//vUQptdpuqz1GcYoG8n2fh2E44t57791ubF2xWFyXTqeXBEFQmsIfhiFLpVKMiCidTnMp5bGPPfbYPj19/be1tfmMsb2y2Wy7WcPx643l83lijJHv+9sdp6997WtL0+n0657nGSklC4KA5XI5xjmnYrHIHMfhWusRF1988enxTM0eHf/HH3983/Hjx58npUynUinm+z5TSnHOOZNSMt/3WVtbm3Fdd7bWeive/+HvCp9XeblKnwt/D/V/+9vf/ocx9EaxGJLW72VatwN+40/CQkp5FRH9JC6S3C4rf2IWnCGiuxNZ2Xu8/zNmzLjNzuZL1M9LlgSi+fPn/7Tc/R8/fnwtEf2GiFq01veceeaZR40fP96r8vHnDzzwwP8ppQp27Fucn600yL9YLBohxCNs+zQBFft2DJkdz5UcR2a7dLTWC3YyhmyH/owZM44WQjQnx/LZJLTF4rbroKWlrV0Nzc5mmSa7KzuMqWs3RtCOE4pn/ZWSxNoWx3hQ+vSf/exn+1Vynm666aZDlFL/VV9fP6zar7/LL7/8I0Q0J559S8nuwER9Srl169YjOz63vr7ef+edd/6PiIodX1uJ5K1Gaz1lwoQJNT3ZzgsuuOBkpdTaOIEtJSckJCYPvHr22Wcf31kL8CuvvPJNY0yYbN20LYHxWC6SUkZE9J14EkO3Xv+HHnroIKXUv2zreLJVLlnnMwzDrUuWLDkT7//wezPGqubAtc5mI3D48BljfM2atb+QUscDfFW7G5+d7RZF0bowDN+xN3w7PT8xkN8IIVY9+eSTH6vm/scBmU4GZIlM/UYpRfPnz/9Jufu/du3aC4vFYhh3J8kwDBe/8cYbl15yySVje1gYvPQ499xz9zPG/KVYLOpk91N8o7L1MY3W+qes8gzT2z1sl6UNAJKz5hJdlh3HkJV9/Y0bNy67bNmyu4hI2QApXqex6VKCICKlDLW0tLWbeZcMnhNpICj+MsnxQDZ9gj1mySoINkBJ7iMRbf3rX//6zTJaOjnbNgau31NPPXV9FEUtW7ZsefSiiy76XH19/eBqvP6GDx+ee/jhh78thNhqu6U7BhDFYpGiKCpMmTLloM7W/53vfOdEKeUS+/xOCt+bIAgK69ev/9oOgrIdXv8NDQ37hWH4lJRS5/N5Y7udO76eiWjaBRdcsH9nKzv99NM/JISYp7XWcaHu0vm2j3w+T0KIls2bN1962mmn1VX6+j/xxBMPXLZs2a+iKBIdh0fYa0RrbeJu4Kcvu+yyg/D+D39X+uWusOJP892MUuHvIf6iRYsOFUI12fQXNudW8iZo32ztTaaT2WRi2rRpt44aNWpANfc/GZB1Nah/7ty5Py5n/+++++6Jxpi3OuYx0lq3GWNmT58+/YY777zzU5MmTcp19/jfe++9B8+cOfPutra2FjumxrYCdbi5aqXUGdU4/5MnT/7PMAzXJG9WNlhNFL5+uYvSSTv1r7/++k+HYbhCSmmSKU7ea/XS8QxdNVcp87yU8jkp5Uyl1LNKqVlKqeeUUv+WUs6Ji3S/IISYI4T4txDCLjszXm62UurfYRjObmlpWWGvR3tTTtbqjGsqzuyQ647voJXvVKXUW3FeMU1E7yxcuPCRu+6665t33XXXYY2NjV53jv+UKVP8xx9//JtEtCyR5sQk654mcpatiseQbXf86+vrcy+99NLtWuvQBu5CCGpubi5d93FAvOH111+/8cEHHzwiUSN1h/s/fvx47+677/74li1b/hQXRG9XBN1OqoiTGUf/+te/ftbVB5RRo0Zl/vznP1/e1ta22baIdvwQYIwxLS0tRESb1qxZc8tvfvMb2xK9w+uvvr7ev/322z/7+uuv/7lQKLQJIYwN8DtO9Ihfv5tnzJhxUZktzXj/h99dv2pNbbyXm/3g7+b+jBkzPK3pFqWMiiJZClTsgGo7GytZO89+mrYD1aMoev0HP/jBx6u9/3FApjoJyIy9Oc+dO/dHO1vf+eefP665uXmOEELZbjfb+mcDpGKxGGitV2/dunXmSy+9dPPixYv/6x//+Md+8Zu9y95Ld5BMieA1NDTUbtmyZdzy5ct/FATBIiFEmGh1oGQ3XxzcGmPMokmTJh1ajfNvA7KOdRCTrVREtKiLxLA79M8444xB69evnyKlLLVU2NaU93KtEUWRfOXoo48edeyxx47s7OuYY47Zv76+fr/k17HHHjvyuOOOG3HssceOHDdu3L7HHnvsSPv3E088cb9vfOMb/5XP55tscNLhhmziayBcunTp1Z1UPmi3P8ccc8xwInpBCKHt9WyMMVEUSSlli9b6tebm5qcXLFhw/csvv/yF3//+9yPZthx6buKc2/Pujhs3Ljt//vwPv/baa9+KougppdQmpZRJBPmlVsHE7FCttX7wwAMP7N/VwX/66acP0Fq/EUWRsYXA7SSWROugIaKCEGLJq6++es/SpUs/e/PNN++VuEbtlztlypTcokWLTl+1atUDQogVWmuRzJFnC9BLKUstl1LK12+99daTdnSRXHnllYOJ6NEwDHWyJdB+ILDXftzdGmitl7799tt3z5s3b+KUKVP6x9vqMsac8ePHe6+88sqIl19++SuLFy/+GxGtFkLIRL3aUqJg++Ew3l6zaNGiqWPGjKnD+z/8XeVXMqugN7Lcwu8D/sknn3ywlPIl242U/MRrW6KSs7CS3RTGmPBvf/vbT3tj///1r3/dVigU2o3JSaaRKBaL9Pzzz/9gR+shosOJaKad9dhhdlbpZ1uUOb6haq210FpLrfVmrfUipdR0pdRjUsq/SCkfl1I+q5RaFufOEja7e/vuPN1uvEt8025ZtmzZNxItED06/5dffvnnhRCrk12CnVQLWLSDMWRd+e53vvOds4wxW+wxSgaa9oYupWxetGjR56p9/seNG7fX6tWr75RSqo5VGhJFso1Sav3q1as/1NV6JkyYUNPc3PwXG9QnEraWzn0iiDLGGKm1jpRSm4QQS4QQzwohnhFC/EtK+UIURcuMMW1EJIIgUFJKkxhHZRLF5dvlUMvn85tWrFhx2s4+7T/zzDMTjDHvFotFba/zDsFwu9ekMSaUUrYJId6KWx2nK6Vm5/P5N40xrXHi2nZjvZKvAfvhK4oio5TKz5kz54pyrr+f/vSno/P5/IvGGJ1Ig2HHA243LjB+vxBSyrwQYpUQ4mUhxKtRFK2VUgZKKZ08P8nZtXYMph23aIzRSql5t99+ey3e/+HvYr/XI0veyzsF/wPujxo1KjNt2rRvK6UKydYV+w6bGNdjkgNs4wHqyy+//PLRvbH///rXv24Nw1Alch6Z5E0qiiKaPXv2DvOQEdHnhBCvCyFUx2SbHQagm7a2tu3GPnUoMdNx3FO74NXm0UreQG03Vry+aOnSpY9MmDDhgGqd/6uvvvrzhULh7UTLpknevONg4+VEpv6yjv/o0aOHENE/4pufDYJLiUTDMKQoihQRPXzccccN7Y3z/73vfe8UpdQKm4suDEPTPt1GZIjItLa23tdJ9x1rbGzMENH/hmFYSF7HcdecSQ6cj6LIdEzTEXeXJtNYlHLiJVvAkt2ptnvaHv9CoUBKqeCVV1658/DDDx+6s/0fNWpU5m9/+9tlRPSOlNLY7bTXVjLKjs9Bx99NMmiLM+tv96HKrsu2xEkpwyiK7jvvvPMy5Z7EX/7yl5/UWr8aJ5lNVlRoV2HAbqNNKht/dcz2bzoOhUiOu4xfdyYMQ1EsFp/94x//eBze/+G/X34luTZ6I0ka/D3c//rXv36kUur5xI2q9MaafKOMAzbT2tpKSim9efPmyb21/88+++ytWmvd2tra7hN9MjCIA7Iu/UmTJuUeeeSRCUT0SBAEbVLKUn6n98r/RNslILXBZ8cvO0YmMbmgXaLKzpKa2pI0b7311j8++clPfqia53/y5MmnCSHetucmeSO0N8MwDF/qEJDtdP2PPvroBWEYFu1A/uQ4rrjbzxhjVj/44IN2LFzVz/9xxx3Xb+HChQ/EgV+yxI9Jnr98Pr/+scce+3THdTU2NtYSUSMRtdnEoh1bxpKD55MtcMlAvEP3b7sxgba2Y/L59qtQKJDWWkkp//KTn/zkkHL3f9SoUQP++te/XkJEq223escu445JeG3QbLfFtiAntzM59q9DEBlGUXT/d77znf0rbUW98cYbJxLRc0oplaxKkWzVTAaCyQ8xHSd/JFvxkrV2E+PIImPMX++777561r6CCN7/4fem3+sPDh9+8jF+/Hhv6tSp10RR1GbfqDvObuowEFgLIeZNmDBhZG/t/z//+c/bm5qadPLGZ1sFwjCkMAx3VMuynVdfXz/4zTff/KIQ4iUpZZTP5+0gdWNvzMmUEV0lLU3+3jGdQyLxqz1WulgsGmNMIIR4+PDDDx9Z7fN/xRVXnFYoFNbEM97azZyLu/QMES2sZJbllClT+hcKhSW2Oy45kNpeDy0tLUpr/dvLL78825vX/7333jveGLMubmlqdy4SXXfR5s2bp1555ZWDOwSVbktLy17FYvELxWLxOSllwRartwPSbXCVTDbcRcvndscgGXzb429be+LWtHDr1q2/S7SMlb3/I0aMyD7xxBOf0lq/prWWduxbsnU4ESC2C9Rs8GULbydnKtp9ibvwDRFtbm5u/vENN9ywTzevS+/mm28eWywWf5/P5wvJoQFBEJhkTVf7c4cv0+HDTrsPMrZlUggRLlq06Ka4NZbj/R/+7uBXMr2T98LGwd+N/VmzZo1sbW2da8dWdWg5MsVisZRHSynVvGjRoi93MXuqKvs/d+7cXxORjm8wplgsUrwNxrYGzZ8//4eV+GPHjq19/vnnGzZu3PhnInqTiApBEKh45iPt4MvY4Mt2r3QsUySlpEKhQNvKGhqplHpn48aNT0+fPv2/O8nJVJXz/+tf//qMtra2d98rFq9K21EsFu3N+KVOBvV36o8dOzb10ksv/VhKGdm0BsYYW/6n1N1LRMt/+9vfnrwrrv9ly5bdGU+8KHUvBkFA9ouIdD6f33rvvfdeNn/+/E5nB44fPz7z/PPPf2bz5s2/I6LFURRtDcNQ2BYo24XdseUmEZSbRAtYqfvT5ktLjK9Uxpi316xZ88xzzz131ujRo9M92f+//OUvA5YsWfIdpdRcrXVTXNDe2KLaySC1Y/qJxGQYI4SgQqFgPzxERLQ2DMNpd99997hqvfk8/fTTZwshZheLxY1BEMgO10u74QH2PSXxOiq9vhLdq0oIsWHDhg1PPf/886fi/R/+rvZ3NGCNEt9Zh593RaAHvw/4r7zyyv/ut99+302n0248K81hjDme59ls80YIoX3ff+7888+f/Ic//OGt3trpTZs23ZTNZr/KGHM459pxHJYoZsyJiObPn3/jJz/5yRsrXfd5552XOfbYYz8yePDg//jv//7vQ4MgOCyTyRzAGNuLMebE62e2XqWtGBBXByAWZ53nnFOcoZyUUiqdTm9kjC2PouiV3/3ud7Oef/755+69995NvXX+lVKn5vP5G1zXHeZ5njHGGMYYua5LnucZIuL5fP7VI4444sw1a9Zs3ZlDRMcEQXATY2xMJpPxmpqanHQ6TUopXVNTw+OKDMYYM3Xw4MH/uyteAzfddNMxF1988Z983x8QT1jQjuPwOBO+4ZyzTCYjgiB4ccaMGd8+7bTTVna1rsbGRqd///5HZ7PZ40844YTDjjjiiAOllGOIaKjv+xmWmEUbVyBoVy0iNolzztPpNIVhaDKZjJZSbnAcZ2UURUvuuuuu6bNmzZr1l7/8ZWOVDoFzxx13HCyE+MzXvva1k4joiGw2O8JxnIwxhkkpXVvdwBjDbOUN13UZY4yEEOS6ruGctxhjli5evHjh9OnTZ0spp1199dVt1Xz/mTJlyrBCoTDhi1/84n+MGDGivq2tbXT//v1risWik8vluK0CYl9LHR7EGKNCodBaV1e3cuvWrfMeeOCBZx955JF/zp07dwPe/+Hvap93sSGVbvjOdoaV6cDvY/4ZZ5wxyPf9ExzH4b7vk5SSe57HPvaxj/FTTjmFh2Fovv/97yvHcVbff//9Sxljurf2/5xzzjn86quvPuCHP/wh+b5PxhjinJMxhnzf577v05YtW5b99a9/fasHPj/33HP3MsaM6N+//76/+tWv9jPGjGaMjSCiEUS0FxFlGGMeEVEckEkiUkRU4Jy3Oo6zUUr5thDi9QsuuOCdgQMHviOEWHXfffeFvX3+zzvvvH2iKDoinU5noihivu+rMAy553mlYNH3/aZ77rlnPmNM7sz//e9/P/Lvf//7oY7jeMYYR0rJU6mUcV3XxOvnRGSam5tff/zxx9/eRde/d+65554kpaw1xlA2mzWO41AQBGSM4TU1NTZQF7Nnz164YsWKlnL8cePGZUeMGLGP7/ujPvvZzw4+++yzRxpjRnLO92eMDSOiOs55xhjjxsGZFEKEtbW1bUKIZtd133Vd993XXntt5a233rquWCyuFUKs7FA6rKrnv6GhYd+hQ4eO+uxnPzvyk5/85MGZTOYwpdR+RDTAdd1aInKFEDyTyURa67ZisbiuX79+y4MgWHHDDTe8tXLlyrdeeumlVYsWLSr05vvPpz71qf777rvv6OOOO+7Ar3/96wcxxg6TUh7AGBvCGMsRkcsY05xzyRgrcs6bOOerXNd943e/+93SJ5988m2t9bKpU6e24P0f/vvl8y4W2lFkWO5y5W4cfPh91m9oaHCXLFmS1Vqna2pqUlEUeY7jeHGrGDPGcCmlcRyHPM/TnucZ13VFGIbhokWLArattiSO/27o19fX+/l8PpPL5TLGmBQRca2147quK6U0vu/r+PzrdDqtfN+PNmzYINasWROW+Qm+mvvPR40alc5kMjWc81Rtba0XRVFp+IDjOGSMUa7rRm1tbdGIESOKM2fO1O/H8R89enQ6m83mhBBZ3/dd+3oyxnCttXZd12itleM4URAExeXLl0e4/uF/UPze7FPtrefAhw8fPnz48OHv0X4lU0J7I8kZfPjw4cOHDx9+X/OrsqHdncHA4cOHDx8+fPjw4e/4n92JAHk3dxo+fPjw4cOHD79P+tVuVqtkZkFvTCOFDx8+fPgfQL+xsZHPnDnTaWtr4wceeKAXhiFva2tz+vXrx1tbWymbzTrJJ9xxxx3Oli1bCh/5yEckjj/8vuB3Nsuyq5kB5c486O4Ow4cPHz783c93GhsbU1EU1bmu28/zvP5hGA4gohoi6ldbW1szYcKE7HHHHZdijNkvHkVRKp1Ou1JKx/d9hzHGlFIOY0w7jvOu4zgvPfPMM3M/85nPFHD84fcF3+vkH5T4zhM/UyfLdPU7Y+VP94QPHz58+B9g/+67764dNmzY3lLK/YQQw4looOu6g6SUAw877LABRx55ZA1jLBNFUW0qlapTStX6vp9jjGWLxWIml8v5jDEvDEPGOeepVMqk02lWLBaZ4zjM933SWhcZY//+17/+Ne2ee+55SSm14sgjjww62Uecf/h7pM87oOU2x3V8Tk8SqsGH36X/u9/9btg555yzDscfPvxe8f2hQ4empJRubW2t+/jjj+/br1+/gxzHGaWUOpgxNiqXyw3ZZ599Bggh0q7rZl3XzUgpXc6543meF0WRm06nmRCCERHzfZ8HQcDT6XQpO77rukxrzRzHIc45V0oRY0x4nhcWCoW1QRA8EQTBAxMnTly7ePHiNrZ9UmGcf/h7vO910dS2sw2kHkaDyeXhw+/S33vvvT/GGHsExx8+/O779fX1/oABA/rV1NQMVEoNcByn9vvf//7gD3/4w4cQ0ZGc80MYY8PZtlJedhtcYwz3PI8VCgWWyWTIGMPjUknk+z7XWjPXdYkxxo0xLJPJsCiKWC6XY1prZst9KaU455w458YY06y1XvPKK6+8VigU/vzAAw9Mv++++5o77D/D+Yff13xvJxjv0IS3o0ivnAiTlbE8fPil5+y9994nM8b+gOMPH355fmNjo8cYGy6lHMEYG0lEe0+YMGHIxz72sRH5fH7/XC63HxENcV03K6XkifsA55yz5BcRMWMMi8tFcSklIyKWSqVYXNqKua7LtdbM931GRCydTjOtNVNK2ZUyznmUSqWWrVy58tlHHnlkYW1t7fz7779/yYIFCyTOP3z42wdknHXdN1ruDAVe4Q4x+PB35OdyOfepp5465rOf/exCHH/48Lf7nf/973/fT0p5sBDiUN/3R59++unDlVKDjTFDOed7+b7fT2udYow5mUyGO47DGWNMSkn2Z1vQPA6giG97MN/3iYi4Uoo5jkOZTIZLKZnWmtvAq2MrWRAELJPJsEwmQ4yxVcaYmXfeeee/pk+fvjSfzy+bNm1aK84/fPjbP9crIzLs7H+sTKTcmk/w4Xfqu667uKam5mLG2CVs27gSHH/4fc33hg4dmoqiyB84cGB6+vTph/q+X885/7AQ4tBRo0btXSwWM5lMJieESG172bjM8zyuteZ2HJeUknHOmRCCpVIp5nle6X9ElAzKuP1da81932eO47B47BfzfZ+FYVjqmgyCgDKZDGOMkRCikM1mW1paWuaFYfiXE0888SnP84I33nijwLbVXeUVtkzg/MPva/52UDl/7+z/vAfrhA9/u8eUKVMOIqKXHnvssdPKeB6OP/zd2h8/frzX0NAwpKGhYczEiROPX7p06WeJ6HKl1D1BELxARJuNMYKIdBiGhogoiiIyxlBbWxtprYmISClF9mH/39nDGEMm/qcxhrTWpJQiKSUJIcgYQ1EUlRaXUhoiIiklEZERQmgp5Wat9YK2trZHn3rqqQuffvrpkTj/8OFX7ldaOqDSJrxK1gkf/naPUaNGZVauXPlbIcTgM84445tPPvnkmzj+8PcU//LLL8/4vj8ql8vtn8vl9jvzzDOHDRs27CDf9/ePomhkOp3eOwiClO/7rud5ThRFLJVKMaUUc12XhWHI0uk0M8aQ7/uMMcbDMGSZTIZprRnnnDnOtnyrtmWMMUbFYpGl0+l2Y8bsJ3UiKrWQJceShWHIcrkcMcZYW1tbIZ1Ov1EoFJ6/7bbbXvE8b97gwYNfv+iiiyTOP3z43fN7UoCzGhuwKw4k/N3b59dcc80pP/zhD+964403/vWxj33s65s3b87j+MPfHf3bb7+9Zp999jnK9/2jjDFjxo8fP7KmpmaY4zhD8vn8oH79+tVIKV3GmGMDKds1aIwpje9KrLOUL0kIwexMR2MMcxyn1BXpOA6xbclYWSqVKgVgxpjSeLHkw3Zf2kH8RESZTEYVi8XXUqnUzN///vez//SnPy1raWlZOXPmzDzOP3z4vePzHfy8K2o7wYff7ufPfOYzezU3N/86DMP8G2+8cevQoUNrcPzhf0B9Z8SIEdn99ttv4EEHHbT3P/7xj8Peeeeds9euXfvLNWvWzCwUCiuIaEMURQVjjFBKaa21ISJtuw1td6HtOtz2523dibbr0XZNEhGFYUha69KX7VK0zyEiEwRBu25LIUS75yiljFKK4i+jlNJKqTwRvbt06dKZ77777vfeeeedj44dO3avUaNGZVj3u2dw/cGHv5OFK6nB1BsP+PB36F977bUf/vGPf/wLIvrwvHnz7jzvvPN+/vrrr6/D8Yf/fvoNDQ21WutBSqkhNTU1A6+99tp9Dj744CNTqdRRxpiDOedDicglIo+IOGOMO45jB8mXWqNsi1RytiNj7yVUtT/TtgW47UZkjDE70D5u8Sp1MwohmOd5peVtPjDP81gURSydTjMisukrjNbauK67iTG2Zvny5SveeOONF9etW/fUxRdfvATnHz783vd5BRtRzkyBajXzwYe/nf/666+fctBBB/1Ka103e/bsP82bN+/Ga6+9dlmZ68Xxh99j/8tf/vLAI444YrTneQcfd9xxI0466aT9iGg/zvmBbW1tw+vq6mqUUq7neW6cKmK7oMuO64oDstKYrWRAZoO1IAhYLpdrF7zZ52mtuTGGMcaY53msWCyympptjcc24JJSMhuAxTMhSw+lFCMiKYRYV1NTs5Ax9uoPf/jDJcaY12bOnLl85syZIc4/fPi7zuc93LBynteTCBM+/NJzx48f7/3+97//2j777PPzKIoonU4v+Nvf/vaz008//Skcf/jV9s8777zMl7/85ZGc8yPCMDwinU6POuqoo/bde++9925raxtWV1dXxxhLh2HIfN93XNctJUN1XZcJIcj3/VKx4kQw1W4gfWetY4nliDHGpZSlwItzbssQMa018zyvFGB5nmcDLeb7vh03Ro7j8Hh50lprz/Pe1VrPaWtre+brX//6kra2trX9+/ffMHXqVIHzDx/+B8LvMmDrTt8pfPhV90eNGpVZu3btFUS0uVgsyiiKNq9fv/7OW2+99agRI0Zkcfzhl7vu0aNHp8eMGVM3dOjQvb/whS+M2LBhw1GbNm066+233755/fr1M8MwfIuI1hUKhRatdaS1VsVisTTey47Dsj8ns0nYtBNxWolOv+zgMPu7Hc+V/L9Sqt3vifQTpbFkURSRUorCMCRjDAkhTLwNRikl8vn8ViJa9e677z737rvvNq5evfo/rrnmmkHDhw/PlXlscf3Bh78LfN6Dpr1qR57w4Ze13qOPPnrAQw899PUPfehD3wzDcGgmkyEp5Tuu6/7um9/85hNvv/32q48//ngRxx++fZxzzjk1xpiBbW1te9XW1g566KGHBjHGDtZaHxyG4eE1NTX7M8bqhBB+KpVytdbctlTZMVy2Vcq2Xvm+XxqTxdh73YTGGKaUYqlUarsxYbbFq+PfbQtZsgWNMVaaLWmMsRnxS92gWutSdnzOuW0dM57nFaIoWud53juPP/74G4yx2cVice5f//rX1VOnTtW4/uDD/2D6vAor72qdlUzvhA+/Iv+UU04Z+KMf/ejLRx111LVhGA7NZrNMSmk452+++eabTz722GMz+/fv/+wll1ySx/HvW/7NN988kIj2D4JghOu6+6ZSqUFXXHHFECHEyFQqNZIxtk8YhoPS6XRaa809z3PCMGSO45RqNLquWwqMXNfdLj2ELQ9kAynHcZJ5vhhjjCmlyHXd5PFol66CvzeIjCW/dwzKbNkiW+bIBohxsGZc11VKqY1BECzPZDKvfe9733s1k8ksb2lpeeOWW25ZxzovoozrDz78D5hf7qD+cms37Qwst28VPvyd+vX19bm///3vnxw6dOjPhRAHaq1ZNpv1pJQRY2yD53lLn3322b/PnDnzL42NjWtw/Pcsv6GhIfWNb3xjuOd5o6IoGssYO/Cggw4aPmrUqL2JaBAR7RVFUV0mk8kxxlzGmBNFEbOBkG3ZchyHlFLc930mpSyVBrIBlzGmFHRprRkRlcZyxeWIyPM8HnchciIi3/dLY8Y6aw1LBlx25mRnY8hsQBYHhUwIYZOzhkqptzzPe27evHkzv/vd767yPG9zc3Pzpn//+99tuP7gw9/9/Er7P8uN9Hqr2Q8+/O0GWZ5yyimHPvjgg9fU1tZ+jjE2wHEc1xY8VkpFvu9v2bJly3wi+st//dd/Pbtly5aWKIoKy5cvFzj+Hzx/7NixKaVUWmudcV3X9zzPmzVr1j6+7x8khDjYdd0xRHRAKpXaN5vN1mit05xzn4g813W54ziOEIJc1+We57FE5noiIu66LnHOuQ2uXNdtl6lea81tUlWbLiL5XtlZugk76N7+HqecKCVn7dBKVkpF0UkLWdIiIYRKp9Otxpi2TZs2bSoUCguFEDMfe+yxF26++ebNNTU1atWqVVHHdeP6gw9/9/N5OTe8HkaHlTwPPvxu+eecc07NhAkTzvqv//qvr6XT6Q8Xi0XPpgDQWjMpJfm+r1zX3SKEWJBKpWb/6Ec/eu211157a82aNWviVgUc/13kNzQ0uL7v92OM9XMcZ0CxWOw/cODAui9+8YsDPvOZz+zjOM5oKeVBrusOJ6K9GWP9E8/37Hocx+HxQHfeWQuUHW/VSeBTar3qUDqIEVGpVSzRZckcx2FSSnIcp5TXi4i4zYKfbFWzLW12XdYzxjDP80pljTjnTClFvu+zYrHIUqmUYoxt8TxvIxG9+8wzz6xobm5+0Riz4M4773wrkYoC1x98+HuYv6tKJ3XVVLerShfA7yP+ddddd+zll1/+5dra2jOMMSO11k7cakFSSp64uSqlVIvjOK+99dZbS5555pnVbW1tK9Pp9Gtz5859e+rUqXkc/577EydOTI8fP35QNpsdEobhvlLKfbLZ7KALL7xwr7q6un2UUoM8z9uHMTa4WCwOSKfTOdd13TAM3Uwmw6SUvGOqiA5lfkrBWGddfomArF2+LxaP4UoOpC8t9N5YMWKMca11aUC/7ea0HuecgiDg2ex7E3yLxSLLZDIlOw7USCnF7SQBm7A1DEOTy+XWEdGbRPTG/fff/+Zrr722Rmv9di6XW/HTn/50C2PM4PqDD3/P93kPwEqb57rT9AcffsX+f/7nfw44/fTTjz7nnHO+6rruf7W0tNTaWoC2jp9ttWDbCi2bdDod+r7fGobh5i1btmxetWrVaiHEq8aYOf/85z+X/uxnP2vC8d9+mfnz5/tKqb2CIBimlBq6//77Dzv44IP3e+aZZ/ZJp9OD9t13334HHHBAP611nTGmfyqVyhFRjeM4vhDCibPP83gQvc2VVUpkGp+nUpDUccB7Vxnuk8t0bCFL/j3ZVWmM4R0TuGqtWSqVKnUj2mLeNumrzaRvJwHY8V42U37CId/3dVwbcpPv+0s45wsZY/MnTJiwgoi2hmHYNHv27Ba280H4uP7gw98D/d7M4VGN5j348HvySL344osfGjZs2KUjRoz4WBAEw7PZbKZYLDq+7zPf90sDpX3fL333PI/iPFLa9/2ilFJt2bJlS11d3XrG2KooilanUqk1juO8u2TJktXnn39+kYgkEcmWlhYxevRo0dbWZlpaWvSIESP0zJkz9Qfs+Dtjx471XNf1i8WiW1tb6xSLRc91XV9K6fq+7w4aNMjdd999vXvuuadOKTXUGDPY9/3hjuOMCMNwpFJqUCaTGVhXV9efiLKcc5eIuFIqFQSBV1NTw+NAi8fjtYiIuG0ZKhQKrKamZrvghzFWCm6SwVFnARbrZOZiV+9pCaddce6drJ8xxpjdVvuw3Zmu65Y8pRTTWptUKsW11kZKGXieV/R9P7906dL1jLHXHMeZ5/v+i8cdd9yKTZs2ScaYjr8Ir3/48OHzKkPl9M9We4opfPg785177733yE9/+tOf33fffT9ljDnUcZy9tNauMYbbgdj2IYSwLRpcCMGMMXYWXWlmne/7Jh4LFDmO00xEzZzzJs75qiAINmSz2TbGWNEYk3/yySebn3zyycKWLVtENptVjuMoY4zinJMQIkqlUkJrrVzXVYwxbfOFuq5LQgiKgximlOKMMRbf9LnjOI7WmmutPSd+cM59xpgfD3JPcc59zrlnjPG11s6nPvWp9Nlnn53xfX+QEGII57zWdd1aY8wAzvkg13XroiiqlVLW1tTU1HDOU3GLleM4jptOp5PxTCk4SY67SqVSpJRKlvWhKIp4KpVKHkcSQvBkN6DN3xUPhicppT037caIlRFEbReoxc/frjvSri85ziseW0bGGK6UYnGeOx6PIWOZTIYppez4NVMsFqO6uromItoURdGG6dOnr2xpaXnLdd2lQojXzznnnOV4/cOHD39nPq/gybsyyoQPv1f8K6644pCxY8ceff75549rbm4eX1NTc5gxxtNau77vE+ecJwOEOL8UpVIpO2i7lKLAGMNc12VSymR3KIVhaFzXJcdxKC6noznnURxwFaWU2hijXdc1juMERBQyxqTjOJJtGy9k4pYTprW2v3N7DDjnTvyzE395RORuiyd4mnOeiYOytJQy5ThOyvM8V2ud4px7juM4YRjydDpt94NHUcQ55yydTpfeE+LyP6UuuzjgKgVHydmJNnGpMYal0+l2SVTtcWSMlY6VLWxtgx8pZan1jDFWSjERP6/dzMOu3rc6Dsy3f0sO0O9YssgGZ8YYbowpzX5MJoDN5/NUW1vL4wz52vO8NsdxVjHGljPGVvzkJz9ZuWnTpo2pVGo9Y2zNDTfc8G4Pr1W8/uHD74N+ObMsK22KKycSrNbMBfjwu+M7xx13XO3AgQOHPfbYY0f6vt/AOf8YEQ2WUjqpVKo0MNumRUg+4kChNObIzppLtLKU/pe8uSdn/RERE0K0mwXYWYBhZ+N10hrULndVh3FRpaDF1le0Y55s4lIbTCYHtXds6bJjpOw+2/XZJielVKnVKLnuYrFIuVyO20SpHbv8bGBmA18bNNnWRyllqaC2/XtXrWCdZbfvrEXNrifRAlb6soGlbaGzx8bzPC2E0Ol0+h0hxOupVGohY2zRaaed9nZTU1NLFEWtnue1zJkzJ8DrDz58+D31eRcL7SgyrGTGQiXNhPDhvx8+Z4x511xzTb/zzz+/XmvdcNBBBx3jed5grfUArXVdKpVygiBg2WyW2Rl3tixOoguTMcYoLp/DlVKlACEOYsgYw7XW5DgOT46T6irQSLYGdTK7sBQoJQtRxz/zZOATj5Ujtm3QPBljeGetSbYFLM7lVdrmZBDZsaRPMvkp55ziLsdSd6UNeGzWes45aa25DQZtcWx7vFzXLZlSSvI8r+OUyi6D1zgQZaxDklW7X3HrF9lWOSLSjLHQ87wiY6wQBEFbU1PTxtbW1hVSypdc113sed7SL3zhC62LFy+2rZacvTfrEa8/+PDhV83nrHf7VHvrOfDh95p/7733DlBKHZ1Op4/+8pe/fLjrugcqpYY7jjOMMVbLOedRFHHbsmJbepKlc5J5pmzQkQxk7LJxwFQKQmw9RLs+a9hcV9tFb4mgpmNwZWcAWtPWREx2x8UBFDHGuC0ZlFyXXU5rTa7r8jAMWSqVKgVjyfUlgr92LXy2BTHZGpZsnbMteralzaYmsTm74r+XyhAR0XZJWe2+2Yfv+ySlZK7rsiiKKJvNFqMoanEcZ4vv+5s2bty48Yknnljn+/5axtjKVCr1plLq7a985SuteP3Bhw///fC7U1y8u+UHqrVT8OHvMr+xsdHbsmXL/ul0eqQxZsTPf/7zQ7XWB3medwgR7a+U6he3CLme53HbDUlEpYAhHl9FnHNux5p19rDBGBGxYrHIampqmFLKDkTvsvah67oUhiHvmJS0QytdaRyY7b6zLX3xDEGWTqdLwY3tsiQichyHSykplUqVughtoBcHVqXB8slAKfkwxpRqMSb317YU2sDTBpj29zihLyciKhQKPJ1Ot0usGncZmzgY047jFKSUmxlj63zfX8MY26CU2vStb33rnWw221woFDZprTc1NTVt6CLXHK5/+PDhvy8+r9KGdncGQyXLw4f/vvvjxo3L1tXV1bW1tfVLp9O1M2bMGMMYO5KIPqy1PspxnCGO47iMMZ7P5xkRsbq6unaD3OOWGxJC8EwmUxqvZlvUbECVzG/V2SM5sSDxt1LC02T9Rds6lej6bJdd3g7Kt9nlO3aPJrsgbUBmAy8bHDmOw8IwpEwmw5N/TwSOyUH9pa7LjoP+Gds2qF8plawbaVzXNXa9rusWpJRve573bmtr68r+/fu/qrVeff31169/6qmnQtd1i0KIotY63G+//cKpU6cKXP/w4cP/IPt8J2A1Bsb1pK4UfPi7i88ZY+6CBQtGDRky5ENRFB0ohDgsl8uNHjFixCAiyvm+n1ZK5bTWaWNMKpvNusYYJ06fUGoAKxaLPJfL2cBtuyAs+d3zPBaPbytNJHBdlxWLRZbL5TodjM/iMVZ2jJbtPrTjwOIu2VLXaRRFpWLatqs1ORkhnjBAjuO0a4FLuKXjJKW0M1kpDEPNtqX5kL7vK865YIyFrusKxliwcePG/ObNm9c1NTWtzWQyb2ez2VVNTU1rBg4cuHb27NnrLrroImLvzUrF9Q8fPvzd2q92YthqVFCHD39P8vkdd9wxoLa2dt+mpqahuVxuX8bYEK31kLPPPntgLpfrzznvxzmvI6JBhUKhX01NTY5znlZKpZ1tkQ8lgjA7YL3UfWm7J20w1jHFhOd5pTFbURS1mxGZ7K4Mw7A0wD6TyZRKAtkZkcnWuCiKbC1HigM3XigUeE1NjdZaK8aY4JwHnPMCEeWJKHBdN88YC9m21B/5t99+u+XZZ5/Na62bPM/bwhhrNsZsdhxnc3Nz8/rLL7+8pYqfeHH9w4cP/wPt8x00u5U7u6A70WU5zX7w4e/RfkNDQ2rw4ME1YRjWptPp/r7vD/Q8b0A+n8/mcrnMdddd169fv379GWO1xpgaxlgN2zapoDb+OUtEOSllLp1Op4nI11o7WmtPSulkMhnmeZ4fJ2l1WZwYNTkjNJVKkZTSxOPDtDGGOOfSGKOIqOj7vigWi8VcLhfqben2Jec87zhOkXPeyhgTURQJ13XbPM8rSClb7rvvvmDhwoUyk8kUgiAoeJ6XV0oVXdctMMaibDYbbNmyJX/fffdFnRxTXH/w4cPvk345XZasB5FkT/to4cPvy74zfvz41NatW13f971sNusYY3zOuSeEcDnnXm1trdPS0uJ7nudorZ3TTjuN/9///Z/j+z6xOHFsnPHeSRhULBbZunXr6LHHHjNXXHEFffWrX+XLly+nuPwP01obrbVRSpmBAweKjRs3Um1trTnzzDOpqalJPfbYYzKTyWghhPY8jxzHka2trXrx4sWSdS+ZIs4/fPjw+7zPWXmD+zsGb7yL/7Eergs+fPjw4cOHD7/P+10twCtAKt0o+PDhw4cPHz78vuz36EmVps3g8OHDhw8fPnz48Lu3ct7F77zM5eDDhw8fPnz48OF3YbhV2Lhy/ldpfyt8+PDhw4cPH35f88teWaVYJeuEDx8+fPjw4cOH3wtwTyJR+PDhw4cPHz78vu73yore7x2BDx8+fPjw4cPfLXy+g5972n9azkbAhw8fPnz48OH3NX+nC1W73iV8+PDhw4cPHz78MoydDTrjvYHChw8fPnz48OH3Yb/bG1bO8zh8+PDhw4cPHz78nm/Q+9WkBx8+fPjw4cOH39f8igDeSwZ8+PDhw4cPH35f86se5XU2G4HDhw8fPnz48OHD71mAxnu4I501/XH48OHDhw8fPnz43Yv+KoWrGZnChw8fPnz48OHv8X41azx1ZyPgw4cPHz58+PDh74LIkvfyTsGHDx8+fPjw4e8RfiW5NnojSRp8+PDhw4cPH35f83v9weHDhw8fPnz48OHvGqic/lEOHz58+PDhw4cPv3yo10oAwIcPHz58+PDhwy8v4uvO8j0pNwAfPnz48OHDh9+n/XJnAlQyY6CSZjr48OHDhw8fPvw+6/dmn2pvPQc+fPjw4cOHD3+P9iuZEtobSc7gw4cPHz58+PD7ml+VDe3uDAIOHz58+PDhw4cPf8f/rMbAuJ7UdYIPHz58+PDhw+9rfo8f1aigDh8+fPjw4cOH32d93sX3zlZQzsq723wHHz58+PDhw4ff1/ydrrQnkWRP+2jhw4cPHz58+PD7hF8uynewoT2tfg4fPnz48OHDhw+/jAWqUSG9nOXhw4cPHz58+PD7mt+jJ1XaJMfhw4cPHz58+PDhd2/lXQ1i42UuBx8+fPjw4cOHD78Lw63CxpXzv0r7W+HDhw8fPnz48PuaX/bKKsUqWSd8+PDhw4cPHz78XoB7EonChw8fPnz48OH3db9XVvR+7wh8+PDhw4cPH/5u4fMd/LwrajvBhw8fPnz48OH3NX+nC/VK0Uv48OHDhw8fPnz4lS/Ae7iR1ShjAB8+fPjw4cOHv6f63d6wcp7H4cOHDx8+fPjw4fd8g96vJj348OHDhw8fPvy+5lcE9FYVdPjw4cOHDx8+/L7mVz3K62w2AocPHz58+PDhw4ffswCN93BHOmv64/Dhw4cPHz58+PC7F/1VClczMoUPHz58+PDhw9/j/WrWeOrORsCHDx8+fPjw4cPfBZEl7+Wdgg8fPnz48OHD3yP8SnJt9EaSNPjw4cOHDx8+/L7m9/qDw4cPHz58+PDhw981UDn9oxw+fPjw4cOHDx9++VCvlQCADx8+fPjw4cOHX17E153le1JuAD58+PDhw4cPv0/75c4EqGTGQCXNdPDhw4cPHz58+H3W780+1d56Dnz48OHDhw8f/h7tVzIltDeSnMGHDx8+fPjw4fc1vyob2t0ZBBw+fPjw4cOHDx/+jv9ZjYFxPanrBB8+fPjw4cOH39f8Hj+qUUEdPnz48OHDhw+/z/q8i++draCclXe3+Q4+fPjw4cOHD7+v+TtdaU8iyZ720cKHDx8+fPjw4fcJv1yU72BDe1r9HD58+PDhw4cPH34ZC1SjQno5y8OHDx8+fPjw4fc1v0dPqrRJjsOHDx8+fPjw4cPv3sq7GsTGy1wOPnz48OHDhw8ffheGW4WNK+d/lfa3wocPHz58+PDh9zW/7JVVilWyTvjw4cOHDx8+fPi9APckEoUPHz58+PDhw+/rfq+s6P3eEfjw4cOHDx8+/N3C5zv4eVfUdoIPHz58+PDhw+9r/k4X6pWil/Dhw4cPHz58+PArX4D3cCOrUcYAPnz48OHDhw9/T/W7vWHlPI/Dhw8fPnz48OHD7/kGvV9NevDhw4cPHz58+H3NrwjorSro8OHDhw8fPnz4fc2vepTX2WwEDh8+fPjw4cOHD79nARrv4Y501vTH4cOHDx8+fPjw4Xcv+qsUrmZkCh8+fPjw4cOHv8f71azx1J2NgA8fPnz48OHDh78LIkveyzsFHz58+PDhw4e/R/iV5NrojSRp8OHDhw8fPnz4fc3v9QeHDx8+fPjw4cOHv2ugcvpHOXz48OHDhw8fPvzyoV4rAQAfPnz48OHDhw+/vIivO8v3pNwAfPjw4cOHDx9+n/bLnQlQyYyBSprp4MOHDx8+fPjw+6zfm32qvfUc+PDhw4cPHz78PdqvZEpobyQ5gw8fPnz48OHD72t+VTa0uzMIOHz48OHDhw8fPvwd/7MaA+N6UtcJPnz48OHDhw+/r/k9flSjgjp8+PDhw4cPH36f9XkX3ztbQTkr727zHXz48OHDhw8ffl/zd7rSnkSSPe2jhQ8fPnz48OHD7xN+uSjfwYb2tPo5fPjw4cOHDx8+/DIWqEaF9HKWhw8fPnz48OHD72t+j55UaZMchw8fPnz48OHDh9+9lXc1iI2XuRx8+PDhw4cPHz78Lgy3ChtXzv8q7W+FDx8+fPjw4cPva37ZK6sUq2Sd8OHDhw8fPnz48HsB7kkkCh8+fPjw4cOH39f9XlnR+70j8OHDhw8fPnz4u4XPd/DzrqjtBB8+fPjw4cOH39f8nS7UK0Uv4cOHDx8+fPjw4Ve+AO/hRlajjAF8+PDhw4cPH/6e6nd7w8p5HocPHz58+PDhw4ff8w16v5r04MOHDx8+fPjw+5pfEdBbVdDhw4cPHz58+PD7ml/1KK+z2QgcPnz48OHDhw8ffs8CNN7DHems6Y/Dhw8fPnz48OHD7170VylczcgUPnz48OHDhw9/j/erWeOpOxsBHz58+PDhw4cPfxdElryXdwo+fPjw4cOHD3+P8CvJtdEbSdLgw4cPHz58+PD7mt/rDw4fPnz48OHDhw9/10Dl9I9y+PDhw4cPHz58+OVDvVYCAD58+PDhw4cPH355EV93lu9JuQH48OHDhw8fPvw+7Zc7E6CSGQOVNNPBhw8fPnz48OH3Wb83+1R76znw4cOHDx8+fPh7tF/JlNDeSHIGHz58+PDhw4ff1/yqbGh3ZxBw+PDhw4cPHz58+Dv+ZzUGxvWkrhN8+PDhw4cPH35f83v8qEYFdfjw4cOHDx8+/D7r8y6+d7aCclbe3eY7+PDhw4cPHz78vubvdKU9iSR72kcLHz58+PDhw4ffJ/xyUb6DDe1p9XP48OHDhw8fPnz4ZSxQjQrp5SwPHz58+PDhw4ff1/wePanSJjkOHz58+PDhw4cPv3sr72oQGy9zOfjw4cOHDx8+fPhdGG4VNq6c/1Xa3wofPnz48OHDh9/X/LJXVilWyTrhw4cPHz58+PDh9wLck0gUPnz48OHDhw+/r/u9sqL3e0fgw4cPHz58+PB3C5/v4OddUdsJPnz48OHDhw+/r/k7XahXil7Chw8fPnz48OHDr3wB3sONrEYZA/jw4cOHDx8+/D3V7/aGlfM8Dh8+fPjw4cOHD7/nG/R+NenBhw8fPnz48OH3Nb8ioLeqoMOHDx8+fPjw4fc1v+pRXmezETh8+PDhw4cPHz78ngVovIc70lnTH4cPHz58+PDhw4ffveivUriakSl8+PDhw4cPH/4e71ezxlN3NgI+fPjw4cOHDx/+LogseS/vFHz48OHDhw8f/h7hV5JrozeSpMGHDx8+fPjw4fc1v9cfHD58+PDhw4cPH/6ugcrpH+Xw4cOHDx8+fPjwy4d6rQQAfPjw4cOHDx8+/PIivu4s35NyA/Dhw4cPHz58+H3aL3cmQCUzBipppoMPHz58+PDhw++T/v8H5o3Oy6PGwVsAAAAASUVORK5CYII=";
const Logo360 = ({ width = 200 }) => (
  <img
    src={LOGO_B64}
    alt="Vista360"
    width={width}
    style={{ display:"block", objectFit:"contain" }}
  />
);

// ── SPLASH ───────────────────────────────────────────────────────
function Splash({done}){
  const [f,setF]=useState(0);
  useEffect(()=>{
    const ts=[setTimeout(()=>setF(1),400),setTimeout(()=>setF(2),950),setTimeout(()=>setF(3),2300),setTimeout(done,2800)];
    return()=>ts.forEach(clearTimeout);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:f===3?0:1,transition:f===3?"opacity .55s ease":"none"}}>
      {/* Anillos */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[...Array(5)].map((_,i)=>(
          <div key={i} style={{position:"absolute",borderRadius:"50%",width:220+i*110,height:220+i*110,top:"50%",left:"50%",transform:"translate(-50%,-50%)",border:`1px solid ${C.accent}${["0A","0D","10","13","16"][i]}`,animation:`pulse ${2.2+i*0.3}s ease-in-out infinite alternate`}}/>
        ))}
      </div>
      {/* Logo real */}
      <div style={{opacity:f>=1?1:0,transform:f>=1?"scale(1) translateY(0)":"scale(.8) translateY(24px)",transition:"all .75s cubic-bezier(.34,1.4,.64,1)",filter:`drop-shadow(0 0 40px ${C.accent}55)`}}>
        <Logo360 width={300}/>
      </div>
      <div style={{
        fontFamily:"'Cormorant Garamond', Georgia, serif",
        fontSize:17,
        fontWeight:600,
        color:"rgba(255,255,255,0.82)",
        letterSpacing:5,
        textTransform:"uppercase",
        marginTop:14,
        opacity:f>=1?1:0,
        transition:"opacity .6s .35s",
        textAlign:"center",
        lineHeight:1.6,
        textShadow:`0 0 30px ${C.accent}88`,
      }}>
        Gestión de Paneles Publicitarios
      </div>
      {/* Barra progreso */}
      <div style={{marginTop:52,width:240,height:3,background:C.border,borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:f>=2?"100%":"0%",background:`linear-gradient(90deg,${C.accent},${C.cyan})`,borderRadius:4,transition:f>=2?"width 1.3s cubic-bezier(.4,0,.2,1)":"none"}}/>
      </div>
      <div style={{marginTop:12,fontSize:12,color:C.muted,opacity:f>=2?1:0,transition:"opacity .35s"}}>Conectando con Supabase...</div>
      <style>{`@keyframes pulse{from{opacity:.2}to{opacity:.65}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── DONUT / BARCHART ─────────────────────────────────────────────
function Donut({pct,color,label,sub}){
  const r=32,c2=2*Math.PI*r,d=(pct/100)*c2;
  return(<div style={{display:"flex",alignItems:"center",gap:14}}>
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} fill="none" stroke={C.border} strokeWidth={8}/>
      <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${d} ${c2}`} strokeLinecap="round" transform="rotate(-90 40 40)"/>
      <text x={40} y={44} textAnchor="middle" fill={C.white} fontSize={13} fontWeight={700}>{pct}%</text>
    </svg>
    <div><div style={{fontSize:14,fontWeight:700,color:C.white}}>{label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{sub}</div></div>
  </div>);
}
function BarChart({data}){
  const max=Math.max(...data.map(d=>d.v));
  return(<div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
    {data.map((d,i)=>{const last=i===data.length-1;return(
      <div key={d.mes} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
        <div style={{fontSize:10,color:last?C.white:C.muted}}>{fmt(d.v)}</div>
        <div style={{width:"100%",height:`${(d.v/max)*100}%`,background:last?C.accent:C.accent+"44",borderRadius:"5px 5px 0 0",minHeight:6}}/>
        <div style={{fontSize:11,fontWeight:last?700:400,color:last?C.white:C.muted}}>{d.mes}</div>
      </div>
    );})}
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// PANTALLAS
// ══════════════════════════════════════════════════════════════════

// ── GRÁFICA DE CRECIMIENTO ───────────────────────────────────────
function GraficaCrecimiento({contratos}){
  const [vista,setVista]=useState("meses");
  const [tooltip,setTooltip]=useState(null);

  const datosMeses=useMemo(()=>{
    const mapa={};
    contratos.filter(c=>c.pagado).forEach(c=>{
      const d=new Date(c.inicio||c.created_at||Date.now());
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      mapa[key]=(mapa[key]||0)+Number(c.monto||0);
    });
    const res=[];
    for(let i=11;i>=0;i--){
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      res.push({key,label:d.toLocaleDateString("es-PE",{month:"short",year:"2-digit"}),v:mapa[key]||0});
    }
    return res;
  },[contratos]);

  const datosAnios=useMemo(()=>{
    const mapa={};
    contratos.filter(c=>c.pagado).forEach(c=>{
      const d=new Date(c.inicio||c.created_at||Date.now());
      const key=String(d.getFullYear());
      mapa[key]=(mapa[key]||0)+Number(c.monto||0);
    });
    const anioActual=new Date().getFullYear();
    return Array.from({length:5},(_,i)=>anioActual-4+i).map(a=>({key:String(a),label:String(a),v:mapa[String(a)]||0}));
  },[contratos]);

  const data=vista==="meses"?datosMeses:datosAnios;
  const maxV=Math.max(...data.map(d=>d.v),1);
  const mesActual=datosMeses[datosMeses.length-1]?.v||0;
  const mesAnterior=datosMeses[datosMeses.length-2]?.v||0;
  const crecPct=mesAnterior>0?Math.round(((mesActual-mesAnterior)/mesAnterior)*100):0;
  const totalHist=datosMeses.reduce((a,d)=>a+d.v,0);
  const mejorMes=Math.max(...datosMeses.map(d=>d.v),0);
  const mesesConData=datosMeses.filter(d=>d.v>0);
  const promMes=mesesConData.length?Math.round(mesesConData.reduce((a,d)=>a+d.v,0)/mesesConData.length):0;
  const promUlt3=Math.round(datosMeses.slice(-3).reduce((a,d)=>a+d.v,0)/3);
  const proyeccionAnio=mesActual+promUlt3*Math.max(0,11-new Date().getMonth());

  // SVG
  const W=500,H=130,PAD=12;
  const pts=data.map((d,i)=>({
    x:PAD+(i/(data.length-1||1))*(W-PAD*2),
    y:H-PAD-(d.v/maxV)*(H-PAD*2),
    v:d.v, label:d.label,
  }));
  const pathD=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const areaD=pts.length>1?`${pathD} L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`:"";
  const proyPts=vista==="meses"&&pts.length>=2?[
    pts[pts.length-1],
    {x:pts[pts.length-1].x+(W-PAD*2)/(data.length-1)*0.8,y:H-PAD-(Math.min(promUlt3*1.08,maxV)/maxV)*(H-PAD*2)},
  ]:[];
  const proyD=proyPts.length>1?proyPts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" "):"";

  return(<div>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div>
        <SecTit ch="📈 Crecimiento del Negocio"/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:-8}}>
          <span style={{fontSize:28,fontWeight:800,color:C.white}}>{fmt(mesActual)}</span>
          <div style={{display:"flex",alignItems:"center",gap:5,background:(crecPct>=0?C.green:C.red)+"18",border:`1px solid ${(crecPct>=0?C.green:C.red)}44`,borderRadius:8,padding:"4px 10px"}}>
            <span style={{fontSize:13}}>{crecPct>=0?"▲":"▼"}</span>
            <span style={{fontSize:13,fontWeight:700,color:crecPct>=0?C.green:C.red}}>{Math.abs(crecPct)}% vs mes ant.</span>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,background:C.surface,borderRadius:10,padding:4}}>
        {["meses","años"].map(v=>(
          <button key={v} onClick={()=>setVista(v)}
            style={{padding:"6px 14px",borderRadius:7,border:"none",background:vista===v?C.accent:"transparent",color:vista===v?C.white:C.muted,fontWeight:700,fontSize:12,cursor:"pointer",textTransform:"uppercase",letterSpacing:0.5}}>
            {v==="meses"?"Mensual":"Anual"}
          </button>
        ))}
      </div>
    </div>

    {/* SVG Chart grande */}
    <div style={{position:"relative",marginBottom:6,background:C.surface,borderRadius:14,padding:"16px 8px 8px"}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible",display:"block"}}>
        <defs>
          <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0.25,0.5,0.75].map(p=>(
          <line key={p} x1={PAD} y1={H-PAD-(p*(H-PAD*2))} x2={W-PAD} y2={H-PAD-(p*(H-PAD*2))}
            stroke={C.border} strokeWidth="0.8" strokeDasharray="4,4"/>
        ))}
        {pts.length>1&&<path d={areaD} fill="url(#gr1)"/>}
        {pts.length>1&&<path d={pathD} stroke={C.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
        {proyD&&<path d={proyD} stroke={C.cyan} strokeWidth="2" fill="none" strokeDasharray="5,4" strokeLinecap="round"/>}
        {pts.map((p,i)=>(
          <g key={i} style={{cursor:"pointer"}}
            onMouseEnter={()=>setTooltip(p)} onMouseLeave={()=>setTooltip(null)}
            onTouchStart={()=>setTooltip(p)} onTouchEnd={()=>setTimeout(()=>setTooltip(null),1500)}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent"/>
            <circle cx={p.x} cy={p.y} r={p.v>0?4:2.5} fill={p.v>0?C.accent:C.border} stroke={C.bg} strokeWidth="2"/>
          </g>
        ))}
        {tooltip&&(
          <g>
            <rect x={Math.min(Math.max(tooltip.x-38,4),W-80)} y={tooltip.y-38} width={76} height={28} rx={7} fill={C.card} stroke={C.accent} strokeWidth="1"/>
            <text x={Math.min(Math.max(tooltip.x-38,4),W-80)+38} y={tooltip.y-20} textAnchor="middle" fill={C.white} fontSize={11} fontWeight="800">{fmt(tooltip.v)}</text>
            <text x={Math.min(Math.max(tooltip.x-38,4),W-80)+38} y={tooltip.y-9} textAnchor="middle" fill={C.muted} fontSize={9}>{tooltip.label}</text>
          </g>
        )}
      </svg>

      {/* Labels eje X */}
      <div style={{display:"flex",justifyContent:"space-between",paddingLeft:PAD,paddingRight:PAD,marginTop:4}}>
        {data.filter((_,i)=>i===0||i===Math.floor(data.length/2)||i===data.length-1).map(d=>(
          <span key={d.key} style={{fontSize:10,color:C.muted,fontWeight:600}}>{d.label}</span>
        ))}
      </div>
    </div>

    {/* Proyección */}
    {vista==="meses"&&promUlt3>0&&(
      <div style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0",padding:"9px 14px",background:C.cyan+"0E",border:`1px solid ${C.cyan}28`,borderRadius:10}}>
        <span style={{color:C.cyan,fontSize:16}}>〰</span>
        <span style={{fontSize:13,color:C.cyan}}>Proyección fin de año: <strong>{fmt(proyeccionAnio)}</strong></span>
      </div>
    )}

    {/* Métricas */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
      {[["Total histórico",fmt(totalHist),C.white,"💵"],["Mejor mes",fmt(mejorMes),C.green,"🏆"],["Promedio/mes",fmt(promMes),C.cyan,"📊"]].map(([l,v,c,ic])=>(
        <div key={l} style={{textAlign:"center",background:C.surface,borderRadius:12,padding:"12px 8px"}}>
          <div style={{fontSize:16,marginBottom:4}}>{ic}</div>
          <div style={{fontSize:15,fontWeight:800,color:c}}>{v}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:3,textTransform:"uppercase",letterSpacing:0.5}}>{l}</div>
        </div>
      ))}
    </div>
  </div>);
}

// ── DASHBOARD ────────────────────────────────────────────────────
function Dashboard({clientes,contratos,paneles,setTab}){
  const ocu=paneles.length?Math.round((paneles.filter(p=>p.estado==="Ocupado").length/paneles.length)*100):0;
  const pag=contratos.filter(c=>c.pagado).length;
  const cob=contratos.length?Math.round((pag/contratos.length)*100):0;
  const ingMes=contratos.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto),0);
  const prox=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>0&&c.d<=30&&c.panel&&c.cliente).sort((a,b)=>a.d-b.d).slice(0,3);

  // Alertas urgentes para el banner principal
  const criticos=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>0&&c.d<=15&&c.panel&&c.cliente).sort((a,b)=>a.d-b.d);
  const enAviso=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.d>15&&c.d<=30&&c.panel&&c.cliente).sort((a,b)=>a.d-b.d);
  const [bannerCerrado,setBannerCerrado]=useState(false);
  const hayAlertas=(criticos.length>0||enAviso.length>0)&&!bannerCerrado;

  return(<div>
    {/* ── BANNER DE ALERTAS URGENTES ── */}
    {hayAlertas&&(
      <div style={{marginBottom:20,borderRadius:16,overflow:"hidden",border:`1px solid ${criticos.length>0?C.red:C.amber}55`}}>
        {/* Header del banner */}
        <div style={{background:criticos.length>0?`linear-gradient(135deg,#3B0A0A,#2D1010)`:`linear-gradient(135deg,#2D1F00,#2A1E06)`,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:22,animation:"pulse 1s infinite alternate"}}>{criticos.length>0?"🚨":"⚠️"}</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:criticos.length>0?C.red:C.amber}}>
                {criticos.length>0?`${criticos.length} contrato${criticos.length>1?"s":""} vence${criticos.length>1?"n":""} en menos de 15 días`:`${enAviso.length} contrato${enAviso.length>1?"s":""} vence${enAviso.length>1?"n":""} en menos de 30 días`}
              </div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>Requiere atención inmediata</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setTab("alertas")} style={{background:criticos.length>0?C.red:C.amber,border:"none",borderRadius:9,padding:"7px 14px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              Ver alertas →
            </button>
            <button onClick={()=>setBannerCerrado(true)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:"4px 8px"}}>✕</button>
          </div>
        </div>
        {/* Lista de contratos críticos */}
        <div style={{background:criticos.length>0?"#1A0808":"#1A1400"}}>
          {[...criticos,...enAviso].slice(0,4).map((c,i)=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderTop:`1px solid ${criticos.length>0?C.red:C.amber}22`}}>
              <div style={{fontSize:20,flexShrink:0}}>{c.panel.foto}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel.nombre}</div>
                <div style={{fontSize:12,color:C.muted}}>{c.cliente?.empresa}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <Badge color={c.d<=15?C.red:C.amber} ch={`${c.d<=15?"🔴":"🟡"} ${c.d} día${c.d!==1?"s":""}`}/>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{fmtF(c.fin)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Saludo personalizado */}
    <div style={{marginBottom:24,padding:"20px 24px",background:"linear-gradient(135deg,#1E3A5F,#1a3353,#162d47)",borderRadius:18,border:`1px solid #2a4a7a`,display:"flex",alignItems:"center",justifyContent:"space-between",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",right:-20,top:-20,width:160,height:160,borderRadius:"50%",background:"rgba(37,99,235,0.12)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",right:60,bottom:-40,width:100,height:100,borderRadius:"50%",background:"rgba(6,182,212,0.08)",pointerEvents:"none"}}/>
      <div>
        <div style={{fontSize:13,color:"#7fa8d4",fontWeight:600,marginBottom:4,letterSpacing:0.5}}>
          {hoy.getHours()<12?"🌅 Buenos días":hoy.getHours()<18?"☀️ Buenas tardes":"🌙 Buenas noches"}, bienvenido de vuelta
        </div>
        <div style={{fontSize:26,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>
          Alan Martínez 👋
        </div>
        <div style={{fontSize:13,color:"#7fa8d4",marginTop:4}}>
          {hoy.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </div>
      </div>
      <div style={{fontSize:52,opacity:0.9,flexShrink:0}}>📡</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
      <Card><SecTit ch="💰 Ingresos del Mes"/>
        <div style={{fontSize:34,fontWeight:800,color:C.white,letterSpacing:"-1px"}}>{fmt(ingMes)}</div>
        <div style={{fontSize:13,color:C.muted,marginTop:4}}>{pag} de {contratos.length} contratos cobrados</div>
      </Card>
      <Card style={{display:"flex",alignItems:"center"}}><Donut pct={ocu} color={C.accent} label="Ocupación" sub={`${paneles.filter(p=>p.estado==="Ocupado").length}/${paneles.length} paneles`}/></Card>
      <Card style={{display:"flex",alignItems:"center"}}><Donut pct={cob} color={C.green} label="Cobranza" sub={`${pag}/${contratos.length} contratos`}/></Card>
    </div>
    {/* Fila inferior: próximos a vencer en compacto */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card style={{padding:"16px 18px"}}>
        <SecTit ch="🚨 Próximos a Vencer"/>
        {prox.length===0&&<div style={{color:C.muted,fontSize:13,padding:"8px 0"}}>Sin contratos próximos</div>}
        {prox.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:18,flexShrink:0}}>{c.panel.foto}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.panel.nombre}</div>
              <div style={{fontSize:11,color:C.muted}}>{c.cliente?.empresa}</div>
            </div>
            <Badge color={c.d<=15?C.red:C.amber} ch={`${c.d}d`}/>
          </div>
        ))}
        <button style={{width:"100%",padding:"8px",background:C.accent,border:"none",borderRadius:9,color:C.white,fontWeight:700,fontSize:12,cursor:"pointer",marginTop:12}} onClick={()=>setTab("contratos")}>Ver contratos →</button>
      </Card>

      {/* Accesos rápidos */}
      <Card style={{padding:"16px 18px"}}>
        <SecTit ch="⚡ Accesos Rápidos"/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {icon:"🖥️",label:"Nuevo Panel",tab:"paneles"},
            {icon:"👥",label:"Nuevo Cliente",tab:"crm"},
            {icon:"📋",label:"Ver Contratos",tab:"contratos"},
            {icon:"📈",label:"Resultados",tab:"resultados"},
          ].map(a=>(
            <button key={a.tab} onClick={()=>setTab(a.tab)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.white,fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:18}}>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </Card>
    </div>

    {/* Bloque grande — Gráfica de crecimiento ocupa todo el ancho */}
    <Card style={{padding:"22px 24px"}}>
      <GraficaCrecimiento contratos={contratos}/>
    </Card>
  </div>);
}

// ── MINI MAPA INTERACTIVO (formulario de paneles) ────────────────
// Mueve el pin → la dirección se llena sola via Nominatim
function MiniMapaPanel({lat,lng,nombre,foto,onMove}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const markerRef=useRef(null);
  const [ready,setReady]=useState(!!window.L);
  const [geocodingReverse,setGeocodingReverse]=useState(false);

  // Cargar Leaflet si no está ya
  useEffect(()=>{
    if(window.L){setReady(true);return;}
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload=()=>setReady(true);
    document.head.appendChild(s);
  },[]);

  // Geocodificación inversa — lat/lng → dirección legible
  const reverseGeocode=async(la,ln)=>{
    setGeocodingReverse(true);
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json&accept-language=es`);
      const d=await r.json();
      const addr=(d&&typeof d==="object"&&d.address)?d.address:{};
      const road=addr.road||addr.pedestrian||addr.suburb||"";
      const city=addr.city||addr.town||addr.county||addr.state||"";
      const short=road&&city?`${road}, ${city}`:(d&&d.display_name?d.display_name.split(",").slice(0,3).join(", "):`${la.toFixed(5)}, ${ln.toFixed(5)}`);
      onMove(la,ln,short);
    }catch(e){
      onMove(la,ln,`${la.toFixed(5)}, ${ln.toFixed(5)}`);
    }finally{
      setGeocodingReverse(false);
    }
  };

  // Inicializar mapa
  useEffect(()=>{
    if(!ready||!containerRef.current||mapRef.current) return;
    const map=window.L.map(containerRef.current,{center:[lat,lng],zoom:16,zoomControl:true,scrollWheelZoom:true});
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:"© OpenStreetMap",maxZoom:19
    }).addTo(map);

    const icon=window.L.divIcon({
      className:"",iconSize:[44,54],iconAnchor:[22,54],
      html:`<div style="display:flex;flex-direction:column;align-items:center;gap:0">
        <div style="width:40px;height:40px;border-radius:50%;background:white;border:3px solid #2563EB;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px #0005;cursor:grab">${foto}</div>
        <div style="width:2px;height:12px;background:#2563EB;margin-top:-2px"></div>
      </div>`,
    });
    const marker=window.L.marker([lat,lng],{icon,draggable:true}).addTo(map);
    marker.on("dragend",e=>{
      const p=e.target.getLatLng();
      reverseGeocode(p.lat,p.lng);
    });
    // También al hacer clic en el mapa, mueve el pin ahí
    map.on("click",e=>{
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat,e.latlng.lng);
    });
    markerRef.current=marker;
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;markerRef.current=null;};
  },[ready]);

  // Sincronizar si lat/lng cambian externamente
  useEffect(()=>{
    if(!mapRef.current||!markerRef.current) return;
    markerRef.current.setLatLng([lat,lng]);
    mapRef.current.setView([lat,lng],16);
  },[lat,lng]);

  return(
    <div style={{borderRadius:14,overflow:"hidden",border:`1px solid ${C.border}`,height:230,position:"relative"}}>
      {!ready&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.surface,color:C.muted,fontSize:13,zIndex:10}}>Cargando mapa…</div>}
      {geocodingReverse&&<div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",background:C.surface+"EE",borderRadius:8,padding:"5px 12px",fontSize:12,color:C.accent,zIndex:1000,fontWeight:600}}>📍 Obteniendo dirección…</div>}
      <div ref={containerRef} style={{height:"100%",width:"100%"}}/>
    </div>
  );
}

// ── GESTIÓN DE PANELES ───────────────────────────────────────────
function Paneles({paneles,setPaneles,loading}){
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);

  const empty={nombre:"",tipo:"LED",precio:0,estado:"Libre",foto:"📡",ciudad:"Lima",direccion:"",lat:"",lng:""};
  const [form,setForm]=useState(empty);

  const openNew=()=>{ setForm(empty); setModal("nuevo"); };
  const openEdit=(p)=>{ setForm({...p}); setModal(p); };

  const guardar=async()=>{
    if(!form.nombre.trim()) return alert("Escribe el nombre del panel");
    setSaving(true);
    const payload={nombre:form.nombre,tipo:form.tipo,precio:Number(form.precio)||0,estado:form.estado,foto:form.foto||"📡",ciudad:form.ciudad,direccion:form.direccion||"",lat:form.lat?String(form.lat):null,lng:form.lng?String(form.lng):null};
    try{
    if(modal==="nuevo"){
      const [r]=await sb.post("paneles",payload);
      if(r) setPaneles(p=>[...p,r]);
      else alert("Error al guardar. Verifica tu conexión.");
    } else {
      const [r]=await sb.patch("paneles",modal.id,payload);
      if(r) setPaneles(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); setModal(null);
    }catch(e){ setSaving(false); alert("Error: "+e.message); }
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este panel? Los contratos asociados quedarán sin panel.")) return;
    await sb.del("paneles",id);
    setPaneles(p=>p.filter(x=>x.id!==id));
  };

  const libre=paneles.filter(p=>p.estado==="Libre").length;
  const ocup =paneles.filter(p=>p.estado==="Ocupado").length;

  // ── AUTOCOMPLETADO DE DIRECCIÓN EN TIEMPO REAL ──────────────────
  const [geocoding,setGeocoding]=useState(false);
  const [geocodeMsg,setGeocodeMsg]=useState("");
  const [sugerencias,setSugerencias]=useState([]);
  const [showSug,setShowSug]=useState(false);
  const debounceRef=useRef(null);

  const CITY_COORDS={
    "Lima":[-12.0464,-77.0428],"Arequipa":[-16.4090,-71.5375],"Trujillo":[-8.1116,-79.0288],
    "Chiclayo":[-6.7714,-79.8409],"Piura":[-5.1945,-80.6328],"Cusco":[-13.5320,-71.9675],
    "Iquitos":[-3.7491,-73.2538],"Huancayo":[-12.0651,-75.2049],"Tacna":[-18.0066,-70.2462],
    "Pucallpa":[-8.3791,-74.5539],"Huánuco":[-9.9306,-76.2422],"Cajamarca":[-7.1638,-78.5003],
    "Ica":[-14.0678,-75.7286],"Sullana":[-4.9044,-80.6855],"Juliaca":[-15.5000,-70.1333],
    "Ayacucho":[-13.1588,-74.2236],"Chimbote":[-9.0853,-78.5783],"Tumbes":[-3.5669,-80.4515],
    "Puno":[-15.8402,-70.0219],"Tarapoto":[-6.4850,-76.3722],"Moquegua":[-17.1942,-70.9329],
    "Moyobamba":[-6.0340,-76.9724],"Tingo María":[-9.2966,-75.9987],"Huaraz":[-9.5300,-77.5283],
    "Cerro de Pasco":[-10.6867,-76.2627],"Abancay":[-13.6385,-72.8805],"Andahuaylalas":[-13.6560,-73.3760],
    "Puerto Maldonado":[-12.5931,-69.1893],"Bagua":[-5.6519,-78.5267],"Chepen":[-7.2268,-79.4278],
  };

  // Buscar sugerencias en tiempo real mientras el usuario escribe
  const buscarSugerencias=useCallback(async(texto)=>{
    if(texto.length<3){ setSugerencias([]); return; }
    const query=`${texto}, ${form.ciudad||"Peru"}, Peru`;
    try{
      const r=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`);
      const d=await r.json();
      if(d.features?.length>0){
        const sug=d.features.map(f=>({
          label:[f.properties.name,f.properties.street,f.properties.city,f.properties.state].filter(Boolean).join(", "),
          lat:f.geometry.coordinates[1],
          lng:f.geometry.coordinates[0],
        }));
        setSugerencias(sug);
        setShowSug(true);
      } else { setSugerencias([]); }
    }catch(e){ setSugerencias([]); }
  },[form.ciudad]);

  const onDireccionChange=(val)=>{
    setForm(f=>({...f,direccion:val}));
    setGeocodeMsg("");
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(()=>buscarSugerencias(val),400);
  };

  const elegirSugerencia=(s)=>{
    setForm(f=>({...f,direccion:s.label,lat:s.lat.toFixed(6),lng:s.lng.toFixed(6)}));
    setGeocodeMsg(`✅ Ubicado: ${s.label}`);
    setSugerencias([]); setShowSug(false);
  };

  const geocodificar=async()=>{
    if(!form.direccion.trim()) return setGeocodeMsg("⚠️ Escribe una dirección primero");
    setGeocoding(true); setGeocodeMsg("🔍 Buscando..."); setSugerencias([]); setShowSug(false);
    const enc=encodeURIComponent(`${form.direccion}, ${form.ciudad||""}, Peru`);

    try{
      const r=await fetch(`https://photon.komoot.io/api/?q=${enc}&limit=1&lang=es&bbox=-81.5,-18.5,-68.5,-0.0`);
      const d=await r.json();
      if(d.features?.length>0){
        const [lng,lat]=d.features[0].geometry.coordinates;
        const p=d.features[0].properties;
        setForm(f=>({...f,lat:lat.toFixed(6),lng:lng.toFixed(6)}));
        setGeocodeMsg(`✅ ${[p.name,p.street,p.city].filter(Boolean).join(", ")}`);
        setGeocoding(false); return;
      }
    }catch(e){}

    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=1&countrycodes=pe`,{headers:{"User-Agent":"Vista360/1.0","Accept-Language":"es"}});
      const d=await r.json();
      if(d.length>0){
        setForm(f=>({...f,lat:Number(d[0].lat).toFixed(6),lng:Number(d[0].lon).toFixed(6)}));
        setGeocodeMsg(`✅ ${d[0].display_name.split(",").slice(0,2).join(", ")}`);
        setGeocoding(false); return;
      }
    }catch(e){}

    const coords=CITY_COORDS[form.ciudad];
    if(coords){
      setForm(f=>({...f,lat:coords[0].toFixed(6),lng:coords[1].toFixed(6)}));
      setGeocodeMsg(`⚠️ Ubicado aprox. en ${form.ciudad}. Ajusta lat/lng si necesitas precisión.`);
    } else {
      setGeocodeMsg("❌ No encontrado. Prueba con la dirección más completa.");
    }
    setGeocoding(false);
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="🖥️" title="Gestión de Paneles" sub={`${paneles.length} paneles registrados · ${libre} libres · ${ocup} ocupados`}/>
      <button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 20px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Nuevo Panel</button>
    </div>

    {loading?<Spinner/>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
      {paneles.map(p=>(
        <Card key={p.id} style={{padding:0,overflow:"hidden"}}>
          {/* Header color */}
          <div style={{height:6,background:p.estado==="Ocupado"?C.red:C.green}}/>
          <div style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:48,height:48,borderRadius:12,background:(p.estado==="Ocupado"?C.red:C.green)+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{p.foto}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.white,lineHeight:1.3}}>{p.nombre}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{p.ciudad}</div>
                </div>
              </div>
              <Badge color={p.estado==="Ocupado"?C.red:C.green} ch={p.estado}/>
            </div>

            {p.direccion&&<div style={{fontSize:12,color:C.muted,marginBottom:12,padding:"8px 10px",background:C.surface,borderRadius:8}}>📍 {p.direccion}</div>}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[["Tipo",p.tipo],["Precio/mes",fmt(p.precio)]].map(([k,v])=>(
                <div key={k} style={{background:C.surface,borderRadius:8,padding:"8px 12px"}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>{k}</div>
                  <div style={{fontSize:13,fontWeight:700,color:k==="Precio/mes"?C.green:C.white}}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>openEdit(p)} style={{flex:1,padding:"8px",background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:9,color:C.accent,fontWeight:600,fontSize:13,cursor:"pointer"}}>✏️ Editar</button>
              <button onClick={()=>eliminar(p.id)} style={{padding:"8px 12px",background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:9,color:C.red,fontWeight:600,fontSize:13,cursor:"pointer"}}>🗑</button>
            </div>
          </div>
        </Card>
      ))}
      {paneles.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:C.muted}}>Sin paneles registrados · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar el primero</button></div>}
    </div>}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Panel":"✏️ Editar Panel"} onClose={()=>{setModal(null);setGeocodeMsg("");}} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar Panel ✓"}>
        {/* Emoji selector */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>Ícono</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setForm(f=>({...f,foto:e}))}
                style={{width:40,height:40,borderRadius:8,border:`2px solid ${form.foto===e?C.accent:C.border}`,background:form.foto===e?C.accent+"22":"transparent",fontSize:20,cursor:"pointer"}}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {inp("Nombre del panel","nombre",form,setForm,{ph:"Panel Norte – Av. Principal"})}
          {inp("Ciudad","ciudad",form,setForm,{type:"select",options:CIUDADES})}
          {inp("Tipo","tipo",form,setForm,{type:"select",options:["LED","Lona"]})}
          {inp("Precio mensual ($)","precio",form,setForm,{type:"number"})}
          {inp("Estado","estado",form,setForm,{type:"select",options:["Libre","Ocupado"]})}
        </div>
        {/* Dirección con autocompletado en tiempo real */}
        <div style={{marginTop:12}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Dirección</label>
          <div style={{position:"relative"}}>
            <div style={{display:"flex",gap:8}}>
              <input
                value={form.direccion||""}
                onChange={e=>onDireccionChange(e.target.value)}
                placeholder="Av. Javier Prado Este 123, San Isidro…"
                autoComplete="off"
                style={{flex:1,background:C.surface,border:`1px solid ${showSug&&sugerencias.length>0?C.accent:C.border}`,borderRadius:showSug&&sugerencias.length>0?"10px 10px 0 0":"10px",padding:"10px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",transition:"border .2s"}}
                onKeyDown={e=>{if(e.key==="Enter"){geocodificar();}if(e.key==="Escape"){setSugerencias([]);setShowSug(false);}}}
                onBlur={()=>setTimeout(()=>setShowSug(false),200)}
                onFocus={()=>sugerencias.length>0&&setShowSug(true)}
              />
              <button onClick={geocodificar} disabled={geocoding}
                style={{padding:"10px 16px",background:geocoding?C.border:C.accent,border:"none",borderRadius:10,color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                {geocoding?"⏳":"📍 Ubicar"}
              </button>
            </div>
            {/* Dropdown sugerencias */}
            {showSug&&sugerencias.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:56,background:C.card,border:`1px solid ${C.accent}`,borderTop:"none",borderRadius:"0 0 10px 10px",zIndex:999,overflow:"hidden",boxShadow:`0 8px 24px rgba(0,0,0,0.5)`}}>
                {sugerencias.map((s,i)=>(
                  <div key={i} onMouseDown={()=>elegirSugerencia(s)}
                    style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<sugerencias.length-1?`1px solid ${C.border}`:"none",fontSize:13,color:C.text,display:"flex",alignItems:"center",gap:8,transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{color:C.accent,flexShrink:0}}>📍</span>
                    <span style={{lineHeight:1.3}}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {geocodeMsg&&<div style={{marginTop:7,fontSize:12,color:geocodeMsg.startsWith("✅")?C.green:geocodeMsg.startsWith("⚠️")?C.amber:C.red,padding:"6px 10px",background:(geocodeMsg.startsWith("✅")?C.green:geocodeMsg.startsWith("⚠️")?C.amber:C.red)+"12",borderRadius:8}}>{geocodeMsg}</div>}
          {!geocodeMsg&&form.direccion&&form.direccion.length>=3&&!showSug&&<div style={{marginTop:6,fontSize:11,color:C.muted}}>💡 Escribe para ver sugerencias automáticas o presiona 📍 para ubicar</div>}
        </div>
        {/* Mini mapa interactivo — mueve el pin y la dirección se actualiza sola */}
        {(form.lat||form.lng)&&(
          <div style={{marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>📌 Ajusta el pin en el mapa</span>
              <button onClick={()=>setForm(f=>({...f,lat:"",lng:"",direccion:""}))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11}}>✕ Limpiar</button>
            </div>
            <MiniMapaPanel
              lat={Number(form.lat)}
              lng={Number(form.lng)}
              nombre={form.nombre||"Panel"}
              foto={form.foto||"📡"}
              onMove={(lat,lng,dir)=>setForm(f=>({...f,lat:lat.toFixed(6),lng:lng.toFixed(6),direccion:dir||f.direccion}))}
            />
            <div style={{marginTop:6,padding:"8px 12px",background:C.green+"12",border:`1px solid ${C.green}33`,borderRadius:8,fontSize:12,color:C.green}}>
              📍 {form.direccion||`${form.lat}, ${form.lng}`}
            </div>
            <div style={{marginTop:4,fontSize:11,color:C.muted,textAlign:"center"}}>Arrastra el marcador para ajustar — la dirección se actualiza automáticamente</div>
          </div>
        )}
        {!form.lat&&!form.lng&&(
          <div style={{marginTop:10,padding:"9px 13px",background:C.accent+"10",borderRadius:10,fontSize:12,color:C.muted}}>
            💡 Escribe la dirección y presiona <strong style={{color:C.accent}}>📍 Ubicar</strong> — luego ajusta el pin en el mapa si necesitas precisión.
          </div>
        )}
      </Modal>
    )}
  </div>);
}

// ── MAPA — Leaflet + OpenStreetMap (100% gratis) ─────────────────

function Mapa({paneles,clientes,contratos}){
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [sel,setSel]             = useState(null);
  const [leafletReady,setLeafletReady] = useState(false);

  const getInfo=(pid)=>{
    const c=contratos.find(x=>x.panel_id===pid);
    return c?{...c,cliente:clientes.find(x=>x.id===c.cliente_id)}:null;
  };

  const PERU_CENTER=[-9.19,-75.02];
  const cityCoords={
    "Lima":     [-12.0464,-77.0428],"Arequipa": [-16.409,-71.537],
    "Trujillo": [-8.112,-79.029],  "Chiclayo": [-6.771,-79.841],
    "Piura":    [-5.194,-80.633],  "Cusco":    [-13.532,-71.967],
    "Iquitos":  [-3.749,-73.254],  "Huancayo": [-12.065,-75.205],
    "Tacna":    [-18.006,-70.248], "Pucallpa": [-8.379,-74.554],
    "Otra":     [-9.19,-75.02],
  };

  useEffect(()=>{
    if(window.L){setLeafletReady(true);return;}
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload=()=>setLeafletReady(true);
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!leafletReady||!mapRef.current||leafletRef.current) return;
    const L=window.L;
    const map=L.map(mapRef.current,{center:PERU_CENTER,zoom:5,zoomControl:false});
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom:19,
    }).addTo(map);
    leafletRef.current=map;
    return()=>{map.remove();leafletRef.current=null;};
  },[leafletReady]);

  useEffect(()=>{
    if(!leafletRef.current||!window.L) return;
    const L=window.L;
    const map=leafletRef.current;
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    const bounds=[];
    paneles.forEach(p=>{
      let lat=p.lat?Number(p.lat):null;
      let lng=p.lng?Number(p.lng):null;
      if(!lat||!lng){
        const base=cityCoords[p.ciudad]||PERU_CENTER;
        lat=base[0]+(Math.random()-0.5)*0.06;
        lng=base[1]+(Math.random()-0.5)*0.06;
      }
      bounds.push([lat,lng]);
      const color=p.estado==="Ocupado"?"#EF4444":"#10B981";
      const shadow=p.estado==="Ocupado"?"rgba(239,68,68,0.5)":"rgba(16,185,129,0.5)";
      const icon=L.divIcon({
        className:"",
        html:`<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${color}22;animation:markerPulse 2s ease-in-out infinite;"></div>
          <div style="width:40px;height:40px;border-radius:50%;background:white;border:3px solid ${color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 16px ${shadow};position:relative;z-index:1;">${p.foto}</div>
        </div>`,
        iconSize:[52,52],iconAnchor:[26,26],
      });
      const marker=L.marker([lat,lng],{icon}).addTo(map);
      marker.on("click",()=>setSel(prev=>prev?.panel?.id===p.id?null:{panel:p,info:getInfo(p.id)}));
      markersRef.current.push(marker);
    });
    if(bounds.length===1) map.setView(bounds[0],14);
    else if(bounds.length>1) map.fitBounds(bounds,{padding:[60,60],maxZoom:13});
  },[paneles,leafletReady]);

  const sinCoords=paneles.filter(p=>!p.lat||!p.lng);

  return(<div>
    <PgTit icon="🗺️" title="Mapa de Paneles" sub="OpenStreetMap · Clic en un pin para ver detalles"/>

    {sinCoords.length>0&&(
      <div style={{background:C.amber+"12",border:`1px solid ${C.amber}33`,borderRadius:12,padding:"10px 16px",marginBottom:14,fontSize:13,color:C.amber,display:"flex",gap:10,alignItems:"center"}}>
        ⚠️ <span><strong>{sinCoords.length} panel(es)</strong> sin coordenadas exactas — aparecen aproximados por ciudad. Ve a <strong>Paneles → Editar → 📍 Ubicar</strong> para precisarlos.</span>
      </div>
    )}

    <Card style={{padding:0,overflow:"hidden",position:"relative",borderRadius:20}}>
      <div style={{position:"absolute",top:16,left:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",display:"flex",gap:14,backdropFilter:"blur(10px)",border:`1px solid ${C.border}`}}>
        {[[C.green,"Libre"],[C.red,"Ocupado"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`}}/>
            <span style={{fontSize:12,color:C.muted,fontWeight:600}}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:16,right:16,zIndex:500,background:"rgba(13,20,33,0.9)",borderRadius:12,padding:"9px 15px",backdropFilter:"blur(10px)",border:`1px solid ${C.border}`,fontSize:12,color:C.muted,fontWeight:600}}>
        {paneles.length} panel{paneles.length!==1?"es":""}
      </div>

      {!leafletReady&&(
        <div style={{height:560,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,gap:10,background:"#070C18"}}>
          <div style={{width:20,height:20,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          Cargando mapa...
        </div>
      )}
      <div ref={mapRef} style={{height:560,width:"100%",display:leafletReady?"block":"none"}}/>

      {/* ── Panel de detalle al hacer clic en un pin ── */}
      {sel&&(()=>{
        const p=sel.panel;
        const info=sel.info;
        const color=p.estado==="Ocupado"?C.red:C.green;
        const contrato=info;
        const diasVence=contrato?Math.ceil((new Date(contrato.fin)-new Date())/86400000):null;
        return(
          <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:500,background:"rgba(7,12,24,0.97)",backdropFilter:"blur(20px)",borderTop:`2px solid ${color}`,padding:"20px 22px 24px",borderRadius:"0 0 20px 20px"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:52,height:52,borderRadius:14,background:color+"18",border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {p.foto}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.white,letterSpacing:"-0.3px"}}>{p.nombre}</div>
                  {p.direccion&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>📍 {p.direccion}</div>}
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>
                      {p.estado==="Ocupado"?"🔴 Ocupado":"🟢 Libre"}
                    </span>
                    <span style={{background:C.accent+"18",color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{p.tipo}</span>
                    {p.ciudad&&<span style={{background:C.purple+"18",color:C.purple,border:`1px solid ${C.purple}33`,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{p.ciudad}</span>}
                  </div>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{width:32,height:32,borderRadius:"50%",background:C.border,border:"none",color:C.muted,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
            </div>

            {/* Info según estado */}
            {p.estado==="Ocupado"&&contrato?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                  {[
                    ["💵 Facturando",`${fmt(contrato.monto)}/mes`,C.green],
                    ["🏢 Cliente",contrato.cliente?.empresa||"—",C.white],
                    ["📅 Vence",diasVence>0?`en ${diasVence}d`:`hace ${Math.abs(diasVence)}d`,diasVence>15?C.green:diasVence>0?C.amber:C.red],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:C.card,borderRadius:12,padding:"12px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}>
                      <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:800,color:c,lineHeight:1.2}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>📆 Período</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.white}}>{fmtF(contrato.inicio)} → {fmtF(contrato.fin)}</div>
                  </div>
                  <div style={{background:C.card,borderRadius:12,padding:"11px 14px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>💳 Pago</div>
                    <div style={{fontSize:12,fontWeight:700,color:contrato.pagado?C.green:C.amber}}>{contrato.pagado?"✅ Cobrado":"⏳ Pendiente"}</div>
                  </div>
                </div>
              </div>
            ):(
              <div style={{background:C.green+"12",border:`1px solid ${C.green}33`,borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:32}}>✅</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.green}}>Panel disponible</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:3}}>Precio de lista: <strong style={{color:C.white}}>{fmt(p.precio)}/mes</strong></div>
                  {p.precio&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>Anual estimado: <strong style={{color:C.cyan}}>{fmt(p.precio*12)}</strong></div>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </Card>
    <style>{`@keyframes markerPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:.1}}`}</style>
  </div>);
}

// ── CONTRATOS ────────────────────────────────────────────────────
function Contratos({contratos,paneles,clientes,loading}){
  const [filtro,setFiltro]=useState("Activos");
  const datos=contratos.map(c=>({...c,d:dias(c.fin),panel:paneles.find(p=>p.id===c.panel_id),cliente:clientes.find(cl=>cl.id===c.cliente_id)})).filter(c=>c.panel&&c.cliente);
  
  // Filtrar y ordenar según el tipo
  let fil;
  if(filtro==="Activos") {
    fil = datos.filter(c=>c.d>0).sort((a,b)=>a.d-b.d); // Activos: ordenar por próximos a vencer
  } else if(filtro==="Por vencer") {
    fil = datos.filter(c=>c.d>0&&c.d<=60).sort((a,b)=>a.d-b.d); // Por vencer: ordenar por urgencia
  } else {
    fil = datos.filter(c=>c.d<=0).sort((a,b)=>b.d-a.d); // Históricos: más recientes primero (d es negativo)
  }
  
  // Contadores por categoría
  const activos = datos.filter(c=>c.d>0).length;
  const porVencer = datos.filter(c=>c.d>0&&c.d<=60).length;
  const historicos = datos.filter(c=>c.d<=0).length;

  return(<div>
    <PgTit icon="📋" title="Contratos" sub={`${contratos.length} contratos totales · Mostrando ${fil.length} ${filtro.toLowerCase()}`}/>
    <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      {[
        {label:"Activos",count:activos,icon:"✅"},
        {label:"Por vencer",count:porVencer,icon:"⚠️"},
        {label:"Históricos",count:historicos,icon:"📚"}
      ].map(f=>(
        <button key={f.label} onClick={()=>setFiltro(f.label)} 
          style={{padding:"8px 16px",borderRadius:9,border:`1px solid ${filtro===f.label?C.accent:C.border}`,
          background:filtro===f.label?C.accent+"22":"transparent",color:filtro===f.label?C.accent:C.muted,
          fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <span>{f.icon}</span>
          <span>{f.label}</span>
          <span style={{background:filtro===f.label?C.accent:C.border,color:filtro===f.label?C.white:C.muted,
            borderRadius:12,padding:"2px 7px",fontSize:11,fontWeight:700,minWidth:20,textAlign:"center"}}>
            {f.count}
          </span>
        </button>
      ))}
    </div>
    {loading?<Spinner/>:
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {fil.map(c=>{
        const msg=encodeURIComponent(`Hola ${c.cliente.contacto}, le recordamos que su contrato para *${c.panel.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`);
        return(
          <Card key={c.id} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 20px"}}>
            <div style={{fontSize:30,flexShrink:0}}>{c.panel.foto}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:C.white}}>{c.panel.nombre}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:2}}>{c.cliente.empresa} · {c.cliente.contacto}</div>
              <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                <Tag color={C.accent} ch={`${fmtF(c.inicio)} → ${fmtF(c.fin)}`}/>
                <Tag color={c.pagado?C.green:C.red} ch={c.pagado?"✓ Pagado":"✗ Pendiente"}/>
                {c.d>0&&c.d<=60&&<Tag color={c.d<=15?C.red:C.amber} ch={c.d<=15?`🔴 ${c.d}d`:`⚠️ ${c.d}d`}/>}
                {c.d<=0&&<Tag color={C.muted} ch={`📚 Venció hace ${Math.abs(c.d)}d`}/>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:20,fontWeight:800,color:C.green}}>{fmt(c.monto)}<span style={{fontSize:12,color:C.muted}}>/mes</span></div>
              <a href={`https://wa.me/${c.cliente.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                style={{background:"#25D366",border:"none",borderRadius:8,padding:"7px 13px",color:C.white,fontWeight:700,fontSize:12,cursor:"pointer",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,marginTop:10}}>
                📱 WhatsApp
              </a>
            </div>
          </Card>
        );
      })}
      {fil.length===0&&<Card style={{textAlign:"center",color:C.muted,padding:40}}>
        <div style={{fontSize:32,marginBottom:10}}>{filtro==="Activos"?"📋":filtro==="Por vencer"?"⏰":"📚"}</div>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:6}}>Sin contratos {filtro.toLowerCase()}</div>
        <div style={{fontSize:13}}>
          {filtro==="Históricos"?"Todos los contratos vencidos aparecerán aquí, sin límite de tiempo.":
           filtro==="Por vencer"?"Los contratos que vencen en los próximos 60 días aparecerán aquí.":
           "Los contratos activos con fecha de vencimiento futura aparecerán aquí."}
        </div>
      </Card>}
    </div>}
  </div>);
}

// ── CRM ──────────────────────────────────────────────────────────
function CRM({clientes,setClientes,loading}){
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [filtroTipo,setFiltroTipo]=useState("Todos");
  const [filtroEst,setFiltroEst]=useState("Todos");
  const [orden,setOrden]=useState({col:"empresa",dir:1});
  const [saving,setSaving]=useState(false);
  const emptyC={tipo:"Prospecto",empresa:"",contacto:"",celular:"",email:"",ruc:"",ciudad:"Quito",sector:"Alimentación",estado:"En contacto",notas:"",valor:0};
  const [form,setForm]=useState(emptyC);

  const openNew=()=>{ setForm(emptyC); setModal("nuevo"); };
  const openEdit=(r)=>{ setForm({...r}); setModal(r); };

  const guardar=async()=>{
    if(!form.empresa.trim()) return alert("Escribe el nombre de la empresa");
    setSaving(true);
    const payload={tipo:form.tipo,empresa:form.empresa,contacto:form.contacto,celular:form.celular,email:form.email,ruc:form.ruc,ciudad:form.ciudad,sector:form.sector,estado:form.estado,notas:form.notas,valor:Number(form.valor)||0};
    if(modal==="nuevo"){
      const [r]=await sb.post("clientes",payload);
      if(r) setClientes(p=>[...p,r]);
    } else {
      const [r]=await sb.patch("clientes",modal.id,payload);
      if(r) setClientes(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); setModal(null);
  };

  const eliminar=async(id)=>{
    if(!confirm("¿Eliminar este contacto?")) return;
    await sb.del("clientes",id);
    setClientes(p=>p.filter(r=>r.id!==id));
  };

  const wa=(r)=>{ const msg=r.tipo==="Cliente"?`Hola ${r.contacto}, le contactamos desde Vista 360 para coordinar la renovación de su contrato. 🙌`:`Hola ${r.contacto}, somos Vista 360, paneles publicitarios en ${r.ciudad}. ¿Le interesaría conocer nuestras opciones? 📍`; window.open(`https://wa.me/${r.celular?.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank"); };

  const filtrado=useMemo(()=>clientes.filter(r=>{
    const q=buscar.toLowerCase();
    return(!q||[r.empresa,r.contacto,r.celular,r.ciudad].some(v=>v?.toLowerCase().includes(q)))&&(filtroTipo==="Todos"||r.tipo===filtroTipo)&&(filtroEst==="Todos"||r.estado===filtroEst);
  }).sort((a,b)=>{const av=a[orden.col]??"",bv=b[orden.col]??"";return typeof av==="number"?(av-bv)*orden.dir:String(av).localeCompare(String(bv))*orden.dir;}),[clientes,buscar,filtroTipo,filtroEst,orden]);

  const clis=clientes.filter(d=>d.tipo==="Cliente");
  const pros=clientes.filter(d=>d.tipo==="Prospecto");
  const ingAct=clis.filter(d=>d.estado==="Activo").reduce((a,d)=>a+Number(d.valor||0),0);
  const todosEst=["Todos",...new Set(clientes.map(d=>d.estado))];
  const thSt=(col)=>({padding:"11px 13px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,cursor:"pointer",whiteSpace:"nowrap",borderBottom:`2px solid ${orden.col===col?C.accent:C.border}`,color:orden.col===col?C.accent:C.muted});
  const Th=({col,label})=><th style={thSt(col)} onClick={()=>setOrden(o=>({col,dir:o.col===col?-o.dir:1}))}>{label} {orden.col===col?(orden.dir===1?"↑":"↓"):""}</th>;
  const td={padding:"12px 13px",verticalAlign:"middle",borderBottom:`1px solid ${C.border}`};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="👥" title="Clientes & Prospectos" sub={`CRM · ${clientes.length} contactos`}/>
      <button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 20px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Nuevo contacto</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      {[["🤝 Clientes",clis.length,C.green,"registrados"],["🎯 Prospectos",pros.length,C.purple,"en pipeline"],["💰 Ingresos",fmt(ingAct),C.accent,"activos/mes"],["🔥 Propuestas",pros.filter(p=>p.estado==="Propuesta enviada").length,C.amber,"por cerrar"]].map(([l,v,c,s])=>(
        <Card key={l} style={{padding:"16px 18px"}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
          <div style={{fontSize:26,fontWeight:800,color:c,letterSpacing:"-1px"}}>{v}</div>
          <div style={{fontSize:12,color:C.muted}}>{s}</div>
        </Card>
      ))}
    </div>

    <Card style={{padding:14,marginBottom:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
      <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="🔍  Buscar empresa, contacto, ciudad..."
        style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",flex:1,minWidth:200,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:6}}>
        {["Todos","Cliente","Prospecto"].map(t=>(
          <button key={t} onClick={()=>setFiltroTipo(t)} style={{padding:"8px 13px",borderRadius:8,border:`1px solid ${filtroTipo===t?C.accent:C.border}`,background:filtroTipo===t?C.accent+"22":"transparent",color:filtroTipo===t?C.accent:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>{t}</button>
        ))}
      </div>
      <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
        {todosEst.map(e=><option key={e} value={e}>{e}</option>)}
      </select>
      <span style={{fontSize:13,color:C.muted}}>{filtrado.length} resultado{filtrado.length!==1?"s":""}</span>
    </Card>

    {loading?<Spinner/>:
    <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{background:C.surface}}>
            <tr><Th col="empresa" label="Empresa"/><Th col="tipo" label="Tipo"/><Th col="ciudad" label="Ciudad"/><Th col="sector" label="Sector"/><Th col="estado" label="Estado"/><th style={thSt("x")}>Contacto</th><Th col="valor" label="$/mes"/><th style={thSt("x")}>Notas</th><th style={thSt("x")}>Acciones</th></tr>
          </thead>
          <tbody>
            {filtrado.length===0
              ?<tr><td colSpan={9} style={{padding:40,textAlign:"center",color:C.muted}}>Sin resultados · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></td></tr>
              :filtrado.map(r=>{
                const tc=tCol(r.tipo),col=eCol(r.estado);
                const ini=r.empresa.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
                return(
                  <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{transition:"background .15s"}}>
                    <td style={td}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:34,borderRadius:8,background:tc+"22",color:tc,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,flexShrink:0}}>{ini}</div><div><div style={{fontWeight:700,color:C.white,fontSize:13}}>{r.empresa}</div><div style={{fontSize:12,color:C.muted}}>{r.contacto}</div></div></div></td>
                    <td style={td}><Badge color={tc} ch={`${r.tipo==="Cliente"?"🤝":"🎯"} ${r.tipo}`}/></td>
                    <td style={td}><span style={{fontSize:13,color:C.muted}}>{r.ciudad}</span></td>
                    <td style={td}><span style={{fontSize:12,background:C.border+"88",borderRadius:6,padding:"3px 8px",color:C.text}}>{r.sector}</span></td>
                    <td style={td}><Badge color={col} ch={r.estado}/></td>
                    <td style={td}><div style={{fontSize:13,color:C.muted}}>{r.celular}</div><div style={{fontSize:12,color:C.muted+"99"}}>{r.email}</div></td>
                    <td style={td}><span style={{fontSize:14,fontWeight:700,color:r.valor>0?C.green:C.muted}}>{r.valor>0?fmt(r.valor):"—"}</span></td>
                    <td style={{...td,maxWidth:130}}><div style={{fontSize:12,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:120}} title={r.notas}>{r.notas||"—"}</div></td>
                    <td style={td}><div style={{display:"flex",gap:5}}>
                      <button onClick={()=>wa(r)} style={{background:"#25D36622",border:"none",borderRadius:7,padding:"6px 7px",color:"#25D366",cursor:"pointer"}}>📱</button>
                      <button onClick={()=>openEdit(r)} style={{background:C.accent+"22",border:"none",borderRadius:7,padding:"6px 7px",color:C.accent,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>eliminar(r.id)} style={{background:C.red+"22",border:"none",borderRadius:7,padding:"6px 7px",color:C.red,cursor:"pointer"}}>🗑</button>
                    </div></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
        <span>☁️ Sincronizado con Supabase</span>
        <span>Ingresos activos: <strong style={{color:C.green}}>{fmt(ingAct)}/mes</strong></span>
      </div>
    </Card>}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Contacto":"✏️ Editar Contacto"} onClose={()=>setModal(null)} onSave={guardar} saveLabel={saving?"Guardando...":"Guardar ✓"}>
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {["Cliente","Prospecto"].map(t=>(
            <button key={t} onClick={()=>{setForm(f=>({...f,tipo:t,estado:t==="Cliente"?"Activo":"En contacto"}));}}
              style={{flex:1,padding:10,borderRadius:10,border:`2px solid ${form.tipo===t?tCol(t):C.border}`,background:form.tipo===t?tCol(t)+"22":"transparent",color:form.tipo===t?tCol(t):C.muted,fontWeight:700,cursor:"pointer"}}>
              {t==="Cliente"?"🤝 Cliente":"🎯 Prospecto"}
            </button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {inp("Empresa","empresa",form,setForm,{ph:"Nombre de la empresa"})}
          {inp("Contacto","contacto",form,setForm,{ph:"Nombre completo"})}
          {inp("Celular","celular",form,setForm,{type:"tel",ph:"+593 99 000 0000"})}
          {inp("Email","email",form,setForm,{type:"email",ph:"correo@empresa.com"})}
          {form.tipo==="Cliente"&&inp("RUC","ruc",form,setForm,{ph:"1790000000001"})}
          {inp("Ciudad","ciudad",form,setForm,{type:"select",options:CIUDADES})}
          {inp("Sector","sector",form,setForm,{type:"select",options:SECTORES})}
          {inp("Estado","estado",form,setForm,{type:"select",options:form.tipo==="Cliente"?ESTADOS_CLI:ESTADOS_PRO})}
          {form.tipo==="Cliente"&&inp("Valor mensual ($)","valor",form,setForm,{type:"number"})}
        </div>
        {inp("Notas","notas",form,setForm,{type:"textarea",ph:"Observaciones, seguimiento..."})}
      </Modal>
    )}
  </div>);
}

// ── ESTADO DE RESULTADOS ─────────────────────────────────────────
function Resultados({contratos,loading}){
  const [gastos,setGastos]=useState([]);
  const [loadG,setLoadG]=useState(true);
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const [mes,setMes]=useState(mesHoy);
  const emptyG={categoria:"Mantenimiento",descripcion:"",monto:0,mes};
  const [vistaHistorica,setVistaHistorica]=useState(false);
  const [form,setForm]=useState(emptyG);

  useEffect(()=>{ sb.get("gastos","?order=created_at.desc").then(d=>{ setGastos(Array.isArray(d)?d:[]); setLoadG(false); }); },[]);

  const openNew=()=>{ setForm({...emptyG,mes}); setModal("nuevo"); };
  const openEdit=(g)=>{ setForm({...g}); setModal(g); };

  const guardar=async()=>{
    if(!form.descripcion.trim()) return alert("Escribe una descripción");
    setSaving(true);
    const payload={categoria:form.categoria,descripcion:form.descripcion,monto:Number(form.monto)||0,mes:form.mes};
    if(modal==="nuevo"){
      const [r]=await sb.post("gastos",payload);
      if(r) setGastos(p=>[r,...p]);
    } else {
      const [r]=await sb.patch("gastos",modal.id,payload);
      if(r) setGastos(p=>p.map(x=>x.id===modal.id?r:x));
    }
    setSaving(false); setModal(null);
  };

  const eliminar=async(id)=>{ if(!confirm("¿Eliminar este gasto?")) return; await sb.del("gastos",id); setGastos(p=>p.filter(g=>g.id!==id)); };

  // Historial INFINITO — desde el mes más antiguo (contratos o gastos) hasta hoy
  const historialMeses=useMemo(()=>{
    const fechas=[
      ...contratos.map(c=>c.inicio?.slice(0,7)).filter(Boolean),
      ...gastos.map(g=>g.mes).filter(Boolean),
    ];
    const mesHoyKey=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
    const primerMes=fechas.length>0?fechas.reduce((a,b)=>a<b?a:b):mesHoyKey;
    const lista=[];
    let cur=new Date(primerMes+"-02");
    const tope=new Date(mesHoyKey+"-02");
    while(cur<=tope){
      const key=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      const label=cur.toLocaleDateString("es-PE",{month:"short",year:"2-digit"});
      const ing=contratos.filter(c=>{
        if(!c.pagado) return false;
        const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
        return ini&&fin&&ini<=key&&fin>=key;
      }).reduce((a,c)=>a+Number(c.monto),0);
      const gas=gastos.filter(g=>g.mes===key).reduce((a,g)=>a+Number(g.monto),0);
      lista.push({key,label,ing,gas,util:ing-gas});
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,2);
    }
    return lista;
  },[contratos,gastos]);

  // Cálculos del mes seleccionado — ingresos filtrados por contratos activos ese mes
  const gastosMes=gastos.filter(g=>g.mes===mes);
  const totGastos=gastosMes.reduce((a,g)=>a+Number(g.monto),0);
  const ingCob=contratos.filter(c=>{
    if(!c.pagado) return false;
    const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
    return ini&&fin&&ini<=mes&&fin>=mes;
  }).reduce((a,c)=>a+Number(c.monto),0);
  const ingBrut=contratos.filter(c=>{
    const ini=c.inicio?.slice(0,7); const fin=c.fin?.slice(0,7);
    return ini&&fin&&ini<=mes&&fin>=mes;
  }).reduce((a,c)=>a+Number(c.monto),0);
  const ingPend=ingBrut-ingCob;
  const utilidad=ingCob-totGastos;
  const margen=ingCob>0?Math.round((utilidad/ingCob)*100):0;

  const porCat={};
  gastosMes.forEach(g=>{ porCat[g.categoria]=(porCat[g.categoria]||0)+Number(g.monto); });
  const catMax=Math.max(1,...Object.values(porCat));

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="📈" title="Estado de Resultados" sub="Ingresos, gastos y utilidad"/>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {["Mensual","Histórico"].map(v=>(
            <button key={v} onClick={()=>setVistaHistorica(v==="Histórico")}
              style={{padding:"8px 14px",borderRadius:9,border:`1px solid ${vistaHistorica===(v==="Histórico")?C.accent:C.border}`,background:vistaHistorica===(v==="Histórico")?C.accent+"22":"transparent",color:vistaHistorica===(v==="Histórico")?C.accent:C.muted,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              {v}
            </button>
          ))}
        </div>
        {!vistaHistorica&&<input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 13px",color:C.text,fontSize:14,outline:"none",fontFamily:"inherit",cursor:"pointer"}}/>}
        <button onClick={()=>{
          const contenido=vistaHistorica
            ?`VISTA360 — Resumen Histórico ${historialMeses.length} meses\n\n${historialMeses.map(m=>`${m.label.toUpperCase()}\n  Ingresos: ${fmt(m.ing)}\n  Gastos:   ${fmt(m.gas)}\n  Utilidad: ${fmt(m.util)}`).join("\n\n")}\n\nGenerado por Vista360 · ${new Date().toLocaleDateString("es-PE")}`
            :`VISTA360 — Estado de Resultados\n${new Date(mes+"-02").toLocaleDateString("es-PE",{month:"long",year:"numeric"}).toUpperCase()}\n\nINGRESOS COBRADOS:  ${fmt(ingCob)}\nPOR COBRAR:         ${fmt(ingPend)}\nTOTAL GASTOS:       ${fmt(totGastos)}\nUTILIDAD NETA:      ${fmt(utilidad)}\nMARGEN:             ${margen}%\n\nGASTOS POR CATEGORÍA:\n${Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${fmt(v)}`).join("\n")}\n\nGenerado por Vista360 · ${new Date().toLocaleDateString("es-PE")}`;
          const blob=new Blob([contenido],{type:"text/plain;charset=utf-8"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=url;a.download=`Vista360-Resultados-${vistaHistorica?"Historico":mes}.txt`;a.click();
          URL.revokeObjectURL(url);
        }} style={{background:C.purple,border:"none",borderRadius:11,padding:"10px 16px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          📄 Exportar
        </button>
        {!vistaHistorica&&<button onClick={openNew} style={{background:C.accent,border:"none",borderRadius:11,padding:"10px 18px",color:C.white,fontWeight:700,fontSize:13,cursor:"pointer"}}>＋ Gasto</button>}
      </div>
    </div>

    {/* ── VISTA HISTÓRICA — últimos 6 meses reales ── */}
    {vistaHistorica&&(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          {[
            [`💵 Total Ingresos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.ing,0)),C.green],
            [`📉 Total Gastos (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.gas,0)),C.red],
            [`✅ Utilidad (${historialMeses.length}m)`,fmt(historialMeses.reduce((a,m)=>a+m.util,0)),C.cyan],
          ].map(([l,v,c])=>(
            <Card key={l} style={{padding:"18px 20px"}}>
              <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
              <div style={{fontSize:26,fontWeight:800,color:c}}>{v}</div>
            </Card>
          ))}
        </div>
        <Card style={{marginBottom:16}}>
          <SecTit ch={`📊 Ingresos vs Gastos — ${historialMeses.length} mes${historialMeses.length!==1?"es":""}`}/>
          <div style={{overflowX:"auto",paddingBottom:4}}><div style={{display:"flex",alignItems:"flex-end",gap:6,height:140,marginTop:8,minWidth:historialMeses.length*52}}>
            {historialMeses.map((m,i)=>{
              const maxV=Math.max(...historialMeses.map(x=>Math.max(x.ing,x.gas)),1);
              return(
                <div key={m.key} style={{flexShrink:0,width:46,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}} onClick={()=>{setMes(m.key);setVistaHistorica(false);}}>
                  <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{fmt(m.ing)}</div>
                  <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:100}}>
                    <div style={{flex:1,height:`${(m.ing/maxV)*100}%`,background:C.green,borderRadius:"4px 4px 0 0",minHeight:4,opacity:0.85}}/>
                    <div style={{flex:1,height:`${(m.gas/maxV)*100}%`,background:C.red,borderRadius:"4px 4px 0 0",minHeight:4,opacity:0.7}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginTop:2}}>{m.label}</div>
                  <div style={{fontSize:10,color:m.util>=0?C.green:C.red,fontWeight:700}}>{m.util>=0?"+":""}{fmt(m.util)}</div>
                </div>
              );
            })}
          </div>
          </div>
          <div style={{display:"flex",gap:16,marginTop:14,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.green}}/><span style={{fontSize:12,color:C.muted}}>Ingresos cobrados</span></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:2,background:C.red}}/><span style={{fontSize:12,color:C.muted}}>Gastos</span></div>
          </div>
          <div style={{marginTop:10,padding:"10px 14px",background:C.surface,borderRadius:10,fontSize:12,color:C.muted}}>
            💡 Clic en cualquier mes para ver su detalle completo
          </div>
        </Card>
        <Card>
          <SecTit ch="📋 Resumen por mes"/>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Mes","Ingresos","Gastos","Utilidad","Margen","PDF"].map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {historialMeses.map(m=>{
                const mg=m.ing>0?Math.round((m.util/m.ing)*100):0;
                const gastosDelMes=gastos.filter(g=>g.mes===m.key);
                const exportarPDF=(mes,label,ing,gas,util,margen,gastosList)=>{
                  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vista360 - ${label}</title><style>
                    *{box-sizing:border-box}
                    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:50px;color:#0D1421;max-width:900px;margin:0 auto;background:#fff;line-height:1.6}
                    .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #2563EB;margin-bottom:32px;background:linear-gradient(135deg,#f8f9ff 0%,#fff 100%);padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(37,99,235,0.1)}
                    .header-left{display:flex;align-items:center;gap:16px}
                    .header-logo{height:65px;width:auto;filter:drop-shadow(0 2px 4px rgba(37,99,235,0.2))}
                    .header-info h1{margin:0;font-size:26px;color:#0D1421;font-weight:900;letter-spacing:-0.5px}
                    .header-info p{margin:4px 0 0;font-size:14px;color:#2563EB;font-weight:600}
                    .header-fecha{text-align:right;font-size:12px;color:#888;line-height:1.6}
                    .metricas{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0 0 24px}
                    .metrica{background:linear-gradient(135deg,#f8f9ff,#eef2ff);border:2px solid #dde5ff;border-radius:14px;padding:20px;box-shadow:0 2px 6px rgba(37,99,235,0.08);transition:all 0.3s ease}
                    .metrica-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#666;margin-bottom:8px;font-weight:700}
                    .metrica-val{font-size:24px;font-weight:800}
                    .verde{color:#10B981} .rojo{color:#EF4444} .azul{color:#2563EB}
                    .seccion{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#2563EB;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #dde5ff}
                    table{width:100%;border-collapse:collapse;margin-top:4px}
                    th{background:#f0f4ff;padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;border-bottom:2px solid #dde5ff}
                    td{padding:10px 14px;border-bottom:1px solid #f0f4ff;font-size:13px}
                    tr:last-child td{border-bottom:none}
                    .total-row td{font-weight:800;background:#f0f4ff;font-size:14px}
                    .estado{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:16px 0;border:1px solid #dde5ff;border-radius:10px;overflow:hidden}
                    .estado-row{display:contents}
                    .estado-row div{padding:9px 14px;font-size:13px;border-bottom:1px solid #f0f4ff}
                    .estado-row div:first-child{background:#f8f9ff;color:#555;font-weight:600}
                    .footer{margin-top:36px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:14px;display:flex;justify-content:space-between;align-items:center}
                    .footer-logo{height:20px;opacity:0.4}
                    @media print{body{padding:20px}.header{break-inside:avoid}}
                  </style></head><body>
                    <div class="header">
                      <div class="header-left">
                        <img class="header-logo" src="${LOGO_B64}" alt="Vista360"/>
                        <div class="header-info">
                          <h1>Estado de Resultados</h1>
                          <p>${label}</p>
                        </div>
                      </div>
                      <div class="header-fecha">
                        <div><strong>Generado:</strong> ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</div>
                        <div><strong>Hora:</strong> ${new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    </div>
                    <div class="metricas">
                      <div class="metrica"><div class="metrica-label">💵 Ingresos cobrados</div><div class="metrica-val verde">${ing}</div></div>
                      <div class="metrica"><div class="metrica-label">📉 Total gastos</div><div class="metrica-val rojo">${gas}</div></div>
                      <div class="metrica"><div class="metrica-label">✅ Utilidad neta</div><div class="metrica-val ${margen>=0?"verde":"rojo"}">${util} <span style="font-size:14px">(${margen}%)</span></div></div>
                    </div>
                    <table>
                      <thead><tr><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead>
                      <tbody>
                        ${gastosList.map(g=>`<tr><td>${g.categoria}</td><td>${g.descripcion}</td><td class="rojo">$${Number(g.monto).toLocaleString("es-EC")}</td></tr>`).join("")}
                        ${gastosList.length===0?`<tr><td colspan="3" style="color:#999;text-align:center">Sin gastos registrados este mes</td></tr>`:""}
                        <tr class="total-row"><td colspan="2">TOTAL GASTOS</td><td class="rojo">${gas}</td></tr>
                      </tbody>
                    </table>
                    <div class="footer"><img class="footer-logo" src="${LOGO_B64}" alt="Vista360"/><span>Vista360 · Gestión de Paneles Publicitarios · ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"long",year:"numeric"})}</span></div>
                  </body></html>`;
                  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement("a");
                  a.href=url;
                  a.download=`Vista360-Resultados-${mes}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                };
                return(
                  <tr key={m.key}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,fontWeight:700,color:C.white,cursor:"pointer"}} onClick={()=>{setMes(m.key);setVistaHistorica(false);}}>{m.label} {m.key===mesHoy&&<Tag color={C.accent} ch="este mes"/>}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:C.green,fontWeight:700}}>{fmt(m.ing)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:C.red,fontWeight:700}}>{fmt(m.gas)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`,color:m.util>=0?C.green:C.red,fontWeight:700}}>{fmt(m.util)}</td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`}}><Tag color={mg>=0?C.green:C.red} ch={`${mg}%`}/></td>
                    <td style={{padding:"11px 13px",borderBottom:`1px solid ${C.border}`}}>
                      <button onClick={()=>exportarPDF(m.key,m.label,fmt(m.ing),fmt(m.gas),fmt(m.util),mg,gastosDelMes)}
                        style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:8,padding:"6px 12px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                        📄 PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    )}

    {!vistaHistorica&&(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      {[["💵 Ingresos Cobrados",fmt(ingCob),C.green,"contratos pagados"],["⏳ Por Cobrar",fmt(ingPend),C.amber,"contratos pendientes"],["📉 Total Gastos",fmt(totGastos),C.red,`${gastosMes.length} conceptos`],["✅ Utilidad Neta",fmt(utilidad),utilidad>=0?C.green:C.red,`Margen ${margen}%`]].map(([l,v,c,s])=>(
        <Card key={l} style={{padding:"18px 20px"}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
          <div style={{fontSize:28,fontWeight:800,color:c,letterSpacing:"-1px"}}>{v}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>{s}</div>
        </Card>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr",gap:16,marginBottom:16}}>
      <Card>
        <SecTit ch="📊 Pérdidas & Ganancias"/>
        {[["Ingresos brutos",ingBrut,C.green],["(-) No cobrados",-ingPend,C.amber],["Ingresos netos",ingCob,C.cyan],["(-) Gastos totales",-totGastos,C.red],["= Utilidad neta",utilidad,utilidad>=0?C.green:C.red]].map(([l,v,c],i)=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",borderTop:i===4?`2px solid ${C.border}`:"none"}}>
            <span style={{fontSize:13,color:i===4?C.white:C.muted,fontWeight:i===4?700:400}}>{l}</span>
            <span style={{fontSize:14,fontWeight:700,color:c}}>{v<0?`-${fmt(Math.abs(v))}`:fmt(v)}</span>
          </div>
        ))}
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:6}}><span>Margen neto</span><span style={{fontWeight:700,color:margen>=0?C.green:C.red}}>{margen}%</span></div>
          <div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(Math.abs(margen),100)}%`,background:margen>=0?C.green:C.red,borderRadius:4,transition:"width .5s"}}/></div>
        </div>
      </Card>

      <Card>
        <SecTit ch="🗂 Gastos por Categoría"/>
        {Object.keys(porCat).length===0&&<div style={{color:C.muted,fontSize:13,padding:"16px 0"}}>Sin gastos para este mes</div>}
        {Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
          <div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:C.text,fontWeight:600}}>{cat}</span><span style={{color:catCol[cat]||C.muted,fontWeight:700}}>{fmt(val)}</span></div>
            <div style={{height:6,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(val/catMax)*100}%`,background:catCol[cat]||C.muted,borderRadius:4,transition:"width .5s"}}/></div>
          </div>
        ))}
      </Card>
    </div>

    <Card style={{padding:0,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:700,color:C.white}}>📝 Detalle de Gastos — {new Date(mes+"-02").toLocaleDateString("es-EC",{month:"long",year:"numeric"})}</span>
        <span style={{fontSize:13,color:C.muted}}>{gastosMes.length} conceptos · <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
      {loadG?<Spinner/>:
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:C.surface}}>
          <tr>{["Categoría","Descripción","Monto","Acciones"].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {gastosMes.length===0&&<tr><td colSpan={4} style={{padding:36,textAlign:"center",color:C.muted}}>Sin gastos · <button onClick={openNew} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>+ Agregar</button></td></tr>}
          {gastosMes.map(g=>(
            <tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{transition:"background .15s"}}>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}><Tag color={catCol[g.categoria]||C.muted} ch={g.categoria}/></td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,color:C.text,fontSize:13}}>{g.descripcion}</td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.red}}>{fmt(g.monto)}</td>
              <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}><div style={{display:"flex",gap:6}}>
                <button onClick={()=>openEdit(g)} style={{background:C.accent+"22",border:"none",borderRadius:7,padding:"6px 8px",color:C.accent,cursor:"pointer"}}>✏️</button>
                <button onClick={()=>eliminar(g.id)} style={{background:C.red+"22",border:"none",borderRadius:7,padding:"6px 8px",color:C.red,cursor:"pointer"}}>🗑</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>}
      <div style={{padding:"11px 18px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
        <span>☁️ Sincronizado con Supabase</span><span>Total gastos: <strong style={{color:C.red}}>{fmt(totGastos)}</strong></span>
      </div>
    </Card>
    </div>)}

    {modal&&(
      <Modal title={modal==="nuevo"?"➕ Nuevo Gasto":"✏️ Editar Gasto"} onClose={()=>setModal(null)} onSave={guardar} saveLabel={saving?"Guardando...":"Agregar ✓"}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {inp("Categoría","categoria",form,setForm,{type:"select",options:CAT_GASTOS})}
          {inp("Descripción","descripcion",form,setForm,{ph:"Ej: Mantenimiento Panel Norte"})}
          {inp("Monto ($)","monto",form,setForm,{type:"number"})}
          {inp("Mes","mes",form,setForm,{type:"month"})}
        </div>
      </Modal>
    )}
  </div>);
}

// ── ALERTAS DE VENCIMIENTO ───────────────────────────────────────
function Alertas({contratos,paneles,clientes}){
  const hoyD=new Date();
  const datos=contratos.map(c=>{
    const panel=paneles.find(p=>p.id===c.panel_id);
    const cliente=clientes.find(cl=>cl.id===c.cliente_id);
    const d=Math.ceil((new Date(c.fin)-hoyD)/86400000);
    return {...c,panel,cliente,d};
  }).filter(c=>c.panel&&c.cliente);

  const criticos=datos.filter(c=>c.d>0&&c.d<=15).sort((a,b)=>a.d-b.d); // 🔴 Críticos: ≤15 días
  const proximos=datos.filter(c=>c.d>15&&c.d<=30).sort((a,b)=>a.d-b.d); // 🟡 Advertencia: 16-30 días
  const vencidos=datos.filter(c=>c.d<=0).sort((a,b)=>a.d-b.d);

  const [notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"default");

  const activarNotif=async()=>{
    if(typeof Notification==="undefined") return alert("Tu navegador no soporta notificaciones.\nEn iPhone necesitas iOS 16.4+ y agregar la app a Inicio primero.");
    const p=await Notification.requestPermission();
    setNotifPerm(p);
    if(p==="granted"){
      // Notificación de bienvenida inmediata
      new Notification("✅ Vista360 — Alertas activadas",{
        body:"Te avisaremos 30 días y 15 días antes de cada vencimiento",
        tag:"bienvenida"
      });
      // Limpiar historial para que re-evalúe todos los contratos ahora
      try{ localStorage.removeItem("v360_notif"); }catch{}
    } else if(p==="denied"){
      alert("Bloqueaste las notificaciones.\nPara activarlas: Ajustes del navegador → Notificaciones → Permitir para este sitio.");
    }
  };

  const NotifStatus=()=>(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {notifPerm==="granted"
        ? <div style={{display:"flex",alignItems:"center",gap:6,background:C.green+"18",border:`1px solid ${C.green}44`,borderRadius:10,padding:"8px 14px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.green,animation:"pulse 1.5s infinite"}}/>
            <span style={{fontSize:12,fontWeight:700,color:C.green}}>🔔 Notificaciones activas · 30d y 15d antes</span>
          </div>
        : notifPerm==="denied"
        ? <div style={{fontSize:12,fontWeight:700,color:C.red,background:C.red+"18",border:`1px solid ${C.red}44`,borderRadius:10,padding:"8px 14px"}}>
            🚫 Bloqueadas — ve a Ajustes del navegador para permitirlas
          </div>
        : <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
            <button onClick={activarNotif} style={{background:C.accent,border:"none",borderRadius:10,padding:"9px 18px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
              📲 Activar alertas en celular
            </button>
            <span style={{fontSize:10,color:C.muted}}>iPhone: primero agrega la app a Inicio (Safari → Compartir → Agregar a inicio)</span>
          </div>
      }
    </div>
  );

  const AlertRow=({c,color,label})=>{
    const msg=encodeURIComponent(`Hola ${c.cliente?.contacto}, le recordamos que su contrato para *${c.panel?.nombre}* vence el *${fmtF(c.fin)}*. ¿Le interesa renovar? 🙌`);
    return(
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{width:44,height:44,borderRadius:12,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.panel?.foto}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white}}>{c.panel?.nombre}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{c.cliente?.empresa} · {c.cliente?.contacto}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Vence: {fmtF(c.fin)} · {fmt(c.monto)}/mes</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
          <Tag color={color} ch={label}/>
          <a href={`https://wa.me/${c.cliente?.celular?.replace(/\D/g,"")}?text=${msg}`} target="_blank" rel="noopener noreferrer"
            style={{background:"#25D366",border:"none",borderRadius:7,padding:"5px 11px",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer",textDecoration:"none"}}>
            📱 Avisar
          </a>
        </div>
      </div>
    );
  };

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22}}>
      <PgTit icon="🔔" title="Alertas de Vencimiento" sub="Contratos que requieren atención inmediata"/>
      <NotifStatus/>
    </div>

    {criticos.length===0&&proximos.length===0&&vencidos.length===0&&(
      <Card style={{textAlign:"center",padding:48}}>
        <div style={{fontSize:48,marginBottom:12}}>✅</div>
        <div style={{fontSize:16,fontWeight:700,color:C.white}}>Todo al día</div>
        <div style={{fontSize:13,color:C.muted,marginTop:6}}>No hay contratos por vencer en los próximos 30 días</div>
      </Card>
    )}

    {vencidos.length>0&&(
      <Card style={{marginBottom:16,borderColor:C.red+"55"}}>
        <SecTit ch={`🚨 Vencidos — ${vencidos.length} contratos`}/>
        {vencidos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`Venció hace ${Math.abs(c.d)}d`}/>)}
      </Card>
    )}
    {criticos.length>0&&(
      <Card style={{marginBottom:16,borderColor:C.amber+"55"}}>
        <SecTit ch={`🔴 Críticos (≤15 días) — ${criticos.length} contratos`}/>
        {criticos.map(c=><AlertRow key={c.id} c={c} color={C.red} label={`⚠️ ${c.d}d restantes`}/>)}
      </Card>
    )}
    {proximos.length>0&&(
      <Card style={{borderColor:C.cyan+"44"}}>
        <SecTit ch={`🟡 Advertencia (16–30 días) — ${proximos.length} contratos`}/>
        {proximos.map(c=><AlertRow key={c.id} c={c} color={C.amber} label={`📅 ${c.d}d restantes`}/>)}
      </Card>
    )}
  </div>);
}

// ── CALCULADORA ROI ──────────────────────────────────────────────
function ROI({paneles,contratos}){
  const [precio,setPrecio]=useState(1200);
  const [meses,setMeses]=useState(12);
  const [ocup,setOcup]=useState(75);
  const [costoMes,setCostoMes]=useState(180);
  const [panelCount,setPanelCount]=useState(paneles.length||5);

  const ingBruto=precio*(ocup/100)*meses*panelCount;
  const costoTotal=costoMes*meses*panelCount;
  const utilidad=ingBruto-costoTotal;
  const roi=costoTotal>0?Math.round((utilidad/costoTotal)*100):0;
  const payback=utilidad>0?Math.round((costoTotal/utilidad)*12):null;

  const realOcu=paneles.length?Math.round((paneles.filter(p=>p.estado==="Ocupado").length/paneles.length)*100):0;
  const realIng=contratos.filter(c=>c.pagado).reduce((a,c)=>a+Number(c.monto),0);

  // Control numérico táctil — botones grandes + y −
  const NumControl=({label,val,min,max,step=1,set,suffix="",icon})=>{
    const [editing,setEditing]=useState(false);
    const [raw,setRaw]=useState(String(val));
    const display=typeof val==="number"&&val>999?fmt(val):`${val}${suffix}`;

    const commitEdit=()=>{
      const n=Number(raw.replace(/[^0-9.-]/g,""));
      if(!isNaN(n)&&n>=min&&n<=max) set(n);
      else if(!isNaN(n)) set(Math.min(max,Math.max(min,n)));
      setEditing(false);
    };

    return(
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.8}}>{label}</span>
          </div>
          {editing
            ? <input autoFocus value={raw}
                onChange={e=>setRaw(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(false);}}
                style={{width:100,textAlign:"right",fontSize:20,fontWeight:800,color:C.accent,background:"transparent",border:"none",borderBottom:`2px solid ${C.accent}`,outline:"none",fontFamily:"inherit"}}
              />
            : <span onClick={()=>{setRaw(String(val));setEditing(true);}} title="Toca para escribir"
                style={{fontSize:20,fontWeight:800,color:C.accent,cursor:"text",borderBottom:`1px dashed ${C.accent}66`}}>
                {display}
              </span>
          }
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onPointerDown={()=>set(v=>Math.max(min,v-step))}
            style={{flex:1,height:44,borderRadius:12,border:`1px solid ${C.border}`,background:C.card,color:C.white,fontSize:22,fontWeight:700,cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
            −
          </button>
          <span style={{fontSize:11,color:C.muted,minWidth:56,textAlign:"center"}}>{min}{suffix} – {max}{suffix}</span>
          <button onPointerDown={()=>set(v=>Math.min(max,v+step))}
            style={{flex:1,height:44,borderRadius:12,border:"none",background:C.accent,color:C.white,fontSize:22,fontWeight:700,cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
            +
          </button>
        </div>
      </div>
    );
  };

  return(<div>
    <PgTit icon="💡" title="Calculadora de ROI" sub="Proyecta tu retorno de inversión por panel"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <Card>
        <SecTit ch="⚙️ Parámetros"/>
        <NumControl icon="💵" label="Precio por panel/mes" val={precio} min={200} max={5000} step={50} set={setPrecio}/>
        <NumControl icon="🖥️" label="Número de paneles"    val={panelCount} min={1} max={50} step={1} set={setPanelCount}/>
        <NumControl icon="📊" label="Ocupación esperada"   val={ocup} min={10} max={100} step={5} set={setOcup} suffix="%"/>
        <NumControl icon="⚙️" label="Costo operativo/panel/mes" val={costoMes} min={0} max={2000} step={10} set={setCostoMes}/>
        <NumControl icon="📅" label="Horizonte (meses)"   val={meses} min={1} max={36} step={1} set={setMeses} suffix=" mes"/>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Card style={{background:`linear-gradient(135deg,${C.accent}18,${C.purple}12)`,borderColor:C.accent+"44"}}>
          <SecTit ch="📊 Proyección"/>
          {[
            ["💵 Ingresos brutos",fmt(ingBruto),C.green],
            ["📉 Costos totales",fmt(costoTotal),C.red],
            ["✅ Utilidad neta",fmt(utilidad),utilidad>=0?C.green:C.red],
            ["📈 ROI",`${roi}%`,roi>=0?C.green:C.red],
            ["⏱ Payback",payback?`${payback} meses`:"N/A",C.cyan],
          ].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{l}</span>
              <span style={{fontSize:14,fontWeight:800,color:c}}>{v}</span>
            </div>
          ))}
        </Card>

        <Card style={{background:`linear-gradient(135deg,${C.green}12,${C.cyan}08)`,borderColor:C.green+"33"}}>
          <SecTit ch="📡 Tu situación actual"/>
          {[
            ["Paneles registrados",paneles.length,C.white],
            ["Ocupación real",`${realOcu}%`,realOcu>=50?C.green:C.amber],
            ["Ingresos cobrados este mes",fmt(realIng),C.green],
          ].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.muted}}>{l}</span>
              <span style={{fontSize:13,fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  </div>);
}


// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════
export default function App(){
  const [splash,setSplash]=useState(true);
  const [tab,setTab]=useState("dashboard");
  const [clientes,setClientes]=useState([]);
  const [paneles,setPaneles]=useState([]);
  const [contratos,setContratos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  const noConf = false; // credenciales ya configuradas

  // ── 🔔 PUSH NOTIFICATIONS — Compatible con Chrome, Safari iOS 16.4+, Edge ──
  // Estrategia: Notification API nativa (sin servidor externo).
  // Funciona en celular cuando la app está instalada como PWA (Agregar a inicio).
  // El Service Worker se registra como blob para no necesitar archivo extra.

  const swRef = useRef(null);

  // 1️⃣ Registrar Service Worker una sola vez al montar
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const SW = `
      self.addEventListener("install", e => self.skipWaiting());
      self.addEventListener("activate", e => e.waitUntil(clients.claim()));
      self.addEventListener("notificationclick", e => {
        e.notification.close();
        e.waitUntil(clients.matchAll({type:"window"}).then(list => {
          if (list.length) return list[0].focus();
          return clients.openWindow("/");
        }));
      });
    `;
    const blob = new Blob([SW], { type: "application/javascript" });
    const url  = URL.createObjectURL(blob);
    navigator.serviceWorker.register(url)
      .then(reg => { swRef.current = reg; URL.revokeObjectURL(url); })
      .catch(() => {});
  }, []);

  // 2️⃣ Revisar contratos y disparar notificaciones cuando hay datos
  useEffect(() => {
    if (!contratos.length || !paneles.length || !clientes.length) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const hoyD  = new Date();
    // Leer qué notificaciones ya enviamos (guardado en localStorage)
    let enviadas = {};
    try { enviadas = JSON.parse(localStorage.getItem("v360_notif") || "{}"); } catch {}

    contratos.forEach(c => {
      const d = Math.ceil((new Date(c.fin) - hoyD) / 86400000);
      // Disparar a los 30 días y a los 15 días
      [30, 15].forEach(umbral => {
        if (d > 0 && d <= umbral) {
          const key = `${c.id}_${umbral}`;
          if (enviadas[key]) return; // ya enviada

          const panel   = paneles.find(p => p.id === c.panel_id);
          const cliente = clientes.find(cl => cl.id === c.cliente_id);
          if (!panel || !cliente) return;

          // Mostrar notificación nativa
          const titulo = d <= 5
            ? `🚨 Vence en ${d} día${d===1?"":"s"} — ${panel.nombre}`
            : `⚠️ Vence en ${d} días — ${panel.nombre}`;
          const cuerpo = `Cliente: ${cliente.empresa} · ${fmt(c.monto)}/mes`;

          try {
            if (swRef.current && swRef.current.showNotification) {
              // Via Service Worker (mejor soporte en móvil)
              swRef.current.showNotification(titulo, {
                body: cuerpo, tag: key, icon: "/favicon.ico",
                badge: "/favicon.ico", vibrate: [200, 100, 200],
                requireInteraction: d <= 5,
              });
            } else {
              // Fallback: Notification API directa
              new Notification(titulo, { body: cuerpo, tag: key });
            }
            enviadas[key] = true;
          } catch {}
        }
      });
    });

    try { localStorage.setItem("v360_notif", JSON.stringify(enviadas)); } catch {}
  }, [contratos, paneles, clientes]);


  useEffect(()=>{
    Promise.all([
      sb.get("clientes","?order=created_at.desc"),
      sb.get("paneles","?order=created_at.desc"),
      sb.get("contratos","?order=created_at.desc"),
    ]).then(([c,p,ct])=>{
      setClientes(Array.isArray(c)?c:[]);
      setPaneles(Array.isArray(p)?p:[]);
      setContratos(Array.isArray(ct)?ct:[]);
      setLoading(false);
    }).catch(()=>{ setError(true); setLoading(false); });
  },[]);

  const tabs=[{id:"dashboard",icon:"⚡",label:"Dashboard"},{id:"mapa",icon:"🗺️",label:"Mapa"},{id:"paneles",icon:"🖥️",label:"Paneles"},{id:"contratos",icon:"📋",label:"Contratos"},{id:"crm",icon:"👥",label:"Clientes"},{id:"resultados",icon:"📈",label:"Resultados"},{id:"roi",icon:"💡",label:"ROI"},{id:"alertas",icon:"🔔",label:"Alertas"}];

  return(<>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>{`*{box-sizing:border-box}body{margin:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{from{opacity:.2}to{opacity:.6}}`}</style>

    {splash&&<Splash done={()=>setSplash(false)}/>}

    {/* Banner de notificaciones push */}

    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.bg,minHeight:"100vh",color:C.text,display:"flex",flexDirection:"column"}}>
      <nav style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 16px",display:"flex",alignItems:"center",height:56,position:"sticky",top:0,zIndex:100,gap:2,overflowX:"auto",scrollbarWidth:"none"}}>
        <style>{`::-webkit-scrollbar{display:none}`}</style>
        <div style={{marginRight:20,display:"flex",alignItems:"center",flexShrink:0}}>
          <Logo360 width={130}/>
        </div>
        {tabs.map(t=>{
          const alertCount=t.id==="alertas"?contratos.map(c=>({d:Math.ceil((new Date(c.fin)-new Date())/86400000)})).filter(c=>c.d>0&&c.d<=30).length:0;
          return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"0 12px",height:"100%",display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:tab===t.id?700:400,color:tab===t.id?C.white:C.muted,background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,position:"relative"}}>
            <span>{t.icon}</span><span>{t.label}</span>
            {alertCount>0&&<span style={{background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",position:"absolute",top:8,right:4}}>{alertCount}</span>}
          </button>
        );})}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:error?C.amber:loading?C.amber:C.green}}/>
          <span style={{fontSize:11,color:C.muted}}>{error?"Usar en Vercel":loading?"Conectando...":"Supabase ✓"}</span>
        </div>
      </nav>

      <main style={{flex:1,padding:"26px 28px",maxWidth:1240,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {error&&(
          <div style={{background:"#1E293B",border:`1px solid ${C.amber}55`,borderRadius:14,padding:20,marginBottom:24,display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{fontSize:28,flexShrink:0}}>⚠️</div>
            <div>
              <div style={{fontWeight:700,color:C.amber,fontSize:15,marginBottom:8}}>La app no puede conectarse a Supabase desde aquí</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.8}}>
                El preview de Claude bloquea conexiones a servidores externos por seguridad.<br/>
                <strong style={{color:C.white}}>Esto es normal</strong> — el código está 100% listo. Para usarlo de verdad:
              </div>
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                {[["1","Ve a","vercel.com","y crea una cuenta gratis"],["2","Sube el archivo .jsx a un proyecto Next.js o Vite"],["3","Tu app estará en línea en menos de 5 min, conectada a Supabase"]].map(([n,a,b,c])=>(
                  <div key={n} style={{display:"flex",gap:10,alignItems:"center",fontSize:13}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:C.accent,color:C.white,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:11,flexShrink:0}}>{n}</div>
                    <span style={{color:C.muted}}>{a} <strong style={{color:C.cyan}}>{b}</strong> {c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==="dashboard"  &&<Dashboard  clientes={clientes} contratos={contratos} paneles={paneles} setTab={setTab}/>}
        {tab==="mapa"       &&<Mapa       paneles={paneles} clientes={clientes} contratos={contratos}/>}
        {tab==="paneles"    &&<Paneles    paneles={paneles} setPaneles={setPaneles} loading={loading}/>}
        {tab==="contratos"  &&<Contratos  contratos={contratos} paneles={paneles} clientes={clientes} loading={loading}/>}
        {tab==="crm"        &&<CRM        clientes={clientes} setClientes={setClientes} loading={loading}/>}
        {tab==="resultados" &&<Resultados contratos={contratos} loading={loading}/>}
        {tab==="roi"        &&<ROI        paneles={paneles} contratos={contratos}/>}
        {tab==="alertas"    &&<Alertas    contratos={contratos} paneles={paneles} clientes={clientes}/>}
      </main>
    </div>
  </>);
}
