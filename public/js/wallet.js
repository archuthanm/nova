export async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return accounts[0]; // Return the wallet address
        } catch (error) {
            console.error("User denied account access");
            return null;
        }
    } else {
        alert("Please install MetaMask to use this app.");
        return null;
    }
}