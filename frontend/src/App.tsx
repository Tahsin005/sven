import Auth from "./components/pages/Auth";
import Dashboard from "./components/pages/Dashboard";
import Layout from "./components/layout/Layout";
import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/c/:conversationId" element={<Dashboard />} />
        </Route>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
