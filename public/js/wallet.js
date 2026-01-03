/* =========================================
   WALLET CONNECTION LOGIC (MetaMask & WalletConnect)
   ========================================= */

   export async function connectWallet() {
    // 1. Try Browser Extension (Chrome/Brave/Edge)
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return accounts[0]; // Return the wallet address
        } catch (error) {
            console.error("User denied account access");
            return null;
        }
    }
    // 2. Fallback for Safari/Mobile (Triggers the QR Code/Barcode)
    else if (typeof WalletConnectProvider !== 'undefined') {
        try {
            const provider = new WalletConnectProvider.default({
                rpc: { 
                    1: "https://cloudflare-eth.com" // Mainnet Public RPC
                }
            });

            // This line opens the "barcode" (QR Code) modal
            await provider.enable(); 
            
            return provider.accounts[0];
        } catch (error) {
            console.error("WalletConnect Connection Error:", error);
            return null;
        }
    }
    // 3. If no provider is found at all
    else {
        alert("No wallet detected. If you are on Safari, please wait for the page to load or use the MetaMask mobile browser.");
        return null;
    }
}