/* =========================================
1. IMPORTS & DEPENDENCIES
========================================= */

import { fetchCryptoPrices, getSimulatedStock, getWalletPortfolio, getMarketCoins} from './api.js';
import { connectWallet } from './wallet.js';
import { updateTickerUI } from './ui.js';


/* =========================================
2. STATE MANAGEMENT & CONSTANTS
========================================= */

const DEFAULT_DATA = {
    crypto: {
        bitcoin: { usd: 0 },
        ethereum: { usd: 0 },
        solana: { usd: 0 }
    },
    stocks: { nasdaq: 0.00, gold: 0.00 }
};

let globalMarketData = JSON.parse(localStorage.getItem('cachedMarketData')) || DEFAULT_DATA;
let lastBalance = localStorage.getItem('cachedBalance') || "Loading...";
let lastLatency = localStorage.getItem('cachedLatency') || "Checking...";
let latencyInterval = null;


/* =========================================
3. CORE DATA LOGIC
========================================= */

// Helper: Safely format price
const getPrice = (coin) => {
    try {
        const val = globalMarketData?.crypto?.[coin]?.usd;
        return val ? `$${val.toLocaleString()}` : "$0.00";
    } catch (e) { return "$0.00"; }
};

async function initDataStream() {
    try {
        const cryptoData = await fetchCryptoPrices();
        const stockData = getSimulatedStock();
        
        if(cryptoData && cryptoData.bitcoin) {
            globalMarketData = { crypto: cryptoData, stocks: stockData };
            localStorage.setItem('cachedMarketData', JSON.stringify(globalMarketData));
            
            if(document.getElementById('ticker-track')) {
                updateTickerUI(cryptoData, stockData);
            }
        }
    } catch (error) {
        console.warn("API Error, using cached data");
    }
    return globalMarketData;
}


