# React & Next.js Patterns

React components and Next.js App Router wiring for a Stellar dapp. Companion to [SKILL.md](SKILL.md) (SDK setup, wallets, transactions); client-side reads live in [data-fetching.md](data-fetching.md), passkey wallets in [smart-accounts.md](smart-accounts.md).

## React Components

### Connect Wallet Button
```tsx
// components/ConnectButton.tsx
"use client";

import { useFreighter } from "@/hooks/useFreighter";

export function ConnectButton() {
  const { connected, address, connect, disconnect } = useFreighter();

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {address.slice(0, 4)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Connect Wallet
    </button>
  );
}
```

### Send Payment Form
```tsx
// components/SendPayment.tsx
"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { buildPaymentTx, submitTransaction } from "@/lib/transactions";
import { config } from "@/lib/stellar";

export function SendPayment() {
  const { address, sign } = useFreighter();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setStatus("Building transaction...");

    try {
      const xdr = await buildPaymentTx(address, destination, amount);

      setStatus("Please sign in your wallet...");
      const signedXdr = await sign(xdr, config.networkPassphrase);

      setStatus("Submitting transaction...");
      const result = await submitTransaction(signedXdr);

      setStatus(`Success! Hash: ${result.hash}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Destination Address"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        placeholder="Amount (XLM)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button
        type="submit"
        disabled={loading || !address}
        className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? "Processing..." : "Send"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}
```

## Next.js App Router Setup

### Provider Component
```tsx
// app/providers.tsx
"use client";

import { ReactNode } from "react";

// Add any context providers here
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

### Layout
```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```
