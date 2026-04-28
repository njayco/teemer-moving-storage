import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { CustomerAuthProvider } from "@/lib/customer-auth";

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
import TermsPage from "@/pages/info/terms";
import TrackLookupPage from "@/pages/track/lookup";
import TrackByTokenPage from "@/pages/track/token";
import SignContractPage from "@/pages/sign";

import CustomerPortal from "@/pages/platform/customer";
import ProviderPortal from "@/pages/platform/provider";
import AdminDashboard from "@/pages/admin/dashboard";
import CaptainDashboard from "@/pages/admin/captain-dashboard";
import RevenuePage from "@/pages/admin/revenue";
import AdminLoginPage from "@/pages/admin/login";
import AdminAuthGuard from "@/pages/admin/auth-guard";
import CaptainAuthGuard from "@/pages/admin/captain-auth-guard";

import CustomerLoginPage from "@/pages/account/login";
import CustomerSignupPage from "@/pages/account/signup";
import CustomerForgotPasswordPage from "@/pages/account/forgot-password";
import CustomerResetPasswordPage from "@/pages/account/reset-password";
import CustomerVerifyEmailPage from "@/pages/account/verify-email";
import CustomerDashboardPage from "@/pages/account/dashboard";
import CustomerQuoteDetailPage from "@/pages/account/quote-detail";
import CustomerJobDetailPage from "@/pages/account/job-detail";
import CustomerPaymentRequestPayPage from "@/pages/account/payment-request-pay";

const queryClient = new QueryClient();

function ProtectedAdmin() {
  return (
    <AdminAuthGuard>
      <AdminDashboard />
    </AdminAuthGuard>
  );
}

function ProtectedCaptain() {
  return (
    <CaptainAuthGuard>
      <CaptainDashboard />
    </CaptainAuthGuard>
  );
}

function ProtectedRevenue() {
  return (
    <AdminAuthGuard>
      <RevenuePage />
    </AdminAuthGuard>
  );
}

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
      <Route path="/info/terms" component={TermsPage} />
      <Route path="/info/faq" component={FaqPage} />
      <Route path="/info/contact" component={ContactPage} />
      <Route path="/info/quote" component={QuotePage} />
      <Route path="/info/quote/deposit/:quoteId" component={QuoteDepositPage} />
      <Route path="/info/quote/confirmation" component={QuoteConfirmationPage} />

      {/* Tracking */}
      <Route path="/track" component={TrackLookupPage} />
      <Route path="/track/:id/:token" component={TrackByTokenPage} />

      {/* Contract Signing (public) */}
      <Route path="/sign/:token" component={SignContractPage} />

      {/* Platform */}
      <Route path="/platform" component={CustomerPortal} />
      <Route path="/platform/customer" component={CustomerPortal} />
      <Route path="/platform/provider" component={ProviderPortal} />

      {/* Customer Account */}
      <Route path="/account/login" component={CustomerLoginPage} />
      <Route path="/account/signup" component={CustomerSignupPage} />
      <Route path="/account/forgot-password" component={CustomerForgotPasswordPage} />
      <Route path="/account/reset-password" component={CustomerResetPasswordPage} />
      <Route path="/account/verify-email" component={CustomerVerifyEmailPage} />
      <Route path="/account/quotes/:id" component={CustomerQuoteDetailPage} />
      <Route path="/account/jobs/:id" component={CustomerJobDetailPage} />
      <Route path="/account/payment-requests/:id/pay" component={CustomerPaymentRequestPayPage} />
      <Route path="/account" component={CustomerDashboardPage} />

      {/* Admin */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/captain" component={ProtectedCaptain} />
      <Route path="/admin/revenue" component={ProtectedRevenue} />
      <Route path="/admin" component={ProtectedAdmin} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CustomerAuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </CustomerAuthProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
