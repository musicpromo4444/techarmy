import React from "react";
import { createRoot } from "react-dom/client";
import Admin from "./admin.jsx";

const root = document.getElementById("admin-root");
if (root) createRoot(root).render(<React.StrictMode><Admin /></React.StrictMode>);
