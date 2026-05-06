import { useState } from 'react'

const COINS = [
  {
    key: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    address: 'bc1qexamplewalletaddress123456789',
    network: 'Bitcoin Network',
  },
  {
    key: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    address: '0xExample1234567890abcdef1234567890ABCdef12',
    network: 'ERC-20',
  },
  {
    key: 'usdt',
    name: 'Tether',
    symbol: 'USDT',
    address: 'TExampleTRC20WalletAddress123456789',
    network: 'TRC-20',
  },
]

export default function CryptoPayment() {
  const [activeKey, setActiveKey] = useState('btc')
  const [copied, setCopied] = useState(false)
  const coin = COINS.find((c) => c.key === activeKey) || COINS[0]

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(coin.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
      <header className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 md:text-xl">
          Pay with Cryptocurrency
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Send the exact amount to the wallet address below. Your tickets will
          be confirmed after payment verification.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
        {COINS.map((c) => {
          const active = c.key === activeKey
          const primary = c.key === 'btc'
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand bg-blue-50 text-brand'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {c.symbol}
              {primary && (
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand/70">
                  Recommended
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {coin.name} ({coin.symbol}) · {coin.network}
          </p>
          <div className="mt-1.5 flex items-stretch gap-2">
            <code className="flex-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-800">
              {coin.address}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:border-brand hover:text-brand"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <ul className="mt-2 space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="text-brand">1.</span>
            Copy the wallet address above and send the exact total amount from
            your order summary.
          </li>
          <li className="flex gap-2">
            <span className="text-brand">2.</span>
            Send only {coin.symbol} on the {coin.network}. Sending the wrong
            asset or network will result in lost funds.
          </li>
          <li className="flex gap-2">
            <span className="text-brand">3.</span>
            Submit your order below. Once we confirm your payment on-chain,
            your tickets will be emailed to you.
          </li>
        </ul>
      </div>
    </div>
  )
}
