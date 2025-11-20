const { Connection, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");

const execAsync = promisify(exec);

async function main() {
  console.log("🔐 Signing and sending initialization transaction...\n");
  
  // Read the serialized transaction
  const txBase64 = fs.readFileSync("init-tx.txt", "utf8").trim();
  const txBuffer = Buffer.from(txBase64, "base64");
  
  // Deserialize transaction
  const transaction = Transaction.from(txBuffer);
  
  console.log("📝 Transaction Details:");
  console.log("Instructions:", transaction.instructions.length);
  console.log("Fee Payer:", transaction.feePayer.toString());
  console.log("\n⚠️  This requires Ledger signing - we'll use solana CLI...\n");
  
  // Save as binary file for solana CLI
  fs.writeFileSync("init-tx.bin", txBuffer);
  
  console.log("Attempting to sign with Ledger...");
  console.log("Make sure Solana app is open on your Ledger!\n");
  
  try {
    // Use solana transfer as a workaround - but this won't work for custom transactions
    // We need to use a different method
    
    console.log("❌ Unfortunately, Solana CLI doesn't have a direct way to sign custom transactions with Ledger.");
    console.log("\n💡 Alternative: Let me create a transaction that uses @ledgerhq libraries...");
    console.log("\nOr, the EASIEST way: Use Solana Playground or a web wallet interface.");
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();