import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import SplashPage from "@/pages/splash";
import InfoHomePage from "@/pages/info/home";
import AboutPage from "@/pages/info/about";
import ServicesPage from "@/pages/info/services";
import ServiceAreaPage from "@/pages/info/service-area";
import FaqPage from "@/pages/info/faq";
import ContactPage from "@/pages/info/contact";
import QuotePage from "@/pages/info/quote";
import QuoteDepositPage from "@/pages/info/quote-deposit";
import QuoteConfirmationPage from "@/pages/info/quote-confirmation";
import GalleryPage from "@/pages/info/gallery";

import CustomerPortal from "@/pages/platform/customer";
import ProviderPortal from "@/pages/platform/provider";
import AdminDashboard from "@/pages/admin/dashboard";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={SplashPage} />
      
      {/* Information Website */}
      <Route path="/info" component={InfoHomePage} />
      <Route path="/info/about" component={AboutPage} />
      <Route path="/info/services" component={ServicesPage} />
      <Route path="/info/service-area" component={ServiceAreaPage} />
      <Route path="/info/gallery" component={GalleryPage} />
      <Route path="/info/faq" component={FaqPage} />
      <Route path="/info/contact" component={ContactPage} />
      <Route path="/info/quote" component={QuotePage} />
      <Route path="/info/quote/deposit/:quoteId" component={QuoteDepositPage} />
      <Route path="/info/quote/confirmation" component={QuoteConfirmationPage} />

      {/* Platform */}
      <Route path="/platform" component={CustomerPortal} />
      <Route path="/platform/customer" component={CustomerPortal} />
      <Route path="/platform/provider" component={ProviderPortal} />

      {/* Admin */}
      <Route path="/admin" component={AdminDashboard} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
