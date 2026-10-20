import { createRoot } from "react-dom/client";
import Home from "./boss-timer-app";
import { appBasePath } from "./api";
import "./globals.css";
import "./approved-art.css";
import "./reference-countdown.css";
import "./boss-motion.css";
import "./living-scene.css";

const container = document.getElementById("root");
if (!container) throw new Error("The application root is missing.");
try { window.localStorage.removeItem(`bosswatch.github.connection:${appBasePath}`); } catch {}
createRoot(container).render(<Home />);