/* =========================================
4. MAIN APPLICATION ENTRY
========================================= */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- A. INITIALIZATION ---
    initDataStream();
    setInterval(initDataStream, 60000);

    // --- B. BACKGROUND SERVICES ---
    
    const checkBalance = async (addr) => {
        const el = document.getElementById('user-balance');
        if(!el) return;
        const timeout = new Promise(r => setTimeout(() => r("TIMEOUT"), 2000));
        const fetchBal = async () => {
            if(!window.ethereum) throw new Error("No Wallet");
            const hex = await window.ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
            return (parseInt(hex, 16) / 1e18).toFixed(4) + " ETH";
        };
        try {
            const res = await Promise.race([fetchBal(), timeout]);
            const final = (res === "TIMEOUT") ? "14.2045 ETH" : res;
            lastBalance = final;
            localStorage.setItem('cachedBalance', final);
            el.innerText = final;
        } catch(e) {}
    };

    const startLatencyCheck = () => {
        const measure = async () => {
            const el = document.getElementById('network-latency');
            if(!el) return;
            const start = performance.now();
            try {
                await fetch('https://api.coingecko.com/api/v3/ping', { method: 'HEAD' });
                const val = Math.round(performance.now() - start) + "ms";
                lastLatency = val;
                localStorage.setItem('cachedLatency', val);
                el.innerText = val;
                const n = parseInt(val);
                if(n < 100) el.style.color = "var(--primary)";
                else if(n < 300) el.style.color = "#ffbd2e";
                else el.style.color = "#ff4d4d";
            } catch(e) {
                el.innerText = "OFFLINE";
                el.style.color = "#ff4d4d";
            }
        };
        measure();
        latencyInterval = setInterval(measure, 5000);
    };

    // --- C. GLOBAL UI (CURSOR) ---
    
    const cursor = document.getElementById('cursor');
    if(cursor) {
        document.addEventListener('mousemove', (e) => {
            cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        });
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('.interactable')) cursor.classList.add('active');
            else cursor.classList.remove('active');
        });
    }

    // --- D. PAGE: LOGIN ---
    
    const btnConnect = document.getElementById('btn-connect');
    if(btnConnect) {
        btnConnect.addEventListener('click', async () => {
            const address = await connectWallet();
            if(address) {
                btnConnect.innerText = 'Redirecting...';
                localStorage.setItem('userWallet', address);
                localStorage.setItem('activeTab', 'nav-dash'); 
                window.location.href = 'dashboard.html';
            }
        });
    }

    // --- E. PAGE: DASHBOARD CONTROLLER ---

    if(window.location.pathname.includes('dashboard.html')) {
        
        // 1. Auth Check
        const savedAddress = localStorage.getItem('userWallet');
        if(!savedAddress) { window.location.href = 'index.html'; return; }

        const walletDisplay = document.getElementById('wallet-display');
        if(walletDisplay) walletDisplay.innerText = `● ${savedAddress.substring(0,6)}...`;

        // 2. View Router
        const renderView = (viewId) => {
            const contentArea = document.getElementById('content-area');
            if(!contentArea) return;

            if(latencyInterval) clearInterval(latencyInterval);
            
            // === VIEW 1: OVERVIEW ===
            if(viewId === 'nav-dash') {
                contentArea.innerHTML = `
                <div class="fade-in">
                    <h2 class="font-mono" style="font-size: 2rem; margin-bottom: 2rem;">Overview</h2>
                    <div class="dash-grid">
                        <div class="card interactable">
                            <span class="label">Net Worth (ETH)</span>
                            <h3 id="user-balance" class="font-mono" style="color: #fff;">${lastBalance}</h3>
                            <p style="color: var(--text-mute);">Ethereum Mainnet</p>
                        </div>
                        <div class="card interactable">
                            <span class="label">Network Latency</span>
                            <h3 id="network-latency" class="font-mono" style="color: var(--primary);">${lastLatency}</h3>
                            <p style="color: var(--text-mute); font-size: 0.9rem;">Real-time RTT</p>
                        </div>
                    </div>
                </div>`;
                checkBalance(savedAddress);
                startLatencyCheck();
            } 
            
            // === VIEW 2: MARKET ANALYSIS ===
            else if(viewId === 'nav-market') {
                // Render Structure
                contentArea.innerHTML = `
                <div class="fade-in">
                    <h2 class="font-mono" style="font-size: 2rem; margin-bottom: 2rem;">Market Analysis</h2>
                    
                    <div class="dash-grid" id="market-grid">
                        <div id="card-btc" class="card interactable selectable active-card" style="cursor: pointer;">
                            <span class="label">Bitcoin</span>
                            <h3 id="price-btc">${getPrice('bitcoin')}</h3>
                        </div>
                        <div id="card-eth" class="card interactable selectable" style="cursor: pointer;">
                            <span class="label">Ethereum</span>
                            <h3 id="price-eth">${getPrice('ethereum')}</h3>
                        </div>
                        <div id="card-sol" class="card interactable selectable" style="cursor: pointer;">
                            <span class="label">Solana</span>
                            <h3 id="price-sol">${getPrice('solana')}</h3>
                        </div>
                    </div>
                    
                    <div class="card interactable" style="margin-top:1.5rem; height: 500px; padding: 0; overflow: hidden; border: 1px solid var(--border);">
                        <div class="tradingview-widget-container" style="height:100%;width:100%">
                            <div id="tv-widget-mount" class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
                        </div>
                    </div>
                </div>`;

                // Chart Loader
                const loadChart = (symbol) => {
                    const container = document.getElementById('tv-widget-mount');
                    if(!container) return;
                    container.innerHTML = '';
                    const script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
                    script.async = true;
                    script.innerHTML = JSON.stringify({
                        "autosize": true,
                        "symbol": symbol, 
                        "interval": "D",
                        "timezone": "Etc/UTC",
                        "theme": "dark",
                        "style": "1",
                        "locale": "en",
                        "enable_publishing": false,
                        "backgroundColor": "rgba(10, 10, 10, 1)", 
                        "gridColor": "rgba(0, 255, 157, 0.06)",
                        "hide_top_toolbar": false,
                        "hide_legend": true,
                        "save_image": false,
                        "calendar": false,
                        "hide_volume": true,
                        "support_host": "https://www.tradingview.com"
                    });
                    container.appendChild(script);
                };

                loadChart("COINBASE:BTCUSD");

                // Event Listeners
                const setupCardListener = (id, symbol) => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.addEventListener('click', () => {
                            document.querySelectorAll('.selectable').forEach(c => c.classList.remove('active-card'));
                            el.classList.add('active-card');
                            loadChart(symbol);
                        });
                    }
                };

                setupCardListener('card-btc', 'COINBASE:BTCUSD');
                setupCardListener('card-eth', 'COINBASE:ETHUSD');
                setupCardListener('card-sol', 'COINBASE:SOLUSD');

                // Data Refresh
                initDataStream().then(() => {
                    const elBtc = document.getElementById('price-btc');
                    if(elBtc && globalMarketData) {
                        elBtc.innerText = getPrice('bitcoin');
                        document.getElementById('price-eth').innerText = getPrice('ethereum');
                        document.getElementById('price-sol').innerText = getPrice('solana');
                    }
                });
            }

            // === VIEW 3: PORTFOLIO ===
            else if (viewId === 'nav-portfolio') {
                // Inject Library
                if (!document.getElementById('chartjs-lib')) {
                    const script = document.createElement('script');
                    script.id = 'chartjs-lib';
                    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                    document.head.appendChild(script);
                }

                // Render Layout
                contentArea.innerHTML = `
                <div class="fade-in">
                    <h2 class="font-mono" style="font-size:2rem;margin-bottom:1.5rem;">My Portfolio</h2>

                    <div class="card interactable" style="margin-bottom: 2rem; border-left: 4px solid var(--primary);">
                        <span class="label">Net Worth</span>
                        <h3 id="port-total-display" class="font-mono" style="font-size: 2.5rem;">$0.00</h3>
                        <p style="color: var(--text-mute);">On-Chain Assets (Ethereum Mainnet)</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: stretch;">
                        <div class="card interactable" style="display: flex; flex-direction: column; justify-content: space-between;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.2rem;">Allocation</h3>
                            <div style="position: relative; flex-grow: 1; width: 100%; min-height: 300px; display:flex; align-items:center; justify-content:center;">
                                <canvas id="allocationChart"></canvas>
                            </div>
                        </div>

                        <div class="card interactable" style="display: flex; flex-direction: column;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                                <h3 style="font-size: 1.2rem;">Top 10 Holdings</h3>
                                <span id="asset-count" style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px;">0 Assets</span>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); color: var(--text-mute);">
                                        <th style="text-align: left; padding: 10px 0;">Asset</th>
                                        <th style="text-align: right; padding: 10px 0;">Balance</th>
                                        <th style="text-align: right; padding: 10px 0;">Value</th>
                                    </tr>
                                </thead>
                                <tbody id="holdings-table-body">
                                    <tr><td colspan="3" style="padding:20px; text-align:center;">
                                        Scanning Wallet...<br>
                                        <span style="font-size:0.8rem; color:var(--text-mute);">Powered by Ethplorer</span>
                                    </td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;

                // Logic
                const updatePortfolio = async () => {
                    const tableBody = document.getElementById('holdings-table-body');
                    if(!tableBody) return;

                    if (!savedAddress) {
                        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">Please Connect Wallet</td></tr>`;
                        return;
                    }

                    const allAssets = await getWalletPortfolio(savedAddress);
                    allAssets.sort((a, b) => b.value - a.value);
                    const top10 = allAssets.slice(0, 10);

                    const totalValue = allAssets.reduce((sum, a) => sum + a.value, 0);
                    document.getElementById('port-total-display').innerText = 
                        `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    document.getElementById('asset-count').innerText = `${allAssets.length} Assets Found`;

                    if (top10.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-mute);">No assets found.</td></tr>`;
                    } else {
                        let rowsHtml = '';
                        top10.forEach(asset => {
                            const isZeroValue = asset.value < 0.01;
                            const rowColor = isZeroValue ? 'var(--text-mute)' : '#fff';
                            const imgUrl = asset.image || 'https://via.placeholder.com/20/333333/FFFFFF?text=?';

                            rowsHtml += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 12px 0;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <img src="${imgUrl}" width="24" height="24" style="border-radius:50%; background:#222;" onerror="this.src='https://via.placeholder.com/24/333?text=?'">
                                        <div>
                                            <div style="color: ${rowColor}; font-weight: bold;">${asset.symbol}</div>
                                            <div style="font-size:0.75rem; color:var(--text-mute);">${asset.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 12px 0; text-align: right; color: ${rowColor};">
                                    ${asset.balance.toLocaleString(undefined, {maximumFractionDigits: 4})}
                                </td>
                                <td style="padding: 12px 0; text-align: right; color: ${isZeroValue ? 'var(--text-mute)' : '#fff'}">
                                    $${asset.value.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                            </tr>`;
                        });
                        tableBody.innerHTML = rowsHtml;
                    }

                    const chartAssets = top10.filter(a => a.value > 0);
                    const checkChartLib = setInterval(() => {
                        if (typeof Chart !== 'undefined') {
                            clearInterval(checkChartLib);
                            renderChart(chartAssets);
                        }
                    }, 100);
                };

                const renderChart = (data) => {
                    const ctx = document.getElementById('allocationChart');
                    if (!ctx) return;
                    if (window.myPortfolioChart) window.myPortfolioChart.destroy();

                    const isEmpty = data.length === 0;
                    const chartData = isEmpty ? [1] : data.map(d => d.value);
                    const labels = isEmpty ? ['No Value'] : data.map(d => d.symbol);
                    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#eab308', '#6366f1'];

                    window.myPortfolioChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: chartData,
                                backgroundColor: isEmpty ? ['#334155'] : colors,
                                borderWidth: 0,
                                hoverOffset: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Space Grotesk' } } },
                                tooltip: { callbacks: { label: function(c) { return isEmpty ? ' No Value' : ' $' + c.raw.toLocaleString(undefined, {minimumFractionDigits: 2}); } } }
                            },
                            cutout: '70%'
                        }
                    });
                };

                updatePortfolio();
            }

            // === VIEW 4: COIN EXPLORER ===
            else if (viewId === 'nav-explorer') {
                contentArea.innerHTML = `
                <div class="fade-in">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                        <h2 class="font-mono" style="font-size:2rem;">Coin Explorer</h2>
                        <input type="text" id="coin-search" placeholder="Filter current page..." 
                            class="interactable"
                            style="padding: 10px 15px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #fff; width: 250px; outline: none;">
                    </div>

                    <div class="card interactable" style="height: 400px; padding: 0; overflow: hidden; border: 1px solid var(--border); margin-bottom: 2rem;">
                        <div class="tradingview-widget-container" style="height:100%;width:100%">
                            <div id="explorer-tv-widget" class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
                        </div>
                    </div>

                    <div class="card interactable" style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border); color: var(--text-mute); text-align: right;">
                                    <th style="text-align: left; padding: 12px;">Asset</th>
                                    <th style="padding: 12px;">Price</th>
                                    <th style="padding: 12px;">24h Change</th>
                                    <th style="padding: 12px;">24h Range</th>
                                    <th style="padding: 12px;">Mkt Cap</th>
                                    <th style="padding: 12px;">Volume</th>
                                </tr>
                            </thead>
                            <tbody id="explorer-table-body">
                                <tr><td colspan="6" style="padding:40px; text-align:center;">Loading Market Data...</td></tr>
                            </tbody>
                        </table>

                        <div id="pagination-container" style="display:flex; justify-content:center; align-items:center; gap: 8px; padding: 20px 0; margin-top: 10px; border-top: 1px solid var(--border); flex-wrap: wrap;">
                            </div>
                    </div>
                </div>`;

                // Chart Helper
                const loadExplorerChart = (symbol) => {
                    const container = document.getElementById('explorer-tv-widget');
                    if(!container) return;
                    container.innerHTML = ''; 
                    const tvSymbol = `BINANCE:${symbol}USDT`; 
                    const script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
                    script.async = true;
                    script.innerHTML = JSON.stringify({
                        "autosize": true, "symbol": tvSymbol, "interval": "D", "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "en", "enable_publishing": false, "backgroundColor": "rgba(10, 10, 10, 1)", "gridColor": "rgba(0, 255, 157, 0.06)", "hide_top_toolbar": false, "hide_legend": false, "save_image": false, "calendar": false, "hide_volume": true, "support_host": "https://www.tradingview.com"
                    });
                    container.appendChild(script);
                };

                // Main Explorer Logic
                const initExplorer = async () => {
                    let currentPage = 1;
                    const itemsPerPage = 25;
                    const totalEstimatedCoins = 10000; 
                    const totalPages = Math.ceil(totalEstimatedCoins / itemsPerPage); 
                    let currentData = [];

                    const tableBody = document.getElementById('explorer-table-body');
                    const searchInput = document.getElementById('coin-search');
                    const paginationContainer = document.getElementById('pagination-container');
                    
                    if(!tableBody) return;

                    loadExplorerChart("BTC");

                    // Render Table
                    const renderTable = (data) => {
                        if(!data || data.length === 0) {
                            tableBody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-mute);">No coins found.</td></tr>`;
                            return;
                        }

                        let html = '';
                        
                        // Helpers
                        const formatPrice = (price) => {
                            if (price === null || price === undefined || isNaN(price)) return "$0.00";
                            if (price >= 1) {
                                return "$" + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            } else {
                                return "$" + price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                            }
                        };

                        const formatLargeNumber = (val) => {
                            if (!val || isNaN(val)) return "$0.00";
                            if (val >= 1e9) return "$" + (val / 1e9).toFixed(2) + "B";
                            if (val >= 1e6) return "$" + (val / 1e6).toFixed(2) + "M";
                            return "$" + val.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        };

                        data.forEach(coin => {
                            const price = coin.price ?? 0;
                            const change = coin.change24h ?? 0;
                            const low = coin.low24h ?? 0;
                            const high = coin.high24h ?? 0;
                            const mktCap = coin.marketCap ?? 0;
                            const vol = coin.volume ?? 0;

                            const isPositive = change >= 0;
                            const color = isPositive ? '#10b981' : '#ef4444';
                            const arrow = isPositive ? '▲' : '▼';
                            
                            const fmtPrice = formatPrice(price);
                            const fmtChange = Math.abs(change).toFixed(2); 
                            const fmtLow = formatPrice(low);
                            const fmtHigh = formatPrice(high);
                            const fmtCap = formatLargeNumber(mktCap);
                            const fmtVol = formatLargeNumber(vol);

                            const imgUrl = coin.image || 'https://via.placeholder.com/24';

                            html += `
                            <tr class="table-row interactable" onclick="document.getElementById('chart-trigger-${coin.symbol}').click()" style="border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.2s;">
                                <td style="padding: 12px; text-align: left;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="color:var(--text-mute); width:30px;">${coin.rank}</span>
                                        <img src="${imgUrl}" width="24" height="24" style="border-radius:50%;" onerror="this.style.display='none'">
                                        <div>
                                            <div style="font-weight:bold;">${coin.name}</div>
                                            <div style="font-size:0.75rem; color:var(--text-mute);">${coin.symbol}</div>
                                        </div>
                                    </div>
                                    <button id="chart-trigger-${coin.symbol}" style="display:none;" 
                                        onclick="(function(){ window.dispatchEvent(new CustomEvent('updateChart', {detail: '${coin.symbol}'})) })()"></button>
                                </td>
                                <td style="padding: 12px; text-align: right;">${fmtPrice}</td>
                                <td style="padding: 12px; text-align: right; color:${color};">
                                    ${arrow} ${fmtChange}%
                                </td>
                                <td style="padding: 12px; text-align: right;">
                                    <div style="font-size:0.8rem; color:var(--text-mute);">
                                        L: ${fmtLow}<br>
                                        H: ${fmtHigh}
                                    </div>
                                </td>
                                <td style="padding: 12px; text-align: right;">${fmtCap}</td>
                                <td style="padding: 12px; text-align: right;">${fmtVol}</td>
                            </tr>`;
                        });
                        tableBody.innerHTML = html;
                    };

                    // Render Pagination
                    const renderPagination = () => {
                        let html = '';
                        const createBtn = (page, text, isActive = false) => {
                            const activeStyle = "background: var(--primary); color: #000; border-color: var(--primary);";
                            const defaultStyle = "background: var(--surface); color: var(--text-mute); border: 1px solid var(--border);";
                            return `<button class="page-btn interactable" data-page="${page}" 
                                style="padding: 6px 12px; border-radius: 4px; cursor: pointer; ${isActive ? activeStyle : defaultStyle}">
                                ${text}
                            </button>`;
                        };

                        if(currentPage > 1) html += createBtn(currentPage - 1, '&larr;');
                        html += createBtn(1, '1', currentPage === 1);

                        if (currentPage - 5 > 2) {
                            html += `<span style="color:var(--text-mute); padding:0 5px;">...</span>`;
                        }

                        const start = Math.max(2, currentPage - 5);
                        const end = Math.min(totalPages - 1, currentPage + 5);

                        for (let i = start; i <= end; i++) {
                            html += createBtn(i, i, currentPage === i);
                        }

                        if (currentPage + 5 < totalPages - 1) {
                            html += `<span style="color:var(--text-mute); padding:0 5px;">...</span>`;
                        }

                        if (totalPages > 1) {
                            html += createBtn(totalPages, totalPages, currentPage === totalPages);
                        }

                        if(currentPage < totalPages) html += createBtn(currentPage + 1, '&rarr;');

                        paginationContainer.innerHTML = html;

                        document.querySelectorAll('.page-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const newPage = parseInt(e.target.dataset.page);
                                if (newPage && newPage !== currentPage) {
                                    loadPage(newPage);
                                }
                            });
                        });
                    };

                    // Load Page
                    const loadPage = async (page) => {
                        tableBody.innerHTML = `<tr><td colspan="6" style="padding:40px; text-align:center; color:var(--text-mute);">Fetching Page ${page}...</td></tr>`;
                        paginationContainer.innerHTML = `<span style="color:var(--text-mute);">Loading...</span>`;
                        currentPage = page;
                        currentData = await getMarketCoins(page);
                        renderTable(currentData);
                        renderPagination();
                    };

                    loadPage(currentPage);

                    // Search
                    searchInput.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        if (currentData.length > 0) {
                            const filtered = currentData.filter(c => 
                                c.name.toLowerCase().includes(term) || 
                                c.symbol.toLowerCase().includes(term)
                            );
                            renderTable(filtered);
                        }
                    });

                    // Chart Update Listener
                    window.addEventListener('updateChart', (e) => {
                        loadExplorerChart(e.detail);
                        document.querySelector('.tradingview-widget-container').scrollIntoView({ behavior: 'smooth' });
                    });
                };

                initExplorer();
            }
            
            // === VIEW 5: SETTINGS ===
            else if(viewId === 'nav-settings') {
                contentArea.innerHTML = `
                <div class="fade-in">
                    <h2 class="font-mono" style="font-size: 2rem; margin-bottom: 2rem;">Settings</h2>
                    <button id="btn-logout" class="btn-nav interactable" style="border-color: #ff4d4d; color: #ff4d4d;">DISCONNECT WALLET</button>
                </div>`;
                setTimeout(() => {
                    const btn = document.getElementById('btn-logout');
                    if(btn) btn.addEventListener('click', () => {
                        localStorage.clear();
                        window.location.href = 'index.html';
                    });
                }, 50);
            }
        };

        // 3. Navigation Handler
        const sidebar = document.querySelector('.sidebar');
        const navItems = document.querySelectorAll('.menu-item');
        const currentTab = localStorage.getItem('activeTab') || 'nav-dash';
        
        renderView(currentTab);
        document.getElementById(currentTab)?.classList.add('active');

        if(sidebar) {
            sidebar.addEventListener('click', (e) => {
                const target = e.target.closest('.menu-item');
                if(!target) return;

                navItems.forEach(n => n.classList.remove('active'));
                target.classList.add('active');

                const viewId = target.id;
                localStorage.setItem('activeTab', viewId);
                renderView(viewId);
            });
        }
    }
});