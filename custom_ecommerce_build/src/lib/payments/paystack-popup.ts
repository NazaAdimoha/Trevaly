/**
 * Loads Paystack's inline script and resumes a transaction the server already
 * initialized.
 *
 * `resumeTransaction(access_code)` is the whole point: the amount was fixed
 * server-side when the access code was issued, so nothing here can change what
 * the customer is charged. The older `PaystackPop.setup({ amount })` flow takes
 * the amount from the browser, which lets a customer pay ₦1 for a ₦25,000 order
 * — the charge succeeds and only verification catches it, after the money moved.
 */

/**
 * The `callback_url` we send at initialize is honoured only by the redirect
 * flow. In the inline popup the browser never leaves the page, so completion is
 * reported through these callbacks and nowhere else — omitting them means a
 * customer pays successfully and is returned to a checkout form with a full
 * cart and no confirmation, while the order sits PENDING until the webhook
 * lands. The money arrives; the customer cannot tell.
 */
export type PaystackCallbacks = {
  onSuccess: (transaction: { reference: string }) => void;
  onCancel?: () => void;
  onError?: (error: { message?: string }) => void;
};

type PaystackPopupInstance = {
  resumeTransaction: (
    accessCode: string,
    callbacks?: PaystackCallbacks,
  ) => void;
};

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopupInstance;
  }
}

const SCRIPT_SRC = 'https://js.paystack.co/v2/inline.js';

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack can only load in the browser'));
  }
  if (window.PaystackPop) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      loader = null;
      reject(new Error('Could not load Paystack. Check your connection.'));
    });

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return loader;
}

export async function resumePaystackTransaction(
  accessCode: string,
  callbacks: PaystackCallbacks,
): Promise<void> {
  await loadScript();

  const Popup = window.PaystackPop;
  if (!Popup) throw new Error('Paystack failed to initialise');

  new Popup().resumeTransaction(accessCode, callbacks);
}
