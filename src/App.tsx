import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { EventProvider } from "./context/EventContext";
import { AppRoutes } from "./routes/AppRoutes";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <EventProvider>
            <AppRoutes />
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;