export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed."});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(503).json({error:"Showcase is not configured."});
 try{
  const r=await fetch(url.replace(/\\/$/,"")+"/rest/v1/tech_army_showcase?select=id,title,category,content_type,description,thumbnail_url,destination_url,creator_name,creator_phone,creator_country,contact_public&published=eq.true&order=sort_order.asc,created_at.desc",{headers:{apikey:key,Authorization:"Bearer "+key}});
  const rows=await r.json();if(!r.ok)return res.status(502).json({error:"Could not load showcase."});
  const projects=rows.map(p=>({...p,creator_phone:p.contact_public?p.creator_phone:""}));
  return res.status(200).json({projects});
 }catch{return res.status(500).json({error:"Showcase unavailable."});}
}
