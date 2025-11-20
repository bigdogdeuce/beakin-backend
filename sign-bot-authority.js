const { Connection, Transaction, PublicKey } = require("@solana/web3.js");
const TransportNodeHid = require("@ledgerhq/hw-transport-node-hid").default;
const Solana = require("@ledgerhq/hw-app-solana").default;
const fs = require("fs");

async function main() {
  console.log("🔐 Signing Bot Authority transaction with Ledger...\n");
  
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Read the transaction
  const txBase64 = fs.readFileSync("set-bot-tx.txt", "utf8").trim();
  const txBuffer = Buffer.from(txBase64, "base64");
  const transaction = Transaction.from(txBuffer);
  
  // Get fresh blockhash
  console.log("🔄 Getting fresh blockhash...");
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  console.log("✅ Fresh blockhash obtained");
  
  console.log("\n📝 Transaction loaded");
  console.log("Fee Payer:", transaction.feePayer.toString());
  console.log("\n⚠️  Make sure Solana app is open on your Ledger!");
  
  try {
    // Connect to Ledger
    console.log("\n🔌 Connecting to Ledger...");
    const transport = await TransportNodeHid.create();
    const solana = new Solana(transport);
    
    // Get Ledger address
    const derivationPath = "44'/501'/0'";
    const { address } = await solana.getAddress(derivationPath);
    const ledgerPubkey = new PublicKey(address);
    
    console.log("✅ Ledger connected!");
    console.log("Ledger Address:", ledgerPubkey.toString());
    console.log("Expected Admin:", "AJKxLwTAfbDGKBrz2YPRWEJVYTHG56bq1DfUj1BgE1dk");
    
    if (ledgerPubkey.toString() !== "AJKxLwTAfbDGKBrz2YPRWEJVYTHG56bq1DfUj1BgE1dk") {
      throw new Error("Ledger address doesn't match expected admin address!");
    }
    
    // Sign the transaction
    console.log("\n🖊️  Please approve the transaction on your Ledger...");
    const signature = await solana.signTransaction(derivationPath, transaction.serializeMessage());
    
    // Add signature to transaction
    transaction.addSignature(ledgerPubkey, Buffer.from(signature.signature));
    
    console.log("✅ Transaction signed!");
    console.log("Signature:", Buffer.from(signature.signature).toString('hex').substring(0, 32) + "...");
    
    // Send transaction
    console.log("\n📤 Sending transaction...");
    const txid = await connection.sendRawTransaction(transaction.serialize());
    
    console.log("✅ Transaction sent!");
    console.log("Transaction ID:", txid);
    console.log("\n⏳ Confirming...");
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txid, "confirmed");
    
    if (confirmation.value.err) {
      console.error("❌ Transaction failed:", confirmation.value.err);
    } else {
      console.log("\n🎉 SUCCESS! Bot authority set!");
      console.log("\nView on Solscan:");
      console.log(`https://solscan.io/tx/${txid}`);
      console.log("\n✅ Bot Authority:", "BvajbxbEXx3SYViLtCMTpsXcVNcAzpMJ8yN9SX56mG6P");
      console.log("✅ Daily Limit:", "10,000 NSTG");
      console.log("\n📋 Verify with:");
      console.log("solana account J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3 --url https://api.mainnet-beta.solana.com");
    }
    
    await transport.close();
    
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
  }
}

main();