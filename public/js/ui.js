export function updateTickerUI(data, stocks) {
    const track = document.getElementById('ticker-track');
    if (!track) return;

    // Create string content
    let html = '';
    
    // Crypto
    if(data) {
        Object.keys(data).forEach(key => {
            const change = data[key].usd_24h_change.toFixed(2);
            const color = change >= 0 ? '#00ff9d' : '#ff4d4d';
            html += `<span class="ticker-item">${key.toUpperCase()} <span style="color:${color}">${change}%</span></span>`;
        });
    }

    // Stocks
    html += `<span class="ticker-item">NASDAQ <span style="color:${stocks.nasdaq >= 0 ? '#00ff9d' : '#ff4d4d'}">${stocks.nasdaq}%</span></span>`;
    
    track.innerHTML = html + html; // Duplicate for scrolling loop
}