-- Store a distinct WhatsApp invitation for every course and paid level.
alter table public.tech_army_payment_settings
  add column if not exists web_starter_group_url text,
  add column if not exists web_professional_group_url text,
  add column if not exists web_master_group_url text,
  add column if not exists automation_starter_group_url text,
  add column if not exists automation_professional_group_url text,
  add column if not exists automation_master_group_url text,
  add column if not exists creative_starter_group_url text,
  add column if not exists creative_professional_group_url text,
  add column if not exists creative_master_group_url text;

insert into public.tech_army_payment_settings (
  id, web_starter_group_url, web_professional_group_url, web_master_group_url, automation_starter_group_url, automation_professional_group_url, automation_master_group_url, creative_starter_group_url, creative_professional_group_url, creative_master_group_url
) values (
  'default',
  'https://chat.whatsapp.com/LkRzNOeQrrN7re4Tog10JV?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/LSn3hF2rwyT2Abp0yiEEPs?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/H1qTw3NPnC9A7u9oPcAZIa?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/HigLLiC96SbJRoOcglrK7n?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/CZSihi2GXwRGX1mZwp51RR?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/F8caBHMji094KDUpMc2RX6?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/Eup6lvjyPId7oKXX6V1vjj?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/Bad7uIRjLCoE3Nv2xm7gLl?s=cl&p=a&iam=2', 'https://chat.whatsapp.com/JJfynubRArkFUcJDhDlh87?s=cl&p=a&iam=2'
)
on conflict (id) do update set
  web_starter_group_url = excluded.web_starter_group_url,
  web_professional_group_url = excluded.web_professional_group_url,
  web_master_group_url = excluded.web_master_group_url,
  automation_starter_group_url = excluded.automation_starter_group_url,
  automation_professional_group_url = excluded.automation_professional_group_url,
  automation_master_group_url = excluded.automation_master_group_url,
  creative_starter_group_url = excluded.creative_starter_group_url,
  creative_professional_group_url = excluded.creative_professional_group_url,
  creative_master_group_url = excluded.creative_master_group_url,
  updated_at = now();
