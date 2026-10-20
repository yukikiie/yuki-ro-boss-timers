import { createRoot } from "react-dom/client";
import Home from "./boss-timer-app";
import "./globals.css";
import "./approved-art.css";
import "./reference-countdown.css";
import "./boss-motion.css";
import "./living-scene.css";
import "./private-connection.css";

const container = document.getElementById("root");
if (!container) throw new Error("The application root is missing.");
createRoot(container).render(<Home />);
