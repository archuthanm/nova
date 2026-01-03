/* =========================================
1. API CONSTANTS & CONFIGURATION
========================================= */

const COINBASE_API = 'https://api.coinbase.com/v2/prices';


/* =========================================
2. PRICE FEEDS (Ticker & Simulation)
========================================= */

// --- COINBASE API (Matches your TradingView Chart) ---
export async function fetchCryptoPrices() {
    try {
        // Fetch BTC, ETH, and SOL in parallel using Promise.all
        // This is faster than waiting for each one one-by-one
        const [btcReq, ethReq, solReq] = await Promise.all([
            fetch(`${COINBASE_API}/BTC-USD/spot`),
            fetch(`${COINBASE_API}/ETH-USD/spot`),
            fetch(`${COINBASE_API}/SOL-USD/spot`)
        ]);

        const btcData = await btcReq.json();
        const ethData = await ethReq.json();
        const solData = await solReq.json();

        // Format data to match exactly what app.js expects
        // (Coinbase returns strings, so we parse them to floats)
        return {
            bitcoin: { 
                usd: parseFloat(btcData.data.amount) 
            },
            ethereum: { 
                usd: parseFloat(ethData.data.amount) 
            },
            solana: { 
                usd: parseFloat(solData.data.amount) 
            }
        };

    } catch (error) {
        console.warn("Coinbase API Error:", error);
        return null; // app.js handles null by keeping old data
    }
}

// --- SIMULATED STOCKS ---
export function getSimulatedStock() {
    return {
        nasdaq: (0.8 + (Math.random() * 0.2 - 0.1)).toFixed(2),
        gold: (0.2 + (Math.random() * 0.1 - 0.05)).toFixed(2)
    };
}


/* =========================================
3. MARKET EXPLORER (CoinGecko)
========================================= */

export const getMarketCoins = async (page = 1) => {
    try {
        // 1. FIX CORS: Prepend a proxy to the URL
        const PROXY_URL = "https://corsproxy.io/?"; 
        const BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";
        const params = `?vs_currency=usd&order=market_cap_desc&per_page=25&page=${page}&sparkline=false&price_change_percentage=24h`;
        
        // Combine them
        const response = await fetch(PROXY_URL + encodeURIComponent(BASE_URL + params));
        
        if (!response.ok) throw new Error("API Limit or Network Error");
        
        const data = await response.json();
        
        // 2. FIX NULL CRASHES: Sanitize data here before it reaches the app
        return data.map(coin => ({
            rank: coin.market_cap_rank || '-',
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            image: coin.image,
            // Ensure numbers are never null. If null, default to 0.
            price: coin.current_price ?? 0, 
            change24h: coin.price_change_percentage_24h ?? 0,
            marketCap: coin.market_cap ?? 0,
            volume: coin.total_volume ?? 0,
            high24h: coin.high_24h ?? 0,
            low24h: coin.low_24h ?? 0
        }));
    } catch (error) {
        console.error("Explorer API Error:", error);
        return [];
    }
};


/* =========================================
4. USER PORTFOLIO (Ethplorer)
========================================= */

export const getWalletPortfolio = async (address) => {
    // 1. The "Filler" List (Popular coins to show if you don't own enough assets)
    const TOP_10_DEFAULTS = [
        { symbol: 'ETH',   name: 'Ethereum',    image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
        { symbol: 'USDT',  name: 'Tether USD',  image: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
        { symbol: 'USDC',  name: 'USDC',        image: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
        { symbol: 'WBTC',  name: 'Wrapped BTC', image: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
        { symbol: 'LINK',  name: 'Chainlink',   image: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
        { symbol: 'UNI',   name: 'Uniswap',     image: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png' },
        { symbol: 'SHIB',  name: 'Shiba Inu',   image: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png' },
        { symbol: 'DAI',   name: 'Dai',         image: 'https://assets.coingecko.com/coins/images/9956/small/4943.png' },
        { symbol: 'PEPE',  name: 'Pepe',        image: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg' },
        { symbol: 'AAVE',  name: 'Aave',        image: 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png' }
    ];

    try {
        // 2. Fetch Real Data (Keep logic as before)
        const response = await fetch(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`);
        const data = await response.json();
        
        const assets = [];

        // A. Process Real ETH
        if (data.ETH) {
            assets.push({
                symbol: 'ETH',
                name: 'Ethereum',
                balance: data.ETH.balance, 
                price: data.ETH.price?.rate || 0,
                value: data.ETH.balance * (data.ETH.price?.rate || 0),
                image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
            });
        }

        // B. Process Real Tokens
        if (data.tokens) {
            data.tokens.forEach(t => {
                const decimals = t.tokenInfo.decimals || 18;
                const bal = t.balance / Math.pow(10, decimals);
                if (bal > 0) { // Only add real assets if balance > 0
                    assets.push({
                        symbol: t.tokenInfo.symbol,
                        name: t.tokenInfo.name,
                        balance: bal,
                        price: t.tokenInfo.price?.rate || 0,
                        value: bal * (t.tokenInfo.price?.rate || 0),
                        image: t.tokenInfo.image ? `https://ethplorer.io${t.tokenInfo.image}` : null
                    });
                }
            });
        }

        // 3. FILLER LOGIC (The new part)
        // Check which symbols we already have from the real scan
        const existingSymbols = new Set(assets.map(a => a.symbol.toUpperCase()));

        // Loop through defaults and add them if (A) we don't have them yet and (B) list size is under 10
        for (const token of TOP_10_DEFAULTS) {
            if (assets.length >= 10) break; // Stop once we hit 10 items
            
            if (!existingSymbols.has(token.symbol)) {
                assets.push({
                    symbol: token.symbol,
                    name: token.name,
                    balance: 0,
                    price: 0, 
                    value: 0,
                    image: token.image
                });
            }
        }

        return assets; // Guaranteed to be at least 10 items (unless defaults fail)

    } catch (error) {
        console.error("Portfolio Scan Error:", error);
        // If API fails completely, return all defaults with 0 balance
        return TOP_10_DEFAULTS.map(t => ({...t, balance: 0, value: 0, price: 0}));
    }
};