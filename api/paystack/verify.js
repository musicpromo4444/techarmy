const PRICES = {"Starter":500000,"Professional":1500000,"Master Class":3000000};
const CLASS_GROUPS = [["Starter",process.env.WHATSAPP_GROUP_STARTER],["Professional",process.env.WHATSAPP_GROUP_PROFESSIONAL],["Master Class",process.env.WHATSAPP_GROUP_MASTER]];\nconst levelOf = value => String(value).split(" :: ").pop();
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const reference=String(req.query.reference||"");
 if(!reference||reference.length>100)return res.status(400).json({error:"A valid payment reference is required."});
 const secret=process.env.PAYSTACK_SECRET_KEY;
 if(!secret)return res.status(503).json({error:"Payment verification is not configured."});
 try{
  const response=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:`Bearer ${secret}`}});
  const result=await response.json();
  if(!response.ok||!result.status||result.data?.status!=="success")return res.status(402).json({verified:false,error:"Payment has not been confirmed by Paystack."});
  const payment=result.data,metadata=payment.metadata||{};
  const classes=[...new Set(Array.isArray(metadata.classes)?metadata.classes:String(metadata.classes||"").split(",").map(x=>x.trim()).filter(Boolean))];
  if(classes.length!==1)return res.status(400).json({verified:false,error:"Invalid package selection."});
  const expectedKobo=classes.reduce((sum,item)=>sum+(PRICES[levelOf(item)]||0),0);
  if(payment.reference!==reference||payment.currency!=="NGN"||expectedKobo<1||Number(payment.amount)!==expectedKobo)return res.status(400).json({verified:false,error:"The paid amount does not match the selected package. Please contact support."});
  const amountNaira=Number(payment.amount)/100;
  const group_links=CLASS_GROUPS.filter(([name,url])=>classes.some(item=>levelOf(item)===name)&&url).map(([name,url])=>({name,url}));
  const general_group_url=process.env.WHATSAPP_GROUP_GENERAL||"";
  const supabaseUrl=process.env.SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey)return res.status(503).json({verified:true,reference,amount_naira:amountNaira,classes,group_links,general_group_url,warning:"Payment verified, but enrolment storage is not configured. Contact the academy administrator."});
  const row={payment_reference:reference,student_name:String(metadata.student_name||"").slice(0,120),whatsapp:String(metadata.phone||"").slice(0,40),email:String(payment.customer?.email||"").slice(0,180),country:String(metadata.country||"").slice(0,80),classes,amount_kobo:Number(payment.amount),currency:payment.currency,payment_status:"success",batch_month:process.env.NEXT_BATCH_MONTH||(()=>{const now=new Date(),next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));return next.toISOString().slice(0,7)})()};
  const saved=await fetch(supabaseUrl.replace(/\/$/,"")+"/rest/v1/tech_army_registrations?on_conflict=payment_reference",{method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(row)});
  if(!saved.ok)return res.status(502).json({verified:true,reference,amount_naira:amountNaira,classes,group_links,warning:"Payment verified, but saving enrolment failed. Contact support with your payment reference."});
  return res.status(200).json({verified:true,reference,amount_naira:amountNaira,classes,group_links,general_group_url});
 }catch{return res.status(500).json({verified:false,error:"Could not verify this payment right now."})}
}