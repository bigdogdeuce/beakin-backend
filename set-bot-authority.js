const { Connection, PublicKey, TransactionInstruction, Transaction, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");

async function main() {
  console.log("🤖 Setting Bot Authority...\n");
  
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  const programId = new PublicKey("2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5");
  const admin = new PublicKey("AJKxLwTAfbDGKBrz2YPRWEJVYTHG56bq1DfUj1BgE1dk");
  const configPda = new PublicKey("J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3");
  const botAuthority = new PublicKey("BvajbxbEXx3SYViLtCMTpsXcVNcAzpMJ8yN9SX56mG6P");
  
  // Daily limit: 10,000 NSTG with 9 decimals = 10,000,000,000,000
  const dailyLimit = BigInt("10000000000000");
  
  console.log("📋 Parameters:");
  console.log("Config PDA:", configPda.toString());
  console.log("Bot Authority:", botAuthority.toString());
  console.log("Daily Limit:", dailyLimit.toString(), "(10,000 NSTG)");
  console.log("Admin:", admin.toString());
  
  // Load IDL to get discriminator
  const idl = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));
  const setBotIx = idl.instructions.find(ix => ix.name === "admin_set_bot_authority");
  
  if (!setBotIx) {
    throw new Error("admin_set_bot_authority instruction not found in IDL");
  }
  
  console.log("\n✅ Found admin_set_bot_authority instruction");
  console.log("Discriminator:", setBotIx.discriminator);
  
  // Build instruction data: [discriminator (8 bytes), bot_authority (32 bytes), daily_limit (8 bytes)]
  const discriminator = Buffer.from(setBotIx.discriminator);
  const botAuthorityBytes = botAuthority.toBuffer();
  const dailyLimitBytes = Buffer.alloc(8);
  dailyLimitBytes.writeBigUInt64LE(dailyLimit);
  
  const data = Buffer.concat([discriminator, botAuthorityBytes, dailyLimitBytes]);
  
  console.log("\n📝 Instruction data (hex):", data.toString('hex'));
  console.log("   Discriminator:", discriminator.toString('hex'));
  console.log("   Bot Authority:", botAuthorityBytes.toString('hex'));
  console.log("   Daily Limit:", dailyLimitBytes.toString('hex'));
  
  // Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
    ],
    programId: programId,
    data: data,
  });
  
  // Create transaction
  const transaction = new Transaction();
  
  // Get fresh blockhash
  console.log("\n🔄 Getting fresh blockhash...");
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = admin;
  transaction.add(instruction);
  
  console.log("✅ Fresh blockhash obtained");
  
  // Serialize for signing
  const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  const base64Tx = serialized.toString('base64');
  
  console.log("\n✅ Transaction built successfully!");
  console.log("\n📝 Transaction (base64):");
  console.log(base64Tx.substring(0, 100) + "...");
  
  // Save to file for Ledger signing
  fs.writeFileSync("set-bot-tx.txt", base64Tx);
  console.log("\n💾 Transaction saved to: set-bot-tx.txt");
  
  console.log("\n🔐 Ready to sign with Ledger!");
  console.log("Run: node sign-bot-authority.js");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});