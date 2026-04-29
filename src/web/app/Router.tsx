import { Routes, Route } from "react-router-dom";
import { App } from "./App";
import { PlaygroundPage } from "./playground/PlaygroundPage";

export function Router() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/doc/:documentId" element={<App />} />
      <Route path="/playground" element={<PlaygroundPage />} />
    </Routes>
  );
}
