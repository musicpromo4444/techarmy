const CATEGORIES=["AI Movies & Dramas","Websites & Apps","AI Graphics & Images","Videos & Animations"];
const TYPES=["video","website","image"];
function authorized(req){const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");return Boolean(process.env.ADMIN_API_KEY&&token&&token===(process.env.CONTENT_ADMIN_KEY||process.env.ADMIN_API_KEY));}
function validUrl(v){try{return new URL(v).protocol==="https:";}catch{return false;}}
export default async function handler(req,res){
 if(!authorized(req))return res.status(401).json({error:"Admin access required."});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(503).json({error:"Database is not configured."});
 const base=url.replace(/\/$/,""),headers={apikey:key,Authorization:"Bearer "+key};
 try{
  if(req.method==="GET"){const r=await fetch(base+"/rest/v1/tech_army_showcase?select=*&order=sort_order.asc,created_at.desc",{headers});const rows=await r.json();if(!r.ok)return res.status(502).json({error:"Could not load projects."});return res.status(200).json({projects:rows});}
  if(req.method==="POST"){
   const b=req.body||{};
   if(b.action==="upload"){
    if(!/^image\/(jpeg|png|webp)$/.test(b.mime_type||"")||typeof b.image_base64!=="string")return res.status(400).json({error:"Choose a JPG, PNG or WebP image."});
    const raw=b.image_base64.replace(/^data:image\/(jpeg|png|webp);base64,/,"");
    const bytes=Buffer.from(raw,"base64");if(!bytes.length||bytes.length>3*1024*1024)return res.status(400).json({error:"Image must be smaller than 3 MB."});
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[b.mime_type],name=Date.now()+"-"+Math.random().toString(36).slice(2,9)+"."+ext;
    const up=await fetch(base+"/storage/v1/object/tech-army-showcase/"+name,{method:"POST",headers:{...headers,"Content-Type":b.mime_type,"x-upsert":"false"},body:bytes});
    if(!up.ok)return res.status(502).json({error:"Image upload failed."});
    return res.status(200).json({url:base+"/storage/v1/object/public/tech-army-showcase/"+name});
   }
   const payload=clean(b);if(!payload)return res.status(400).json({error:"Complete the required project details and use valid HTTPS links."});
   const r=await fetch(base+"/rest/v1/tech_army_showcase",{method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(payload)});
   const rows=await r.json();if(!r.ok)return res.status(502).json({error:"Could not save this project."});return res.status(201).json({project:rows[0]});
  }
  if(req.method==="PATCH"){
   const b=req.body||{};if(!b.id)return res.status(400).json({error:"Project ID is required."});const payload=clean(b);if(!payload)return res.status(400).json({error:"Complete the required project details and use valid HTTPS links."});
   const r=await fetch(base+"/rest/v1/tech_army_showcase?id=eq."+encodeURIComponent(b.id),{method:"PATCH",headers:{...headers,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...payload,updated_at:new Date().toISOString()})});
   const rows=await r.json();if(!r.ok||!rows.length)return res.status(404).json({error:"Project not found or update failed."});return res.status(200).json({project:rows[0]});
  }
  if(req.method==="DELETE"){const id=req.query?.id||req.body?.id;if(!id)return res.status(400).json({error:"Project ID is required."});const r=await fetch(base+"/rest/v1/tech_army_showcase?id=eq."+encodeURIComponent(id),{method:"DELETE",headers:{...headers,Prefer:"return=representation"}});if(!r.ok)return res.status(502).json({error:"Could not delete project."});return res.status(200).json({success:true});}
  return res.status(405).json({error:"Method not allowed."});
 }catch{return res.status(500).json({error:"Content manager request failed."});}
}
function clean(b){
 if(!b||typeof b.title!=="string"||b.title.trim().length<2||b.title.length>120||!CATEGORIES.includes(b.category)||!TYPES.includes(b.content_type)||!validUrl(b.thumbnail_url)||!validUrl(b.destination_url))return null;
 const desc=String(b.description||"");if(desc.length>600)return null;
 const phone=String(b.creator_phone||"");if(phone.length>30)return null;
 return {title:b.title.trim(),category:b.category,content_type:b.content_type,description:desc,thumbnail_url:b.thumbnail_url,destination_url:b.destination_url,creator_name:String(b.creator_name||"").slice(0,100),creator_phone:phone,creator_country:String(b.creator_country||"").slice(0,80),contact_public:Boolean(b.contact_public),published:Boolean(b.published),sort_order:Number.isFinite(Number(b.sort_order))?Number(b.sort_order):0};
}
