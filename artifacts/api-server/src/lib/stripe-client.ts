import Stripe from 'stripe';

async function fetchStripeConnection(
  hostname: string,
  token: string,
  environment: string
): Promise<{ publishable: string; secret: string } | null> {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', environment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': token
    }
  });

  const data = await response.json() as {
    items?: Array<{ settings: { publishable: string; secret: string } }>;
  };

  const connectionSettings = data.items?.[0];
  if (!connectionSettings?.settings?.publishable || !connectionSettings?.settings?.secret) {
    return null;
  }

  return connectionSettings.settings;
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
      secretKey: process.env.STRIPE_SECRET_KEY,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY or connect via Replit Stripe connector.');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  let settings = await fetchStripeConnection(hostname, xReplitToken, targetEnvironment);

  if (!settings && isProduction) {
    settings = await fetchStripeConnection(hostname, xReplitToken, 'development');
  }

  if (!settings) {
    throw new Error(`Stripe connection not found for any environment`);
  }

  return {
    publishableKey: settings.publishable,
    secretKey: settings.secret,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}
