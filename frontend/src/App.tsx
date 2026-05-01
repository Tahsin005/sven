import Auth from "./components/pages/Auth";
import Dashboard from "./components/pages/Dashboard";
import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
