import React from "react";
import{createRoot}from"react-dom/client";
import ContentAdmin from"./content-admin.jsx";
import"./content-admin.css";
const root=document.getElementById("content-admin-root");
if(root)createRoot(root).render(<React.StrictMode><ContentAdmin/></React.StrictMode>);
