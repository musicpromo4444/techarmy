import React,{useMemo} from 'react';
import {getCountryCallingCode,parsePhoneNumberFromString} from 'libphonenumber-js';
const ISO_COUNTRIES=["AC","AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","YE","YT","ZA","ZM","ZW"];
const names=new Intl.DisplayNames(['en'],{type:'region'});
export const getCountryName=code=>{try{return names.of(code)||code}catch{return code}};
const COUNTRIES=ISO_COUNTRIES.map(code=>{try{return {code,name:getCountryName(code),dial:getCountryCallingCode(code)}}catch{return null}}).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
export function normalizePhoneInput(value,selectedCountry,onCountryChange){
 const raw=String(value||'').trim();
 if(raw.startsWith('+')){
  const parsed=parsePhoneNumberFromString(raw);
  if(parsed?.country){onCountryChange(parsed.country);return parsed.nationalNumber}
  return raw.replace(/\D/g,'');
 }
 let digits=raw.replace(/\D/g,'');
 if(digits.startsWith('0'))digits=digits.slice(1);
 return digits.slice(0,15);
}
export function InternationalPhoneInput({countryCode,phone,onCountryChange,onPhoneChange}){
 const selected=useMemo(()=>COUNTRIES.find(c=>c.code===countryCode)||COUNTRIES.find(c=>c.code==='NG'),[countryCode]);
 return <div className="international-phone">
  <label className="phone-country"><span>COUNTRY CODE</span><select aria-label="Country and international calling code" value={selected.code} onChange={e=>onCountryChange(e.target.value)}>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name} (+{c.dial})</option>)}</select></label>
  <label className="phone-national"><span>WHATSAPP NUMBER</span><div className="phone-number-entry"><b>+{selected.dial}</b><input required type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e=>onPhoneChange(normalizePhoneInput(e.target.value,countryCode,onCountryChange))} placeholder={countryCode==='NG'?'8035684058':'Enter number without leading zero'} /></div></label>
 </div>
}
